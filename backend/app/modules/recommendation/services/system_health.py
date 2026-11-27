"""Admin System Health probe, Outbox manual relay, Redis Streams DLQ & RL Analytics."""

from __future__ import annotations

import logging
import os
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from typing import Any

import redis
from sqlalchemy import func, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import REPO_ROOT, settings
from app.db.models import (
    OutboxEventModel,
)
from app.db.redis_pool import get_redis_client
from app.modules.recommendation.gnn_loader import load_verified_gnn_checkpoint
from app.modules.recommendation.repository import RecommendationRepository
from app.shared.events.internal_client import (
    assessment_service_url,
    content_service_url,
    fetch_all_outbox_pending_internal,
    trigger_remote_outbox_relays_internal,
)
from app.shared.events.outbox import (
    consume_competency_stream_once,
    consume_domain_events_stream_once,
    run_outbox_relay_and_consume_once,
)

logger = logging.getLogger(__name__)

_CFG_CKPT_PATH = Path(settings.rl_checkpoint_path)
BASE_CKPT_PATH = (
    _CFG_CKPT_PATH
    if _CFG_CKPT_PATH.exists()
    else REPO_ROOT / "rl" / "artifacts" / "gnn_ppo_v2_base.zip"
)
WORKER_HEARTBEAT_KEY = "plumora:worker:rec_ai_cg"
COMPETENCY_STREAM_NAME = "plumora:competency_events"
DOMAIN_STREAM_NAME = "plumora:stream:domain_events"


def trigger_manual_outbox_relay(db: Session) -> dict[str, Any]:
    """Admin-triggered immediate outbox relay across assessment+content & Redis Streams consume."""
    if assessment_service_url() or content_service_url():
        remote_relayed = trigger_remote_outbox_relays_internal()
        comp_stats = consume_competency_stream_once(db)
        dom_stats = consume_domain_events_stream_once(db, consumer_group="rec_ai_domain_cg")
        return {
            "status": "ok",
            "relayed": remote_relayed,
            **comp_stats,
            "domain_events_consumed": dom_stats["consumed"],
        }
    stats = run_outbox_relay_and_consume_once(db)
    return {
        "status": "ok",
        **stats,
    }


def get_streams_dlq_entries(*, limit: int = 50) -> dict[str, Any]:
    """Read Dead-Letter Queue entries from Redis Streams."""
    dlq_streams = [f"{COMPETENCY_STREAM_NAME}:dlq", f"{DOMAIN_STREAM_NAME}:dlq"]
    entries: list[dict[str, Any]] = []
    try:
        client = get_redis_client(decode_responses=True, socket_timeout=0.5)
        for s_name in dlq_streams:
            try:
                raw_msgs = client.xrevrange(s_name, max="+", min="-", count=limit)
                if isinstance(raw_msgs, list):
                    for msg_id, fields in raw_msgs:
                        entries.append(
                            {
                                "stream": s_name,
                                "msg_id": str(msg_id),
                                "fields": dict(fields) if isinstance(fields, dict) else {},
                            }
                        )
            except redis.ResponseError:
                continue
    except (redis.RedisError, OSError) as exc:
        logger.warning("Failed to read DLQ streams from Redis: %s", exc)
        return {"redis_connected": False, "dlq_count": 0, "entries": []}

    return {
        "redis_connected": True,
        "dlq_count": len(entries),
        "entries": entries[:limit],
    }


def _probe_http_health(url: str) -> str:
    if not url.startswith(("http://", "https://")):
        return "down"
    try:
        with urllib.request.urlopen(url, timeout=0.5) as resp:  # noqa: S310
            return "up" if 200 <= resp.status < 300 else "degraded"
    except (urllib.error.URLError, OSError, ValueError):
        return "down"


def get_system_health_status(db: Session) -> dict[str, Any]:
    """Return honest probed status of PostgreSQL/SQLite, Redis, RL Checkpoint, Outbox, DLQ & 4 services."""
    pg_ok = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        pg_ok = False

    pending_outbox = -1
    outbox_by_event_type: dict[str, int] = {
        "CompetencyUpdatedEvent": 0,
        "DomainGraphUpdatedEvent": 0,
    }
    if assessment_service_url() or content_service_url():
        ext_outbox = fetch_all_outbox_pending_internal()
        if ext_outbox is not None:
            pending_outbox, outbox_by_event_type = ext_outbox
        else:
            pending_outbox = -1
    else:
        try:
            pending_outbox = int(
                db.scalar(
                    select(func.count())
                    .select_from(OutboxEventModel)
                    .where(OutboxEventModel.published_at.is_(None))
                )
                or 0
            )
            ev_rows = db.execute(
                select(OutboxEventModel.event_type, func.count())
                .where(OutboxEventModel.published_at.is_(None))
                .group_by(OutboxEventModel.event_type)
            ).all()
            for ev_type, cnt in ev_rows:
                outbox_by_event_type[str(ev_type)] = int(cnt)
        except SQLAlchemyError:
            db.rollback()
            ext_outbox = fetch_all_outbox_pending_internal()
            if ext_outbox is not None:
                pending_outbox, outbox_by_event_type = ext_outbox
            else:
                pending_outbox = -1

    bind = db.get_bind()
    db_dialect = str(bind.dialect.name) if bind is not None else "unknown"
    schemas_isolated = False
    if db_dialect == "postgresql":
        rows = db.execute(
            text(
                "SELECT nspname FROM pg_catalog.pg_namespace "
                "WHERE nspname IN ('auth_svc', 'content_svc', 'assess_svc', 'rec_ai_svc')"
            )
        ).scalars().all()
        public_app_tables = db.execute(
            text(
                "SELECT count(*) FROM pg_catalog.pg_class c "
                "JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace "
                "WHERE n.nspname = 'public' AND c.relkind = 'r' "
                "AND c.relname IN ('users', 'domains', 'concepts', 'assessment_sessions', 'model_registry')"
            )
        ).scalar()
        svc_roles = db.execute(
            text(
                "SELECT count(*) FROM pg_catalog.pg_roles "
                "WHERE rolname IN ('auth_svc_user', 'content_svc_user', 'assess_svc_user', 'rec_ai_svc_user')"
            )
        ).scalar()
        priv_ok = db.execute(
            text(
                "SELECT NOT has_schema_privilege('assess_svc_user', 'content_svc', 'USAGE') "
                "AND NOT has_schema_privilege('rec_ai_svc_user', 'assess_svc', 'USAGE') "
                "AND NOT has_schema_privilege('content_svc_user', 'auth_svc', 'USAGE')"
            )
        ).scalar()
        schemas_isolated = (
            len(set(rows)) == 4
            and int(public_app_tables or 0) == 0
            and int(svc_roles or 0) == 4
            and bool(priv_ok)
        )

    redis_ok = False
    cache_hit_rate = 0.0
    consumer_group_active = False
    redis_stream_pending = -1
    redis_lag_ms: float | None = None
    c2c_last_ms: float | None = None
    c2c_p95_ms: float | None = None
    c2c_samples = 0
    pending_age_ms: float | None = None
    dlq_count = 0
    stream_lengths: dict[str, int] = {
        "CompetencyUpdatedEvent": 0,
        "DomainGraphUpdatedEvent": 0,
    }
    try:
        client = get_redis_client(decode_responses=True, socket_timeout=0.5)
        redis_ok = bool(client.ping())
        if redis_ok:
            hits = int(client.get("plumora:metrics:kg_cache_hits") or 0)
            misses = int(client.get("plumora:metrics:kg_cache_misses") or 0)
            if hits + misses > 0:
                cache_hit_rate = round(hits / (hits + misses), 4)
            last_c2c = client.get("plumora:metrics:last_commit_to_consume_ms")
            if last_c2c is not None:
                c2c_last_ms = round(float(last_c2c), 2)
                redis_lag_ms = c2c_last_ms
            raw_samples = client.lrange("plumora:metrics:commit_to_consume_samples", 0, 199)
            if raw_samples:
                vals = sorted(float(x) for x in raw_samples)
                c2c_samples = len(vals)
                p95_idx = min(c2c_samples - 1, max(0, int(0.95 * (c2c_samples - 1))))
                c2c_p95_ms = round(vals[p95_idx], 2)

            try:
                stream_lengths["CompetencyUpdatedEvent"] = int(client.xlen(COMPETENCY_STREAM_NAME))
            except redis.ResponseError:
                stream_lengths["CompetencyUpdatedEvent"] = 0
            try:
                stream_lengths["DomainGraphUpdatedEvent"] = int(client.xlen(DOMAIN_STREAM_NAME))
            except redis.ResponseError:
                stream_lengths["DomainGraphUpdatedEvent"] = 0
            for dlq_s in (f"{COMPETENCY_STREAM_NAME}:dlq", f"{DOMAIN_STREAM_NAME}:dlq"):
                try:
                    dlq_count += int(client.xlen(dlq_s))
                except redis.ResponseError:
                    continue

            try:
                groups = client.xinfo_groups(COMPETENCY_STREAM_NAME)
                worker_alive = bool(client.exists(WORKER_HEARTBEAT_KEY))
                if groups and worker_alive:
                    consumer_group_active = True
                    redis_stream_pending = sum(
                        int(g.get("pending", 0) or 0) + int(g.get("lag", 0) or 0)
                        for g in groups
                    )
                    pending_summary = client.xpending(COMPETENCY_STREAM_NAME, "rec_ai_cg")
                    oldest_id = (
                        pending_summary.get("min")
                        if isinstance(pending_summary, dict)
                        else None
                    )
                    if oldest_id and "-" in str(oldest_id):
                        msg_ts_ms = int(str(oldest_id).split("-", 1)[0])
                        pending_age_ms = round(max(0.0, time.time() * 1000.0 - msg_ts_ms), 2)
                        redis_lag_ms = pending_age_ms
                    elif redis_lag_ms is None:
                        redis_lag_ms = 0.0
                else:
                    redis_stream_pending = -1
            except redis.ResponseError:
                consumer_group_active = False
                redis_stream_pending = -1
    except (redis.RedisError, OSError):
        redis_ok = False
        redis_stream_pending = -1
        redis_lag_ms = -1.0

    if redis_lag_ms is None:
        redis_lag_ms = -1.0 if not redis_ok else 0.0

    ckpt_ok = load_verified_gnn_checkpoint() is not None

    svc_urls = {
        "auth": os.getenv("AUTH_SERVICE_URL", "").strip(),
        "content_kg": os.getenv("CONTENT_SERVICE_URL", "").strip(),
        "assessment_grader": (
            os.getenv("ASSESSMENT_SERVICE_URL", "").strip()
            or os.getenv("ASSESS_SERVICE_URL", "").strip()
        ),
        "recommendation_ai": (
            os.getenv("RECOMMENDATION_SERVICE_URL", "").strip()
            or os.getenv("REC_AI_SERVICE_URL", "").strip()
        ),
    }
    has_external_services = any(svc_urls.values())
    deployment_mode = "microservices" if has_external_services else "monolith"

    if has_external_services:
        services_status = {
            name: (_probe_http_health(f"{url.rstrip('/')}/health") if url else "down")
            for name, url in svc_urls.items()
        }
    else:
        services_status = {
            "auth": "in_process" if pg_ok else "down",
            "content_kg": "in_process" if pg_ok else "down",
            "assessment_grader": "in_process" if pg_ok else "down",
            "recommendation_ai": "in_process" if (pg_ok and ckpt_ok) else "degraded",
        }

    return {
        "mode": deployment_mode,
        "db_dialect": db_dialect,
        "services": services_status,
        "postgres_connected": pg_ok,
        "rl_checkpoint_verified": ckpt_ok,
        "schemas_isolated": schemas_isolated,
        "outbox_pending_count": pending_outbox,
        "outbox_pending_by_event_type": outbox_by_event_type,
        "stream_lengths_by_event_type": stream_lengths,
        "dlq_count": dlq_count,
        "redis_connected": redis_ok,
        "redis_stream_lag_ms": redis_lag_ms,
        "redis_stream_pending_age_ms": pending_age_ms,
        "outbox_commit_to_consume_last_ms": c2c_last_ms,
        "outbox_commit_to_consume_p95_ms": c2c_p95_ms,
        "outbox_commit_to_consume_samples": c2c_samples,
        "consumer_group_active": consumer_group_active,
        "redis_stream_pending": redis_stream_pending,
        "graph_cache_hit_rate": cache_hit_rate,
    }


def get_admin_rl_analytics(
    db: Session,
    *,
    domain_slug: str | None = None,
    user_id: uuid.UUID | None = None,
    limit: int = 30,
) -> dict[str, Any]:
    """Aggregate live production RL recommendation logs for Admin RL Observability Dashboard (D-40)."""
    rows = RecommendationRepository(db).list_recent_recommendation_logs(
        domain_slug=domain_slug,
        user_id=user_id,
        limit=1000,
    )
    total = len(rows)

    guardrail_cnt = sum(1 for r in rows if r.guardrail_applied)
    fallback_cnt = sum(1 for r in rows if "fallback" in (r.policy_source or "").lower())
    redis_hit_cnt = sum(1 for r in rows if (r.state_source or "").startswith("redis"))

    mode_counts: dict[str, int] = {}
    domain_counts: dict[str, int] = {}
    concept_counts: dict[str, int] = {}
    policy_counts: dict[str, int] = {}

    for r in rows:
        mode = r.recommended_mode or "completed"
        mode_counts[mode] = mode_counts.get(mode, 0) + 1
        dom = r.domain_slug or "unknown"
        domain_counts[dom] = domain_counts.get(dom, 0) + 1
        if r.recommended_concept_slug:
            concept_counts[r.recommended_concept_slug] = (
                concept_counts.get(r.recommended_concept_slug, 0) + 1
            )
        ps = r.policy_source or "unknown"
        policy_counts[ps] = policy_counts.get(ps, 0) + 1

    by_mode = [
        {"mode": k, "count": v, "share_pct": round((v / total) * 100.0, 1) if total else 0.0}
        for k, v in sorted(mode_counts.items(), key=lambda kv: (-kv[1], kv[0]))
    ]
    by_domain = [
        {"domain_slug": k, "count": v, "share_pct": round((v / total) * 100.0, 1) if total else 0.0}
        for k, v in sorted(domain_counts.items(), key=lambda kv: (-kv[1], kv[0]))
    ]
    top_concepts = [
        {"concept_slug": k, "count": v, "share_pct": round((v / total) * 100.0, 1) if total else 0.0}
        for k, v in sorted(concept_counts.items(), key=lambda kv: (-kv[1], kv[0]))[:10]
    ]
    recent_decisions = [
        {
            "id": str(r.id),
            "user_id": str(r.user_id),
            "domain_slug": r.domain_slug,
            "recommended_concept_slug": r.recommended_concept_slug,
            "recommended_mode": r.recommended_mode,
            "policy_source": r.policy_source,
            "state_source": r.state_source,
            "guardrail_applied": bool(r.guardrail_applied),
            "checkpoint_sha256": r.checkpoint_sha256 or "",
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows[: max(1, min(limit, 100))]
    ]

    return {
        "total_recommendations": total,
        "guardrail_intervention_rate": round(guardrail_cnt / total, 4) if total else 0.0,
        "fallback_rate": round(fallback_cnt / total, 4) if total else 0.0,
        "redis_cache_hit_rate": round(redis_hit_cnt / total, 4) if total else 0.0,
        "policy_source_counts": policy_counts,
        "by_mode": by_mode,
        "by_domain": by_domain,
        "top_concepts": top_concepts,
        "recent_decisions": recent_decisions,
    }
