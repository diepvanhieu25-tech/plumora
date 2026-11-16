"""FastAPI HTTP endpoints for AI Recommendation (PL-REC-01, PL-REC-02)."""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.db.models import DbSession
from app.modules.auth import extract_current_user
from app.modules.recommendation.service import compute_recommendation

router = APIRouter(prefix="/api/v1", tags=["recommendation"])


@router.post("/recommendations")
def post_recommendation(
    request: Request,
    db: DbSession,
) -> JSONResponse:
    """Compute and log personalized learning recommendation for current_user (PL-REC-01, PL-REC-02)."""
    user = extract_current_user(request, db)
    if user is None:
        return JSONResponse(
            status_code=401,
            content={
                "error_code": "AUTH_REQUIRED",
                "message": "Vui lòng đăng nhập để nhận gợi ý lộ trình học tập từ AI.",
                "details": {},
            },
        )

    result = compute_recommendation(db, user.id)
    return JSONResponse(status_code=200, content=result)
