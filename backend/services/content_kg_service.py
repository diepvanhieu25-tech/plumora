"""content-kg-service (Port 8002, schema: content_svc)."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI

from app.db.models import SessionLocal
from app.modules.content.router_expert import router as expert_v2_router
from app.modules.content.router_v2 import router as content_kg_router
from app.modules.events.outbox import relay_pending_outbox_events

logger = logging.getLogger(__name__)


def _relay_once_sync() -> None:
    with SessionLocal() as db:
        relay_pending_outbox_events(db)


async def _content_outbox_relay_loop() -> None:
    while True:
        try:
            await asyncio.to_thread(_relay_once_sync)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Content outbox relay iteration failed: %s", exc)
        await asyncio.sleep(0.3)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    task = asyncio.create_task(_content_outbox_relay_loop())
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="Plumora content-kg-service", version="2.0.0", lifespan=lifespan)
app.include_router(content_kg_router)
app.include_router(expert_v2_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "content-kg-service", "schema": "content_svc", "status": "up"}
