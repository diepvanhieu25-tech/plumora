"""Shared microservice runtime wiring: middleware, global handlers, and Liveness/Readiness probes."""

from __future__ import annotations

import redis
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.observability import configure_json_logging
from app.db.redis_pool import get_redis_client
from app.db.session import SessionLocal
from app.middleware import register_exception_handlers, register_request_id_middleware


def _probe_postgres() -> bool:
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        return True
    except (SQLAlchemyError, OSError):
        return False


def _probe_redis() -> bool:
    try:
        client = get_redis_client(settings.redis_url, decode_responses=True, socket_timeout=0.3)
        return bool(client.ping())
    except (redis.RedisError, OSError):
        return False


def register_common_middleware_and_handlers(app: FastAPI, *, service_name: str) -> None:
    """Configure JSON logging, X-Request-ID middleware, and standardized 422/500 handlers."""
    configure_json_logging(service_name)
    register_request_id_middleware(app)
    register_exception_handlers(app)


def register_health_routes(
    app: FastAPI,
    *,
    service_name: str,
    schema_name: str,
    check_rl_checkpoint: bool = False,
) -> None:
    """Register /health/live, /health (alias), and /health/ready checking PostgreSQL + Redis."""

    @app.get("/health/live")
    @app.get("/health")
    def health_live() -> dict[str, str]:
        return {"service": service_name, "schema": schema_name, "status": "up"}

    @app.get("/health/ready")
    def health_ready() -> JSONResponse:
        pg_ok = _probe_postgres()
        redis_ok = _probe_redis()
        payload: dict[str, str | bool] = {
            "service": service_name,
            "schema": schema_name,
            "postgres": "up" if pg_ok else "down",
            "redis": "up" if redis_ok else "down",
        }
        if check_rl_checkpoint:
            from app.modules.recommendation.gnn_loader import load_verified_gnn_checkpoint

            payload["rl_checkpoint_verified"] = load_verified_gnn_checkpoint() is not None
        if not pg_ok:
            payload["status"] = "down"
            return JSONResponse(status_code=503, content=payload)
        payload["status"] = "ok" if redis_ok else "degraded"
        return JSONResponse(status_code=200, content=payload)
