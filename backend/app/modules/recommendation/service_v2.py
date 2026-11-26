"""GNN-PPO Serving + Policy Guardrail + Time-Aware Feature Store Service (PL3-GUARD-01)."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

import numpy as np
import redis
from plumora_rl.domain import (
    MODE_NAMES,
    EbbinghausMemoryModel,
    GraphObservation,
    GraphObservationBuilder,
    LearningMode,
    NodeCompetencyInput,
    NodeFeatureIdx,
)
from plumora_rl.inference import NumpyGnnPredictor
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import ModelRegistryModel
from app.db.redis_pool import get_redis_client
from app.modules.assessment.schemas_v2 import (
    V2RecommendationResponse,
    V2RecommendedAction,
)
from app.modules.contracts.adapters import (
    get_competency_reader_port,
    get_content_catalog_port,
)
from app.modules.contracts.dtos import (
    ConceptNodeDTO,
    DomainTopologyDTO,
    UserCompetencySnapshotDTO,
    UserNodeCompetencyDTO,
)
from app.modules.contracts.ports import CompetencyReaderPort, ContentCatalogPort
from app.modules.recommendation.gnn_loader import load_verified_gnn_checkpoint
from app.modules.recommendation.guardrail import select_guarded_action_from_obs
from app.modules.recommendation.rationale_builder import PedagogicalRationaleBuilder

logger = logging.getLogger(__name__)

ACTIVE_MODEL_REDIS_KEY = "plumora:model_registry:active"
ACTIVE_MODEL_REDIS_TTL_SECONDS = 300


def _raw_comp_redis_key(user_id: uuid.UUID, domain_slug: str) -> str:
    return f"plumora:raw_comp_state:{user_id}:{domain_slug}"


def invalidate_active_model_cache() -> None:
    """Invalidate distributed Redis active model pointer across all workers."""
    try:
        client = get_redis_client(decode_responses=True, socket_timeout=0.3)
        client.delete(ACTIVE_MODEL_REDIS_KEY)
    except (redis.RedisError, OSError) as exc:
        logger.warning("Failed to invalidate Redis active model key: %s", exc)


def publish_active_model_pointer(checkpoint_path: str, checkpoint_sha256: str) -> None:
    """Write active model pointer to Redis for instant cross-worker synchronization."""
    try:
        client = get_redis_client(decode_responses=True, socket_timeout=0.3)
        client.set(
            ACTIVE_MODEL_REDIS_KEY,
            json.dumps(
                {
                    "checkpoint_path": checkpoint_path,
                    "checkpoint_sha256": checkpoint_sha256,
                }
            ),
            ex=ACTIVE_MODEL_REDIS_TTL_SECONDS,
        )
    except (redis.RedisError, OSError) as exc:
        logger.warning("Failed to publish active model pointer to Redis: %s", exc)


def _get_active_model_meta(db: Session) -> tuple[str, str] | None:
    """Resolve active model (checkpoint_path, checkpoint_sha256) from Redis -> fallback PostgreSQL."""
    try:
        client = get_redis_client(decode_responses=True, socket_timeout=0.3)
        raw = client.get(ACTIVE_MODEL_REDIS_KEY)
        if isinstance(raw, str):
            data = json.loads(raw)
            c_path = str(data.get("checkpoint_path", "")).strip()
            c_sha = str(data.get("checkpoint_sha256", "")).strip()
            if c_path and c_sha:
                return c_path, c_sha
    except (redis.RedisError, OSError, ValueError, KeyError) as exc:
        logger.warning("Redis active model read failed, falling back to PostgreSQL: %s", exc)

    active_model = db.scalars(
        select(ModelRegistryModel)
        .where(ModelRegistryModel.is_active.is_(True))
        .order_by(ModelRegistryModel.activated_at.desc(), ModelRegistryModel.created_at.desc())
        .limit(1)
    ).first()
    if active_model is None:
        return None
    publish_active_model_pointer(
        str(active_model.checkpoint_path), str(active_model.checkpoint_sha256)
    )
    return str(active_model.checkpoint_path), str(active_model.checkpoint_sha256)


def _serialize_comp_map_for_cache(
    comp_map: dict[str, UserNodeCompetencyDTO],
    node_slugs: list[str],
) -> dict[str, dict[str, Any]]:
    payload: dict[str, dict[str, Any]] = {}
    for slug in node_slugs:
        c = comp_map.get(slug)
        if c is None:
            continue
        payload[slug] = {
            "concept_slug": c.concept_slug,
            "depth_level_norm": c.depth_level_norm,
            "peak_depth_level_norm": c.peak_depth_level_norm,
            "depth_label": c.depth_label,
            "confidence": c.confidence,
            "stability_s": c.stability_s,
            "last_practiced_at": c.last_practiced_at.isoformat() if c.last_practiced_at else None,
            "playbook_completed_at": (
                c.playbook_completed_at.isoformat() if c.playbook_completed_at else None
            ),
            "code_practice_score": c.code_practice_score,
        }
    return payload


def _deserialize_comp_map_from_cache(
    raw_map: dict[str, Any],
) -> dict[str, UserNodeCompetencyDTO]:
    out: dict[str, UserNodeCompetencyDTO] = {}
    for slug, it in raw_map.items():
        lp_raw = it.get("last_practiced_at")
        pb_raw = it.get("playbook_completed_at")
        out[str(slug)] = UserNodeCompetencyDTO(
            concept_slug=str(it["concept_slug"]),
            depth_level_norm=float(it["depth_level_norm"]),
            peak_depth_level_norm=float(it["peak_depth_level_norm"]),
            depth_label=str(it["depth_label"]),
            confidence=float(it["confidence"]),
            stability_s=float(it["stability_s"]),
            last_practiced_at=datetime.fromisoformat(str(lp_raw)) if lp_raw else None,
            playbook_completed_at=datetime.fromisoformat(str(pb_raw)) if pb_raw else None,
            code_practice_score=float(it.get("code_practice_score", 0.0)),
        )
    return out


def _read_through_raw_competencies(
    user_id: uuid.UUID,
    domain_slug: str,
    topology: DomainTopologyDTO,
    competency_port: CompetencyReaderPort,
) -> tuple[dict[str, UserNodeCompetencyDTO], str]:
    """Time-Aware Read-Through Feature Store: check Redis FIRST, call HTTP/DB port only on cache miss.

    Assessment mutations actively invalidate `plumora:raw_comp_state:{user_id}:*`, and domain mutations
    increment `topology.graph_version`, guaranteeing zero stale competency cache without extra HTTP calls.
    Real-time Ebbinghaus retention & needs_review are ALWAYS projected fresh at request time.
    """
    node_slugs = [n.concept_slug for n in topology.nodes]
    key = _raw_comp_redis_key(user_id, domain_slug)
    redis_client: redis.Redis | None = None

    try:
        redis_client = get_redis_client(decode_responses=True, socket_timeout=0.25)
        raw = redis_client.get(key)
        if isinstance(raw, str):
            data = json.loads(raw)
            if (
                int(data.get("graph_version", -1)) == topology.graph_version
                and isinstance(data.get("competencies"), dict)
            ):
                redis_client.incr("plumora:metrics:kg_cache_hits")
                return _deserialize_comp_map_from_cache(data["competencies"]), "redis_cache"
    except (redis.RedisError, OSError, ValueError, KeyError) as exc:
        redis_client = None
        logger.warning(
            "Redis raw competency cache read unavailable for user %s/%s: %s",
            user_id,
            domain_slug,
            exc,
        )

    snapshot: UserCompetencySnapshotDTO = competency_port.get_user_competency_snapshot(user_id)
    comp_map = snapshot.by_slug()
    if redis_client is None:
        return comp_map, "postgres_fallback"

    try:
        redis_client.incr("plumora:metrics:kg_cache_misses")
        redis_client.set(
            key,
            json.dumps(
                {
                    "state_version": snapshot.state_version,
                    "graph_version": topology.graph_version,
                    "competencies": _serialize_comp_map_for_cache(comp_map, node_slugs),
                }
            ),
            ex=settings.redis_state_ttl_seconds,
        )
        return comp_map, "postgres_cache_warm"
    except (redis.RedisError, OSError) as exc:
        logger.warning(
            "Redis raw competency cache warm failed for user %s/%s: %s",
            user_id,
            domain_slug,
            exc,
        )
        return comp_map, "postgres_fallback"


def build_domain_graph_observation(
    topology: DomainTopologyDTO,
    comp_map: dict[str, UserNodeCompetencyDTO],
    *,
    now: datetime | None = None,
    simulated_time_offset_days: float = 0.0,
) -> GraphObservation:
    """Build canonical (N, 8) GraphObservation + normalized adjacencies via GraphObservationBuilder."""
    eval_now = now if now is not None else datetime.now(UTC)
    inputs: list[NodeCompetencyInput] = []
    for n in topology.nodes:
        c = comp_map.get(n.concept_slug)
        inputs.append(
            NodeCompetencyInput(
                concept_slug=n.concept_slug,
                node_idx=n.node_idx,
                tier=n.tier,
                prerequisites=n.prerequisites,
                depth_level_norm=c.depth_level_norm if c else 0.0,
                confidence=c.confidence if c else 0.0,
                stability_s=c.stability_s if c else EbbinghausMemoryModel.INITIAL_STABILITY_DAYS,
                last_practiced_at=c.last_practiced_at if c else None,
                code_practice_score=c.code_practice_score if c else 0.0,
                has_code_challenge=n.has_code_challenge,
                is_shared=n.is_shared,
            )
        )
    return GraphObservationBuilder.build(
        inputs,
        now=eval_now,
        simulated_time_offset_days=simulated_time_offset_days,
    )


def _fallback_recommendation(
    domain_slug: str,
    ordered_nodes: list[ConceptNodeDTO],
    obs: GraphObservation,
    comp_map: dict[str, UserNodeCompetencyDTO],
    state_source: str,
    snapshot: list[list[float]],
) -> V2RecommendationResponse:
    """Deterministic pedagogical fallback when checkpoint is missing/corrupt (never labeled gnn_ppo)."""
    feats = obs.node_features
    needs_review_mask = feats[:, NodeFeatureIdx.NEEDS_REVIEW] > 0.5
    retention_vec = feats[:, NodeFeatureIdx.RETENTION]

    if bool(np.any(needs_review_mask)):
        masked_ret = np.where(needs_review_mask, retention_vec, np.inf)
        idx = int(np.argmin(masked_ret))
        target = ordered_nodes[idx]
        reason = PedagogicalRationaleBuilder.build_reason(
            target_node=target,
            mode=LearningMode.SPACED_REVIEW,
            all_nodes=ordered_nodes,
            comp_map=comp_map,
            retention=float(retention_vec[idx]),
        )
        return V2RecommendationResponse(
            domain_slug=domain_slug,
            status="active",
            recommended_action=V2RecommendedAction(
                concept_slug=target.concept_slug,
                title=target.title,
                tier=target.tier,
                learning_mode=MODE_NAMES[LearningMode.SPACED_REVIEW],
                reason_vi=reason,
            ),
            policy_source="fallback_rule",
            state_source=state_source,
            guardrail_applied=True,
            retention_alert=True,
            checkpoint_sha256="",
            node_features_snapshot=snapshot,
        )

    eligible_incomplete = [
        (i, n)
        for i, n in enumerate(ordered_nodes)
        if feats[i, NodeFeatureIdx.IS_ELIGIBLE] > 0.5 and feats[i, NodeFeatureIdx.DEPTH_NORM] < 1.0
    ]
    if not eligible_incomplete:
        return V2RecommendationResponse(
            domain_slug=domain_slug,
            status="completed",
            recommended_action=None,
            policy_source="fallback_rule",
            state_source=state_source,
            guardrail_applied=True,
            retention_alert=False,
            checkpoint_sha256="",
            node_features_snapshot=snapshot,
        )

    idx, target = min(
        eligible_incomplete,
        key=lambda pair: (
            pair[1].tier,
            float(feats[pair[0], NodeFeatureIdx.DEPTH_NORM]),
            pair[1].node_idx,
        ),
    )
    depth = float(feats[idx, NodeFeatureIdx.DEPTH_NORM])
    code_sc = float(feats[idx, NodeFeatureIdx.CODE_SCORE])
    if depth >= 0.75 and target.has_code_challenge and code_sc < 1.0:
        mode = LearningMode.CODE_PRACTICE
    elif depth >= 0.25:
        mode = LearningMode.DEEP_PROBE
    else:
        mode = LearningMode.LEARN_NEW

    reason = PedagogicalRationaleBuilder.build_reason(
        target_node=target,
        mode=mode,
        all_nodes=ordered_nodes,
        comp_map=comp_map,
        retention=float(retention_vec[idx]),
    )
    return V2RecommendationResponse(
        domain_slug=domain_slug,
        status="active",
        recommended_action=V2RecommendedAction(
            concept_slug=target.concept_slug,
            title=target.title,
            tier=target.tier,
            learning_mode=MODE_NAMES[mode],
            reason_vi=reason,
        ),
        policy_source="fallback_rule",
        state_source=state_source,
        guardrail_applied=True,
        retention_alert=False,
        checkpoint_sha256="",
        node_features_snapshot=snapshot,
    )


def recommend_gnn_ppo_v2(
    db: Session,
    user_id: uuid.UUID,
    domain_slug: str,
    *,
    checkpoint_path_override: str | None = None,
    manifest_path_override: str | None = None,
    content_port: ContentCatalogPort | None = None,
    competency_port: CompetencyReaderPort | None = None,
) -> V2RecommendationResponse:
    """Serve GNN-PPO with shared PolicyGuardrailStrategy, Hexagonal Ports & Time-Aware Feature Store."""
    c_port = content_port if content_port is not None else get_content_catalog_port(db)
    u_port = competency_port if competency_port is not None else get_competency_reader_port(db)

    topology = c_port.get_domain_topology(domain_slug)
    if topology is None or not topology.nodes:
        return V2RecommendationResponse(
            domain_slug=domain_slug,
            status="completed",
            recommended_action=None,
            policy_source="completed",
            state_source="postgres_fallback",
            guardrail_applied=False,
            retention_alert=False,
            checkpoint_sha256="",
            node_features_snapshot=[],
        )

    ordered_nodes = sorted(topology.nodes, key=lambda n: n.node_idx)
    comp_map, state_source = _read_through_raw_competencies(
        user_id, domain_slug, topology, u_port
    )

    obs = build_domain_graph_observation(topology, comp_map)
    snapshot = [[round(float(val), 4) for val in row] for row in obs.node_features.tolist()]

    # Completed check: all nodes depth >= 0.75 and no node needs_review
    depths = obs.node_features[:, NodeFeatureIdx.DEPTH_NORM]
    needs_rev = obs.node_features[:, NodeFeatureIdx.NEEDS_REVIEW] > 0.5
    if bool(np.all(depths >= 0.75)) and not bool(np.any(needs_rev)):
        return V2RecommendationResponse(
            domain_slug=domain_slug,
            status="completed",
            recommended_action=None,
            policy_source="completed",
            state_source=state_source,
            guardrail_applied=False,
            retention_alert=False,
            checkpoint_sha256="",
            node_features_snapshot=snapshot,
        )

    ckpt: NumpyGnnPredictor | None = None
    if checkpoint_path_override is not None or manifest_path_override is not None:
        ckpt = load_verified_gnn_checkpoint(
            checkpoint_path_override=checkpoint_path_override,
            manifest_path_override=manifest_path_override,
        )
    else:
        active_meta = _get_active_model_meta(db)
        if active_meta is not None:
            ckpt = load_verified_gnn_checkpoint(
                checkpoint_path_override=active_meta[0],
                expected_sha256_override=active_meta[1],
            )
        if ckpt is None:
            ckpt = load_verified_gnn_checkpoint()

    if ckpt is None:
        return _fallback_recommendation(
            domain_slug=domain_slug,
            ordered_nodes=ordered_nodes,
            obs=obs,
            comp_map=comp_map,
            state_source=state_source,
            snapshot=snapshot,
        )

    logits = ckpt.predict_logits(obs.node_features, obs.adj_in, obs.adj_out)
    sel_v, sel_m_int, policy_source, guardrail_applied = select_guarded_action_from_obs(logits, obs)
    sel_mode = LearningMode(sel_m_int)
    selected_node = ordered_nodes[sel_v]
    retention_alert = bool(np.any(needs_rev))

    reason_vi = PedagogicalRationaleBuilder.build_reason(
        target_node=selected_node,
        mode=sel_mode,
        all_nodes=ordered_nodes,
        comp_map=comp_map,
        retention=float(obs.node_features[sel_v, NodeFeatureIdx.RETENTION]),
    )

    return V2RecommendationResponse(
        domain_slug=domain_slug,
        status="active",
        recommended_action=V2RecommendedAction(
            concept_slug=selected_node.concept_slug,
            title=selected_node.title,
            tier=selected_node.tier,
            learning_mode=MODE_NAMES[sel_mode],
            reason_vi=reason_vi,
        ),
        policy_source=policy_source,
        state_source=state_source,
        guardrail_applied=guardrail_applied,
        retention_alert=retention_alert,
        checkpoint_sha256=ckpt.sha256,
        node_features_snapshot=snapshot,
    )
