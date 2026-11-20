"""API Gateway (Port 8000) routing traffic to 4 isolated Plumora Microservices."""

from __future__ import annotations

import os

import httpx
from fastapi import FastAPI, Request, Response

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
        path.startswith("/api/v2/domains") and "/placement" not in path
    ):
        return CONTENT_URL
    if path.startswith(("/api/v1/recommendations", "/api/v2/recommendations", "/api/v2/admin")):
        return REC_URL
    return ASSESS_URL


@app.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_api(request: Request, rest: str) -> Response:
    """Reverse-proxy /api/* requests to the responsible microservice."""
    full_path = f"/api/{rest}"
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
