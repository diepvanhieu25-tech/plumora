"""API Gateway (Port 8000) routing traffic to 4 isolated Plumora Microservices."""

from __future__ import annotations

import asyncio
import os
import posixpath
from collections.abc import Awaitable, Callable
from http.cookiejar import CookieJar
from typing import Any
from urllib.parse import unquote

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings


class _StatelessNoOpCookieJar(CookieJar):
    """Prevent shared reverse-proxy client from storing or bleeding upstream session cookies across users."""

    def extract_cookies(self, response: Any, request: Any) -> None:
        return None

    def add_cookie_header(self, request: Any) -> None:
        return None


def build_gateway_http_client(
    transport: httpx.AsyncBaseTransport | None = None,
) -> httpx.AsyncClient:
    """Create a connection-pooled, cookie-stateless httpx.AsyncClient for API Gateway proxying."""
    client = httpx.AsyncClient(
        timeout=30.0,
        limits=httpx.Limits(max_connections=200, max_keepalive_connections=80),
        transport=transport,
    )
    client.cookies.jar = _StatelessNoOpCookieJar()
    return client


app = FastAPI(
    title="Plumora API Gateway",
    version="3.1.0",
    description="Unified BFF / Reverse-Proxy Gateway for Plumora 4-Microservice Architecture",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-CSRF-Token", "Idempotency-Key"],
)

_GATEWAY_CLIENT = build_gateway_http_client()

_HOP_BY_HOP_HEADERS: frozenset[str] = frozenset(
    {
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "transfer-encoding",
        "upgrade",
        "content-length",
        "content-encoding",
    }
)

AUTH_URL = os.environ.get("AUTH_SERVICE_URL", "http://user-auth-service:8001")
CONTENT_URL = os.environ.get("CONTENT_SERVICE_URL", "http://content-kg-service:8002")
ASSESS_URL = os.environ.get("ASSESSMENT_SERVICE_URL", "http://assessment-grader-service:8003")
REC_URL = os.environ.get("RECOMMENDATION_SERVICE_URL", "http://recommendation-ai-service:8004")


@app.middleware("http")
async def security_headers_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """Attach mandatory security headers; allow Swagger UI assets strictly on /docs and /redoc."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Cache-Control"] = "no-store"
    if request.url.path in ("/docs", "/docs/oauth2-redirect", "/redoc"):
        # TODO(security): Self-host Swagger UI bundle to eliminate cdn.jsdelivr.net & unsafe-inline on /docs.
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "img-src 'self' data: https://fastapi.tiangolo.com; "
            "frame-ancestors 'self'; object-src 'none'"
        )
    else:
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; frame-ancestors 'self'; object-src 'none'"
        )
    return response


def _resolve_upstream(path: str) -> str | None:
    """Route /api/v1/auth/* and /api/v2/* to their owning microservice; reject removed v1 routes."""
    if path.startswith("/api/v1/auth"):
        return AUTH_URL
    if path.startswith("/api/v1/"):
        return None
    if path.startswith("/api/v2/expert") or (
        path.startswith("/api/v2/domains")
        and "/placement" not in path
        and "/playbook/complete" not in path
    ):
        return CONTENT_URL
    if path.startswith(("/api/v2/recommendations", "/api/v2/admin")):
        return REC_URL
    if path.startswith(("/api/v2/assessments", "/api/v2/concepts", "/api/v2/domains")):
        return ASSESS_URL
    return None


async def _probe_service(url: str) -> str:
    try:
        resp = await _GATEWAY_CLIENT.get(f"{url.rstrip('/')}/health", timeout=2.0)
        return "up" if 200 <= resp.status_code < 300 else "degraded"
    except httpx.HTTPError:
        return "down"


@app.get("/api/v1/health")
async def aggregated_health() -> JSONResponse:
    """Aggregate downstream microservice health probes at the API Gateway edge."""
    probes = await asyncio.gather(
        _probe_service(AUTH_URL),
        _probe_service(CONTENT_URL),
        _probe_service(ASSESS_URL),
        _probe_service(REC_URL),
    )
    services_status = {
        "auth": probes[0],
        "content_kg": probes[1],
        "assessment_grader": probes[2],
        "recommendation_ai": probes[3],
    }
    overall = "ok" if all(v == "up" for v in services_status.values()) else "degraded"
    return JSONResponse(
        status_code=200 if overall == "ok" else 503,
        content={
            "status": overall,
            "mode": "microservices",
            "services": services_status,
        },
    )


@app.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_api(request: Request, rest: str) -> Response:
    """Reverse-proxy /api/* requests to the responsible microservice, preserving multi Set-Cookie headers."""
    raw_path_bytes = request.scope.get("raw_path")
    raw_path_str = (
        raw_path_bytes.decode("latin-1", errors="replace")
        if isinstance(raw_path_bytes, (bytes, bytearray))
        else request.url.path
    )
    raw_no_query = raw_path_str.split("?", 1)[0]
    decoded_once = unquote(raw_no_query)
    fully_decoded = decoded_once
    for _ in range(4):
        nxt = unquote(fully_decoded)
        if nxt == fully_decoded:
            break
        fully_decoded = nxt

    # Block multi-layer percent-encoding (%25...), path traversal, backslashes, or control chars before routing
    segments = [seg for seg in fully_decoded.split("/") if seg]
    rest_segments = [seg for seg in rest.split("/") if seg]
    if (
        "%" in decoded_once
        or "%" in rest
        or "\\" in fully_decoded
        or any(ord(ch) < 32 for ch in fully_decoded)
        or any(seg in (".", "..") for seg in segments)
        or any(seg in (".", "..") for seg in rest_segments)
    ):
        return JSONResponse(
            status_code=400,
            content={
                "detail": {
                    "error_code": "INVALID_PATH",
                    "message": "Path traversal or multi-encoded path segments are not allowed.",
                }
            },
        )

    full_path = posixpath.normpath(f"/api/{rest.lstrip('/')}")
    if not full_path.startswith("/api/"):
        return JSONResponse(
            status_code=400,
            content={
                "detail": {
                    "error_code": "INVALID_PATH",
                    "message": "Normalized path must stay within /api/.",
                }
            },
        )

    norm_segments = [seg for seg in full_path.split("/") if seg]
    if any(seg.lower() == "internal" for seg in norm_segments) or full_path.lower().startswith(
        "/api/v2/internal"
    ):
        return JSONResponse(
            status_code=403,
            content={
                "detail": {
                    "error_code": "INTERNAL_ENDPOINT_FORBIDDEN",
                    "message": "Internal endpoints are not publicly accessible.",
                }
            },
        )
    upstream = _resolve_upstream(full_path)
    if upstream is None:
        return JSONResponse(
            status_code=404,
            content={
                "detail": {
                    "error_code": "ROUTE_NOT_FOUND",
                    "message": f"API route '{full_path}' does not exist.",
                }
            },
        )

    target_url = f"{upstream}{full_path}"
    if request.url.query:
        target_url = f"{target_url}?{request.url.query}"

    body = await request.body()
    req_headers = [
        (k, v)
        for k, v in request.headers.raw
        if k.decode("latin-1").lower() not in {"host", "content-length"}
    ]
    try:
        resp = await _GATEWAY_CLIENT.request(
            method=request.method,
            url=target_url,
            headers=req_headers,
            content=body,
        )
    except httpx.TimeoutException:
        return JSONResponse(
            status_code=504,
            content={
                "detail": {
                    "error_code": "UPSTREAM_TIMEOUT",
                    "message": "Upstream microservice timed out.",
                }
            },
        )
    except httpx.HTTPError:
        return JSONResponse(
            status_code=502,
            content={
                "detail": {
                    "error_code": "UPSTREAM_UNAVAILABLE",
                    "message": "Upstream microservice is temporarily unavailable.",
                }
            },
        )

    out = Response(content=resp.content, status_code=resp.status_code)
    for k, v in resp.headers.multi_items():
        if k.lower() not in _HOP_BY_HOP_HEADERS:
            out.headers.append(k, v)
    return out
