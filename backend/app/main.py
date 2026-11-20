"""FastAPI application entrypoint and infrastructure health probe for Plumora."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager, suppress
from pathlib import Path

import redis
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.db.models import SessionLocal
from app.modules.assessment.router_v2 import router as assessment_v2_router
from app.modules.auth import router as auth_router
from app.modules.content import init_db_and_seed
from app.modules.content.router_expert import router as expert_v2_router
from app.modules.content.router_v2 import router as content_kg_router
from app.modules.events.outbox import run_outbox_relay_and_consume_once
from app.modules.recommendation.router_admin import router as admin_v2_router

_DB_INITIALIZED = False


def ensure_db_initialized() -> None:
    """Idempotently initialize PostgreSQL tables and seed data once per process."""
    global _DB_INITIALIZED
    if not _DB_INITIALIZED:
        init_db_and_seed()
        _DB_INITIALIZED = True


async def _outbox_background_worker() -> None:
    """Periodically relay outbox events to Redis Streams and consume CompetencyUpdatedEvent."""
    log = logging.getLogger(__name__)
    while True:
        try:
            with SessionLocal() as db:
                run_outbox_relay_and_consume_once(db)
        except Exception as exc:  # noqa: BLE001
            log.debug("Outbox worker iteration skipped: %s", exc)
        await asyncio.sleep(2.0)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Initialize PostgreSQL schema, seed data, and run background outbox/stream worker."""
    ensure_db_initialized()
    worker_task = asyncio.create_task(_outbox_background_worker())
    try:
        yield
    finally:
        worker_task.cancel()
        with suppress(asyncio.CancelledError):
            await worker_task


app = FastAPI(
    title="Plumora API",
    version="2.0.0",
    description="Adaptive Multi-Domain Learning Path & 5-Depth Assessment Platform using GNN-PPO",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization", "X-CSRF-Token", "Idempotency-Key"],
)

app.include_router(auth_router)
app.include_router(content_kg_router)
app.include_router(assessment_v2_router)
app.include_router(expert_v2_router)
app.include_router(admin_v2_router)


@app.middleware("http")
async def security_headers_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """Ensure DB is seeded and attach mandatory security headers to every HTTP response."""
    ensure_db_initialized()
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; frame-ancestors 'self'; object-src 'none'"
    )
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Cache-Control"] = "no-store"
    return response


def _check_postgres() -> str:
    """Verify live PostgreSQL SSoT connection."""
    engine = create_engine(settings.database_url, pool_pre_ping=True)
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    engine.dispose()
    return "up"


def _check_redis() -> str:
    """Verify live Redis State Cache connection."""
    client: redis.Redis = redis.Redis.from_url(
        settings.redis_url,
        socket_connect_timeout=0.5,
        socket_timeout=0.5,
    )
    try:
        if client.ping():
            return "up"
        return "down"
    except redis.RedisError:
        return "down"
    finally:
        client.close()


def _resolve_repo_path(raw_path: str) -> Path:
    """Resolve a path directly or relative to the repository root."""
    candidate = Path(raw_path)
    if candidate.exists():
        return candidate
    repo_root = Path(__file__).resolve().parents[2]
    return repo_root / raw_path


def _check_rl_checkpoint() -> dict[str, bool | str | None]:
    """Verify RL checkpoint existence and SHA-256 integrity if present."""
    ckpt_path = _resolve_repo_path(settings.rl_checkpoint_path)
    manifest_path = _resolve_repo_path(settings.rl_manifest_path)
    if not ckpt_path.exists() or not manifest_path.exists():
        return {"loaded": False, "sha256_verified": False, "sha256": None}
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        expected_sha = str(manifest.get("checkpoint_sha256", ""))
        actual_sha = hashlib.sha256(ckpt_path.read_bytes()).hexdigest()
        verified = bool(expected_sha) and (actual_sha == expected_sha)
        return {
            "loaded": verified,
            "sha256_verified": verified,
            "sha256": actual_sha if verified else None,
        }
    except (OSError, ValueError, KeyError):
        return {"loaded": False, "sha256_verified": False, "sha256": None}


@app.get("/api/v1/health")
def get_health() -> JSONResponse:
    """Health check endpoint verifying PostgreSQL SSoT, Redis Cache, and RL Checkpoint."""
    try:
        pg_status = _check_postgres()
    except (SQLAlchemyError, OSError):
        return JSONResponse(
            status_code=503,
            content={
                "error_code": "DATABASE_UNAVAILABLE",
                "message": "PostgreSQL Single Source of Truth is unavailable.",
                "details": {"postgres": "down"},
            },
        )

    redis_status = _check_redis()
    rl_status = _check_rl_checkpoint()
    overall = "ok" if (pg_status == "up" and redis_status == "up") else "degraded"
    return JSONResponse(
        status_code=200,
        content={
            "status": overall,
            "postgres": pg_status,
            "redis": redis_status,
            "rl_checkpoint": rl_status,
        },
    )
