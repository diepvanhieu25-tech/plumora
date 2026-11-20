"""recommendation-ai-service (Port 8004, schema: rec_ai_svc)."""

from fastapi import FastAPI, HTTPException, Request, status

from app.db.models import DbSession
from app.modules.assessment.schemas_v2 import V2RecommendationRequest, V2RecommendationResponse
from app.modules.auth import extract_current_user
from app.modules.recommendation.router_admin import router as admin_v2_router
from app.modules.recommendation.service_v2 import recommend_gnn_ppo_v2

app = FastAPI(title="Plumora recommendation-ai-service", version="2.0.0")
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
