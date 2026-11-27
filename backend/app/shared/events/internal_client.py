"""Internal REST client helpers with keep-alive pool, Redis epoch sync & X-Service-Token (F06, R3-01, REM-03)."""

from __future__ import annotations

import logging
import os
import time
import uuid
from typing import Any

import httpx
import redis

from app.core.config import settings
from app.db.redis_pool import get_redis_client
from app.modules.auth.security import create_internal_service_token

logger = logging.getLogger(__name__)

_HTTP_CLIENT = httpx.Client(
    timeout=3.0,
    limits=httpx.Limits(max_connections=100, max_keepalive_connections=50),
)
_BUNDLE_CACHE: dict[str, tuple[float, int, dict[str, Any]]] = {}
_BUNDLE_TTL_S = 30.0
_SVC_TOKEN_CACHE: tuple[float, str] | None = None

KG_EPOCH_REDIS_KEY = "plumora:kg:epoch"


def _get_service_token() -> str:
    global _SVC_TOKEN_CACHE
    now = time.monotonic()
    if _SVC_TOKEN_CACHE is not None and (now - _SVC_TOKEN_CACHE[0]) < 60.0:
        return _SVC_TOKEN_CACHE[1]
    tok = create_internal_service_token("plumora-internal")
    _SVC_TOKEN_CACHE = (now, tok)
    return tok


def content_service_url() -> str:
    return os.environ.get("CONTENT_SERVICE_URL", "").strip().rstrip("/")


def assessment_service_url() -> str:
    return os.environ.get("ASSESSMENT_SERVICE_URL", "").strip().rstrip("/")


def _get_current_kg_epoch() -> int:
    try:
        client = get_redis_client(settings.redis_url, decode_responses=True, socket_timeout=0.15)
        raw = client.get(KG_EPOCH_REDIS_KEY)
        return int(raw) if raw is not None else 0
    except (redis.RedisError, OSError, ValueError):
        return 0


def bump_kg_cache_epoch(domain_slugs: list[str] | None = None) -> None:
    """Atomically increment Redis KG epoch & delete plumora:kg:* keys for cross-worker cache invalidation."""
    invalidate_bundle_cache(None)
    try:
        client = get_redis_client(settings.redis_url, decode_responses=True, socket_timeout=0.25)
        client.incr(KG_EPOCH_REDIS_KEY)
        if domain_slugs:
            for d_slug in domain_slugs:
                client.delete(f"plumora:kg:{d_slug}")
        else:
            keys_to_del = [
                str(k)
                for k in client.scan_iter(match="plumora:kg:*", count=100)
                if str(k) != KG_EPOCH_REDIS_KEY
            ]
            if keys_to_del:
                client.delete(*keys_to_del)
    except (redis.RedisError, OSError) as exc:
        logger.warning("Failed to bump Redis KG cache epoch: %s", exc)


def _get_json(url: str) -> dict[str, Any] | None:
    try:
        token = _get_service_token()
        resp = _HTTP_CLIENT.get(url, headers={"X-Service-Token": token})
        if resp.status_code == 200:
            return dict(resp.json())
    except (httpx.HTTPError, ValueError):
        return None
    return None


def _post_json(url: str, payload: dict[str, Any] | None = None) -> dict[str, Any] | None:
    try:
        token = _get_service_token()
        resp = _HTTP_CLIENT.post(
            url,
            json=payload or {},
            headers={"X-Service-Token": token},
        )
        if resp.status_code == 200:
            return dict(resp.json())
    except (httpx.HTTPError, ValueError):
        return None
    return None


def fetch_domain_bundle_internal(domain_slug: str) -> dict[str, Any] | None:
    base = content_service_url()
    if not base:
        return None
    now = time.monotonic()
    epoch = _get_current_kg_epoch()
    cached = _BUNDLE_CACHE.get(f"domain:{domain_slug}")
    if cached is not None and cached[1] == epoch and (now - cached[0]) < _BUNDLE_TTL_S:
        return cached[2]
    data = _get_json(f"{base}/api/v2/internal/domains/{domain_slug}/bundle")
    if data is not None:
        _BUNDLE_CACHE[f"domain:{domain_slug}"] = (now, epoch, data)
    return data


def fetch_concept_bundle_internal(concept_slug: str) -> dict[str, Any] | None:
    base = content_service_url()
    if not base:
        return None
    now = time.monotonic()
    epoch = _get_current_kg_epoch()
    cached = _BUNDLE_CACHE.get(f"concept:{concept_slug}")
    if cached is not None and cached[1] == epoch and (now - cached[0]) < _BUNDLE_TTL_S:
        return cached[2]
    data = _get_json(f"{base}/api/v2/internal/concepts/{concept_slug}/bundle")
    if data is not None:
        _BUNDLE_CACHE[f"concept:{concept_slug}"] = (now, epoch, data)
    return data


def invalidate_bundle_cache(domain_slug: str | None = None) -> None:
    """Invalidate in-memory bundle cache for a specific domain or all entries."""
    if domain_slug is None:
        _BUNDLE_CACHE.clear()
        return
    _BUNDLE_CACHE.pop(f"domain:{domain_slug}", None)
    for key in [k for k in _BUNDLE_CACHE if k.startswith("concept:")]:
        _BUNDLE_CACHE.pop(key, None)


def fetch_user_competencies_payload_internal(user_id: uuid.UUID) -> dict[str, Any] | None:
    """Fetch full internal competencies payload including state_version & completed_placement_domains."""
    base = assessment_service_url()
    if not base:
        return None
    return _get_json(f"{base}/api/v2/internal/users/{user_id}/competencies")


def fetch_user_competencies_internal(user_id: uuid.UUID) -> list[dict[str, Any]] | None:
    data = fetch_user_competencies_payload_internal(user_id)
    if data is not None:
        return list(data.get("competencies", []))
    return None


def fetch_cohort_analytics_data_internal(concept_slugs: list[str]) -> dict[str, Any] | None:
    """Fetch competency and bottleneck session rows for Cohort Analytics from assessment-grader-service."""
    base = assessment_service_url()
    if not base:
        return None
    return _post_json(
        f"{base}/api/v2/internal/analytics/cohort",
        {"concept_slugs": concept_slugs},
    )


def fetch_all_outbox_pending_internal() -> tuple[int, dict[str, int]] | None:
    """Aggregate pending outbox count & breakdown by event_type across assessment & content services."""
    targets = [u for u in (assessment_service_url(), content_service_url()) if u]
    if not targets:
        return None

    total = 0
    by_type: dict[str, int] = {
        "CompetencyUpdatedEvent": 0,
        "DomainGraphUpdatedEvent": 0,
    }
    any_ok = False
    for base in targets:
        data = _get_json(f"{base}/api/v2/internal/outbox/pending-count")
        if data is not None and "pending_count" in data:
            any_ok = True
            total += int(data["pending_count"])
            raw_by = data.get("by_event_type")
            if isinstance(raw_by, dict):
                for ev_t, cnt in raw_by.items():
                    by_type[str(ev_t)] = by_type.get(str(ev_t), 0) + int(cnt)
    if not any_ok:
        return None
    return total, by_type


def fetch_outbox_pending_count_internal() -> int | None:
    res = fetch_all_outbox_pending_internal()
    return res[0] if res is not None else None


def trigger_remote_outbox_relays_internal() -> int:
    """Trigger immediate outbox relay on assessment-grader-service and content-kg-service."""
    relayed_total = 0
    for base in (assessment_service_url(), content_service_url()):
        if not base:
            continue
        data = _post_json(f"{base}/api/v2/internal/outbox/relay")
        if data is not None and "relayed" in data:
            relayed_total += int(data["relayed"])
    return relayed_total
