"""API Gateway (Port 8000) routing traffic to 4 isolated Plumora Microservices."""

from __future__ import annotations

import asyncio
import os

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

app = FastAPI(title="Plumora API Gateway", version="2.0.0")
_GATEWAY_CLIENT = httpx.AsyncClient(
    timeout=10.0,
    limits=httpx.Limits(max_connections=100, max_keepalive_connections=50),
)

AUTH_URL = os.environ.get("AUTH_SERVICE_URL", "http://user-auth-service:8001")
CONTENT_URL = os.environ.get("CONTENT_SERVICE_URL", "http://content-kg-service:8002")
ASSESS_URL = os.environ.get("ASSESSMENT_SERVICE_URL", "http://assessment-grader-service:8003")
REC_URL = os.environ.get("RECOMMENDATION_SERVICE_URL", "http://recommendation-ai-service:8004")


def _resolve_upstream(path: str) -> str:
    if path.startswith("/api/v1/auth"):
        return AUTH_URL
    if path.startswith(("/api/v1/roadmap", "/api/v1/concepts", "/api/v2/expert")) or (
        path.startswith("/api/v2/domains")
        and "/placement" not in path
        and "/playbook/complete" not in path
    ):
        return CONTENT_URL
    if path.startswith(("/api/v1/recommendations", "/api/v2/recommendations", "/api/v2/admin")):
        return REC_URL
    return ASSESS_URL


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
    """Reverse-proxy /api/* requests to the responsible microservice, blocking internal routes."""
    full_path = f"/api/{rest}"
    if full_path.startswith("/api/v2/internal") or "/internal/" in full_path:
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
    target_url = f"{upstream}{full_path}"
    if request.url.query:
        target_url = f"{target_url}?{request.url.query}"

    body = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() != "host"}
    resp = await _GATEWAY_CLIENT.request(
        method=request.method,
        url=target_url,
        headers=headers,
        content=body,
    )
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=dict(resp.headers),
    )
