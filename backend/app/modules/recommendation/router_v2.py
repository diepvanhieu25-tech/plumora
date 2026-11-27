"""FastAPI router for /api/v2/recommendations (GNN-PPO + PolicyGuardrail)."""

from __future__ import annotations

from fastapi import APIRouter

from app.dependencies import CurrentUser, DbSession
from app.modules.assessment.schemas_v2 import V2RecommendationRequest, V2RecommendationResponse
from app.modules.recommendation.service_v2 import recommend_gnn_ppo_v2

router = APIRouter(prefix="/api/v2", tags=["recommendation_v2"])


@router.post("/recommendations", response_model=V2RecommendationResponse)
def post_v2_recommendations(
    payload: V2RecommendationRequest,
    user: CurrentUser,
    db: DbSession,
) -> V2RecommendationResponse:
    """Return GNN-PPO + Policy Guardrail (concept_slug, learning_mode) recommendation."""
    return recommend_gnn_ppo_v2(db, user.id, payload.domain_slug)
