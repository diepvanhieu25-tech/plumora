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
    PolicyGuardrailStrategy,
)
from plumora_rl.inference import NumpyGnnPredictor
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import ModelRegistryModel, RecommendationLogModel
from app.db.redis_pool import get_redis_client
from app.modules.assessment.schemas_v2 import (
    V2PlannedStep,
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
    factors = PedagogicalRationaleBuilder.build_decision_factors(
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
        decision_factors=factors,
    )


def _record_recommendation_log_safe(
    db: Session,
    user_id: uuid.UUID,
    resp: V2RecommendationResponse,
) -> None:
    """Persist v2 audit row into rec_ai_svc.recommendation_logs without disrupting read paths."""
    if not hasattr(db, "add") or not hasattr(db, "commit"):
        return
    try:
        bind = db.get_bind()
        if bind is not None and bind.dialect.name == "postgresql":
            has_tbl = bool(
                db.execute(text("SELECT to_regclass('recommendation_logs') IS NOT NULL")).scalar()
            )
            if not has_tbl:
                return
        act = resp.recommended_action
        db.add(
            RecommendationLogModel(
                id=uuid.uuid4(),
                user_id=user_id,
                domain_slug=resp.domain_slug,
                recommended_concept_slug=act.concept_slug if act is not None else None,
                recommended_mode=act.learning_mode if act is not None else None,
                state_version=1,
                policy_source=resp.policy_source,
                state_source=resp.state_source,
                guardrail_applied=resp.guardrail_applied,
                checkpoint_sha256=resp.checkpoint_sha256 or None,
            )
        )
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        logger.warning("Failed to record v2 recommendation log for user %s: %s", user_id, exc)


def _project_planned_steps(
    *,
    ordered_nodes: list[ConceptNodeDTO],
    obs: GraphObservation,
    ckpt: NumpyGnnPredictor | None,
    first_v: int,
    first_mode: LearningMode,
    max_steps: int = 3,
) -> list[V2PlannedStep]:
    """Project a 3-step adaptive learning path from current state using GNN-PPO + PolicyGuardrail."""
    steps: list[V2PlannedStep] = []
    sim_feats = obs.node_features.copy()
    cur_v, cur_mode = first_v, first_mode

    for step_idx in range(1, max_steps + 1):
        node = ordered_nodes[cur_v]
        est_min, goal_summary = PedagogicalRationaleBuilder.goal_summary_for_mode(cur_mode)
        steps.append(
            V2PlannedStep(
                step_order=step_idx,
                concept_slug=node.concept_slug,
                title=node.title,
                tier=node.tier,
                learning_mode=MODE_NAMES[cur_mode],
                estimated_minutes=est_min,
                goal_summary=goal_summary,
            )
        )
        if step_idx >= max_steps:
            break

        # Advance simulated state cleanly for next step projection
        if cur_mode == LearningMode.SPACED_REVIEW:
            sim_feats[cur_v, NodeFeatureIdx.RETENTION] = 1.0
            sim_feats[cur_v, NodeFeatureIdx.NEEDS_REVIEW] = 0.0
        elif cur_mode == LearningMode.LEARN_NEW:
            sim_feats[cur_v, NodeFeatureIdx.DEPTH_NORM] = max(
                float(sim_feats[cur_v, NodeFeatureIdx.DEPTH_NORM]), 0.50
            )
        elif cur_mode == LearningMode.DEEP_PROBE:
            sim_feats[cur_v, NodeFeatureIdx.DEPTH_NORM] = max(
                float(sim_feats[cur_v, NodeFeatureIdx.DEPTH_NORM]), 0.75
            )
        else:
            sim_feats[cur_v, NodeFeatureIdx.CODE_SCORE] = 1.0
            if float(sim_feats[cur_v, NodeFeatureIdx.DEPTH_NORM]) >= 0.75:
                sim_feats[cur_v, NodeFeatureIdx.DEPTH_NORM] = 1.0
            else:
                sim_feats[cur_v, NodeFeatureIdx.DEPTH_NORM] = max(
                    float(sim_feats[cur_v, NodeFeatureIdx.DEPTH_NORM]), 0.50
                )

        # Recompute eligibility based on simulated depths
        slug_to_idx = {n.concept_slug: i for i, n in enumerate(ordered_nodes)}
        for idx, n in enumerate(ordered_nodes):
            prereqs_ok = all(
                float(sim_feats[slug_to_idx[p], NodeFeatureIdx.DEPTH_NORM]) >= 0.75
                for p in n.prerequisites
                if p in slug_to_idx
            )
            sim_feats[idx, NodeFeatureIdx.IS_ELIGIBLE] = 1.0 if prereqs_ok else 0.0

        depths = sim_feats[:, NodeFeatureIdx.DEPTH_NORM]
        needs_rev = sim_feats[:, NodeFeatureIdx.NEEDS_REVIEW] > 0.5
        if bool(np.all(depths >= 0.75)) and not bool(np.any(needs_rev)):
            break

        sim_obs = GraphObservation(
            node_features=sim_feats,
            adj_in=obs.adj_in,
            adj_out=obs.adj_out,
            node_order=obs.node_order,
            has_code_challenge=obs.has_code_challenge,
        )
        if ckpt is not None:
            nxt_logits = ckpt.predict_logits(sim_obs.node_features, sim_obs.adj_in, sim_obs.adj_out)
            cur_v, nxt_m_int, _, _ = select_guarded_action_from_obs(nxt_logits, sim_obs)
            cur_mode = LearningMode(nxt_m_int)
        else:
            valid_mask = PolicyGuardrailStrategy.compute_valid_action_mask(sim_obs)
            valid_pairs = np.argwhere(valid_mask)
            if len(valid_pairs) == 0:
                break
            cur_v = int(valid_pairs[0][0])
            cur_mode = LearningMode(int(valid_pairs[0][1]))

    return steps


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
        done_resp = V2RecommendationResponse(
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
        _record_recommendation_log_safe(db, user_id, done_resp)
        return done_resp

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
        fb_resp = _fallback_recommendation(
            domain_slug=domain_slug,
            ordered_nodes=ordered_nodes,
            obs=obs,
            comp_map=comp_map,
            state_source=state_source,
            snapshot=snapshot,
        )
        _record_recommendation_log_safe(db, user_id, fb_resp)
        return fb_resp

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
    factors = PedagogicalRationaleBuilder.build_decision_factors(
        target_node=selected_node,
        mode=sel_mode,
        all_nodes=ordered_nodes,
        comp_map=comp_map,
        retention=float(obs.node_features[sel_v, NodeFeatureIdx.RETENTION]),
    )
    planned_steps = _project_planned_steps(
        ordered_nodes=ordered_nodes,
        obs=obs,
        ckpt=ckpt,
        first_v=sel_v,
        first_mode=sel_mode,
    )

    resp = V2RecommendationResponse(
        domain_slug=domain_slug,
        status="active",
        recommended_action=V2RecommendedAction(
            concept_slug=selected_node.concept_slug,
            title=selected_node.title,
            tier=selected_node.tier,
            learning_mode=MODE_NAMES[sel_mode],
            reason_vi=reason_vi,
        ),
        planned_next_steps=planned_steps,
        decision_factors=factors,
        policy_source=policy_source,
        state_source=state_source,
        guardrail_applied=guardrail_applied,
        retention_alert=retention_alert,
        checkpoint_sha256=ckpt.sha256,
        node_features_snapshot=snapshot,
    )
    _record_recommendation_log_safe(db, user_id, resp)
    return resp
