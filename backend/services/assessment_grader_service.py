"""assessment-grader-service (Port 8003, schema: assess_svc)."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI

from app.db.models import SessionLocal
from app.modules.assessment.router_v2 import router as assessment_v2_router
from app.modules.events.outbox import relay_pending_outbox_events


def _relay_once_sync() -> None:
    with SessionLocal() as db:
        relay_pending_outbox_events(db)


async def _assess_outbox_relay_loop() -> None:
    log = logging.getLogger(__name__)
    while True:
        try:
            await asyncio.to_thread(_relay_once_sync)
        except Exception as exc:  # noqa: BLE001
            log.debug("Assessment outbox relay iteration skipped: %s", exc)
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
app.include_router(assessment_v2_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "assessment-grader-service", "schema": "assess_svc", "status": "up"}
