"""recommendation-ai-service (Port 8004, schema: rec_ai_svc)."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI

from app.db.models import SessionLocal
from app.modules.recommendation.router_admin import router as admin_v2_router
from app.modules.recommendation.router_v2 import router as recommendation_v2_router
from app.shared.events.outbox import (
    consume_competency_stream_once,
    consume_domain_events_stream_once,
)
from services._runtime import register_common_middleware_and_handlers, register_health_routes

logger = logging.getLogger(__name__)


def _consume_once_sync() -> None:
    with SessionLocal() as db:
        consume_competency_stream_once(db)
        consume_domain_events_stream_once(db, consumer_group="rec_ai_domain_cg")


async def _rec_ai_stream_consumer_loop() -> None:
    while True:
        try:
            await asyncio.to_thread(_consume_once_sync)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Recommendation stream consumer iteration failed: %s", exc)
        await asyncio.sleep(0.5)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    task = asyncio.create_task(_rec_ai_stream_consumer_loop())
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="Plumora recommendation-ai-service", version="2.0.0", lifespan=lifespan)
register_common_middleware_and_handlers(app, service_name="recommendation-ai-service")
register_health_routes(
    app,
    service_name="recommendation-ai-service",
    schema_name="rec_ai_svc",
    check_rl_checkpoint=True,
)
app.include_router(recommendation_v2_router)
app.include_router(admin_v2_router)
