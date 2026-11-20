"""FastAPI router for /api/v2/expert/* (SCR-15..SCR-17, PL3-ROLE-01)."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, status

from app.db.models import DbSession, UserModel
from app.modules.auth.rbac import require_roles
from app.modules.content.expert_schemas import (
    ExpertCodeChallengeRequest,
    ExpertCreateDomainRequest,
    ExpertCreateQuestionRequest,
    ExpertGraphUpdateResponse,
    ExpertUpdateGraphRequest,
)
from app.modules.content.expert_service import (
    create_expert_code_challenge,
    create_expert_domain,
    create_expert_question,
    update_expert_domain_graph,
)

ExpertUser = Annotated[UserModel, Depends(require_roles("expert", "admin"))]
router = APIRouter(prefix="/api/v2/expert", tags=["expert_v2"])


@router.post("/domains", status_code=status.HTTP_201_CREATED)
def post_expert_domain(
    _user: ExpertUser,
    payload: ExpertCreateDomainRequest,
    db: DbSession,
) -> dict[str, Any]:
    """Create a new domain (expert/admin only)."""
    return create_expert_domain(db, payload)


@router.put("/domains/{slug}/graph", response_model=ExpertGraphUpdateResponse)
def put_expert_domain_graph(
    slug: str,
    user: ExpertUser,
    payload: ExpertUpdateGraphRequest,
    db: DbSession,
) -> ExpertGraphUpdateResponse:
    """Update domain DAG nodes & edges with cycle validation (SCR-15)."""
    return update_expert_domain_graph(db, slug, user.id, payload)


@router.post("/concepts/{slug}/questions", status_code=status.HTTP_201_CREATED)
def post_expert_question(
    slug: str,
    _user: ExpertUser,
    payload: ExpertCreateQuestionRequest,
    db: DbSession,
) -> dict[str, Any]:
    """Create a 5-depth question + structured Rubric (SCR-16)."""
    return create_expert_question(db, slug, payload)


@router.post("/concepts/{slug}/code-challenges", status_code=status.HTTP_201_CREATED)
def post_expert_code_challenge(
    slug: str,
    _user: ExpertUser,
    payload: ExpertCodeChallengeRequest,
    db: DbSession,
) -> dict[str, Any]:
    """Create & sandbox-validate a Code Challenge (SCR-17)."""
    return create_expert_code_challenge(db, slug, payload)
