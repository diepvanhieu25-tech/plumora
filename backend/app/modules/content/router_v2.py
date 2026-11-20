"""FastAPI router for /api/v2/domains endpoints (PL3-KG-01, PL3-MEMORY-01)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request, status

from app.db.models import DbSession, UserModel
from app.modules.auth import extract_current_user
from app.modules.content.kg_service import get_domain_roadmap_for_user, list_domains_for_user
from app.modules.content.schemas_v2 import DomainRoadmapResponse, DomainsListResponse

router = APIRouter(prefix="/api/v2", tags=["content_kg"])


def _require_user(request: Request, db: DbSession) -> UserModel:
    user = extract_current_user(request, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error_code": "AUTH_REQUIRED",
                "message": "Authentication is required.",
            },
        )
    return user


@router.get("/domains", response_model=DomainsListResponse)
def get_domains(request: Request, db: DbSession) -> DomainsListResponse:
    """List multi-domain Knowledge Graphs with user summary."""
    user = _require_user(request, db)
    return list_domains_for_user(db, user.id)


@router.get("/domains/{slug}/roadmap", response_model=DomainRoadmapResponse)
def get_domain_roadmap(
    slug: str,
    request: Request,
    db: DbSession,
    simulated_time_offset_days: float = Query(default=0.0, ge=0.0),
) -> DomainRoadmapResponse:
    """Get domain DAG roadmap with cross-domain shared competency and Ebbinghaus decay."""
    user = _require_user(request, db)
    return get_domain_roadmap_for_user(
        db,
        user.id,
        slug,
        simulated_time_offset_days=simulated_time_offset_days,
    )
