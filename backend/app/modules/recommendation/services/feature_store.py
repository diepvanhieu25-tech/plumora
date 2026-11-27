"""Time-Aware Redis Feature Store, Active Model Pointer & Recommendation Audit Logging."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime
from typing import Any

import redis
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import RecommendationLogModel
from app.db.redis_pool import get_redis_client
from app.modules.assessment.schemas_v2 import (
    V2RecommendationResponse,
)
from app.modules.recommendation.repository import RecommendationRepository
from app.shared.contracts.dtos import (
    DomainTopologyDTO,
    UserCompetencySnapshotDTO,
    UserNodeCompetencyDTO,
)
from app.shared.contracts.ports import CompetencyReaderPort

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

    active_model = RecommendationRepository(db).get_active_model()
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


