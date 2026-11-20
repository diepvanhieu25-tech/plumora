"""recommendation-ai-service (Port 8004, schema: rec_ai_svc)."""

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, HTTPException, Request, status

from app.db.models import DbSession, SessionLocal
from app.modules.assessment.schemas_v2 import V2RecommendationRequest, V2RecommendationResponse
from app.modules.auth import extract_current_user
from app.modules.events.outbox import consume_competency_stream_once
from app.modules.recommendation.router_admin import router as admin_v2_router
from app.modules.recommendation.service_v2 import recommend_gnn_ppo_v2


def _consume_once_sync() -> None:
    with SessionLocal() as db:
        consume_competency_stream_once(db)


async def _rec_ai_stream_consumer_loop() -> None:
    log = logging.getLogger(__name__)
    while True:
        try:
            await asyncio.to_thread(_consume_once_sync)
        except Exception as exc:  # noqa: BLE001
            log.debug("Recommendation stream consumer iteration skipped: %s", exc)
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
app.include_router(admin_v2_router)


@app.post("/api/v2/recommendations", response_model=V2RecommendationResponse)
def post_v2_recommendations_svc(
    payload: V2RecommendationRequest,
    request: Request,
    db: DbSession,
) -> V2RecommendationResponse:
    user = extract_current_user(request, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error_code": "AUTH_REQUIRED", "message": "Authentication is required."},
        )
    return recommend_gnn_ppo_v2(db, user.id, payload.domain_slug)


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "recommendation-ai-service", "schema": "rec_ai_svc", "status": "up"}
