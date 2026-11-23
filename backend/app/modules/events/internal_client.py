"""Internal REST client helpers with persistent keep-alive pool & signed X-Service-Token (F06, R3-01, R3-09)."""

from __future__ import annotations

import os
import time
import uuid
from typing import Any

import httpx

from app.modules.auth.security import create_internal_service_token

_HTTP_CLIENT = httpx.Client(
    timeout=2.0,
    limits=httpx.Limits(max_connections=100, max_keepalive_connections=50),
)
_BUNDLE_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_BUNDLE_TTL_S = 30.0
_SVC_TOKEN_CACHE: tuple[float, str] | None = None


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


def _get_json(url: str) -> dict[str, Any] | None:
    try:
        token = _get_service_token()
        resp = _HTTP_CLIENT.get(url, headers={"X-Service-Token": token})
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
    cached = _BUNDLE_CACHE.get(f"domain:{domain_slug}")
    if cached is not None and (now - cached[0]) < _BUNDLE_TTL_S:
        return cached[1]
    data = _get_json(f"{base}/api/v2/internal/domains/{domain_slug}/bundle")
    if data is not None:
        _BUNDLE_CACHE[f"domain:{domain_slug}"] = (now, data)
    return data


def fetch_concept_bundle_internal(concept_slug: str) -> dict[str, Any] | None:
    base = content_service_url()
    if not base:
        return None
    now = time.monotonic()
    cached = _BUNDLE_CACHE.get(f"concept:{concept_slug}")
    if cached is not None and (now - cached[0]) < _BUNDLE_TTL_S:
        return cached[1]
    data = _get_json(f"{base}/api/v2/internal/concepts/{concept_slug}/bundle")
    if data is not None:
        _BUNDLE_CACHE[f"concept:{concept_slug}"] = (now, data)
    return data


def invalidate_bundle_cache(domain_slug: str | None = None) -> None:
    """Invalidate in-memory bundle cache for a specific domain or all entries."""
    if domain_slug is None:
        _BUNDLE_CACHE.clear()
        return
    _BUNDLE_CACHE.pop(f"domain:{domain_slug}", None)
    # Also evict concept caches since shared concepts may have changed
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


def fetch_outbox_pending_count_internal() -> int | None:
    base = assessment_service_url()
    if not base:
        return None
    data = _get_json(f"{base}/api/v2/internal/outbox/pending-count")
    if data is not None and "pending_count" in data:
        return int(data["pending_count"])
    return None
