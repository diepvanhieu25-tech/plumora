"""assessment-grader-service (Port 8003, schema: assess_svc)."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI

from app.db.models import SessionLocal
from app.modules.assessment.router_v2 import router as assessment_v2_router
from app.shared.events.outbox import (
    consume_domain_events_stream_once,
    relay_pending_outbox_events,
)
from services._runtime import register_common_middleware_and_handlers, register_health_routes

logger = logging.getLogger(__name__)


def _relay_and_consume_once_sync() -> None:
    with SessionLocal() as db:
        relay_pending_outbox_events(db)
        consume_domain_events_stream_once(db, consumer_group="assess_cg")


async def _assess_outbox_relay_loop() -> None:
    while True:
        try:
            await asyncio.to_thread(_relay_and_consume_once_sync)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Assessment outbox/domain-events worker iteration failed: %s", exc)
        await asyncio.sleep(0.2)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    task = asyncio.create_task(_assess_outbox_relay_loop())
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="Plumora assessment-grader-service", version="2.0.0", lifespan=lifespan)
register_common_middleware_and_handlers(app, service_name="assessment-grader-service")
register_health_routes(app, service_name="assessment-grader-service", schema_name="assess_svc")
app.include_router(assessment_v2_router)
