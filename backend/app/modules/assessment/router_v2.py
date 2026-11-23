"""FastAPI router for /api/v2 assessment, placement, playbook, code sandbox & recommendations."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select

from app.db.models import (
    AssessmentSessionModel,
    DbSession,
    OutboxEventModel,
    UserModel,
    UserNodeCompetencyModel,
)
from app.modules.assessment.schemas_v2 import (
    AssessmentAbandonResponse,
    AssessmentStartRequest,
    AssessmentStartResponse,
    AssessmentSubmitRequest,
    AssessmentSubmitResponse,
    CodeChallengeOut,
    CodeSandboxSubmitRequest,
    CodeSandboxSubmitResponse,
    PlacementAnswerRequest,
    PlacementAnswerResponse,
    PlacementStartResponse,
    PlaybookCompleteRequest,
    PlaybookCompleteResponse,
    V2RecommendationRequest,
    V2RecommendationResponse,
)
from app.modules.assessment.service_v2 import (
    abandon_assessment_session,
    complete_concept_playbook,
    get_code_challenge_for_concept,
    start_depth_or_review_session,
    start_placement_session,
    submit_code_sandbox,
    submit_depth_or_review_step,
    submit_placement_answer,
)
from app.modules.auth import extract_current_user
from app.modules.auth.security import require_internal_service

router = APIRouter(prefix="/api/v2", tags=["assessment_v2"])


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


@router.post(
    "/domains/{domain_slug}/concepts/{slug}/playbook/complete",
    response_model=PlaybookCompleteResponse,
)
def post_playbook_complete(
    domain_slug: str,
    slug: str,
    payload: PlaybookCompleteRequest,
    request: Request,
    db: DbSession,
) -> PlaybookCompleteResponse:
    """Mark Playbook completed (INV-SEQ-01) and optionally grade Quick Concept Check."""
    user = _require_user(request, db)
    return complete_concept_playbook(db, user, domain_slug, slug, payload)


@router.post(
    "/domains/{slug}/placement/start",
    response_model=PlacementStartResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_placement_start(
    slug: str,
    request: Request,
    db: DbSession,
) -> PlacementStartResponse:
    """Start an Adaptive Placement session for a domain."""
    user = _require_user(request, db)
    return start_placement_session(db, user, slug)


@router.post(
    "/domains/{slug}/placement/{session_id}/answer",
    response_model=PlacementAnswerResponse,
)
def post_placement_answer(
    slug: str,
    session_id: uuid.UUID,
    payload: PlacementAnswerRequest,
    request: Request,
    db: DbSession,
) -> PlacementAnswerResponse:
    """Submit an Adaptive Placement answer."""
    user = _require_user(request, db)
    return submit_placement_answer(db, user, slug, session_id, payload)


@router.post(
    "/assessments/start",
    response_model=AssessmentStartResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_assessment_start(
    payload: AssessmentStartRequest,
    request: Request,
    db: DbSession,
) -> AssessmentStartResponse:
    """Start a 5-Depth Probing or Spaced Review session."""
    user = _require_user(request, db)
    return start_depth_or_review_session(db, user, payload)


@router.post(
    "/assessments/{session_id}/submit",
    response_model=AssessmentSubmitResponse,
)
def post_assessment_submit(
    session_id: uuid.UUID,
    payload: AssessmentSubmitRequest,
    request: Request,
    db: DbSession,
) -> AssessmentSubmitResponse:
    """Submit a 5-Depth Probing or Spaced Review step."""
    user = _require_user(request, db)
    return submit_depth_or_review_step(db, user, session_id, payload)


@router.post(
    "/assessments/{session_id}/abandon",
    response_model=AssessmentAbandonResponse,
)
def post_assessment_abandon(
    session_id: uuid.UUID,
    request: Request,
    db: DbSession,
) -> AssessmentAbandonResponse:
    """Abandon an active assessment session (triggers insufficient_evidence if < 2 steps)."""
    user = _require_user(request, db)
    return abandon_assessment_session(db, user, session_id)


@router.get(
    "/concepts/{slug}/code-challenge",
    response_model=CodeChallengeOut,
)
def get_code_challenge(
    slug: str,
    request: Request,
    db: DbSession,
    domain_slug: str | None = Query(default=None),
) -> CodeChallengeOut:
    """Get active public Code Sandbox challenge for a concept."""
    user = _require_user(request, db)
    return get_code_challenge_for_concept(db, user, slug, domain_slug=domain_slug)


@router.post(
    "/concepts/{slug}/code-sandbox/submit",
    response_model=CodeSandboxSubmitResponse,
)
def post_code_sandbox_submit(
    slug: str,
    payload: CodeSandboxSubmitRequest,
    request: Request,
    db: DbSession,
    domain_slug: str | None = Query(default=None),
) -> CodeSandboxSubmitResponse:
    """Execute user code in Isolated Code Sandbox Worker."""
    user = _require_user(request, db)
    return submit_code_sandbox(db, user, slug, payload, domain_slug=domain_slug)


@router.get("/internal/users/{user_id}/competencies", dependencies=[Depends(require_internal_service)])
def get_user_competencies_internal(user_id: uuid.UUID, db: DbSession) -> dict[str, Any]:
    """Internal endpoint returning user competencies, state_version & completed placements."""
    rows = db.scalars(
        select(UserNodeCompetencyModel).where(UserNodeCompetencyModel.user_id == user_id)
    ).all()
    completed_placements = list(
        db.scalars(
            select(AssessmentSessionModel.domain_slug)
            .distinct()
            .where(
                AssessmentSessionModel.user_id == user_id,
                AssessmentSessionModel.session_mode == "placement",
                AssessmentSessionModel.status == "completed",
            )
            .limit(100)
        ).all()
    )
    state_ver = max(1, len(rows))
    return {
        "user_id": str(user_id),
        "state_version": state_ver,
        "completed_placement_domains": completed_placements,
        "competencies": [
            {
                "concept_slug": r.concept_slug,
                "depth_level_norm": r.depth_level_norm,
                "peak_depth_level_norm": r.peak_depth_level_norm,
                "depth_label": r.depth_label,
                "confidence": r.confidence,
                "stability_s": r.stability_s,
                "last_practiced_at": r.last_practiced_at.isoformat() if r.last_practiced_at else None,
                "playbook_completed_at": (
                    r.playbook_completed_at.isoformat() if r.playbook_completed_at else None
                ),
                "code_practice_score": r.code_practice_score,
            }
            for r in rows
        ],
    }


@router.get("/internal/outbox/pending-count", dependencies=[Depends(require_internal_service)])
def get_outbox_pending_count_internal(db: DbSession) -> dict[str, int]:
    """Internal endpoint returning pending outbox event count for system health."""
    cnt = int(
        db.scalar(
            select(func.count())
            .select_from(OutboxEventModel)
            .where(OutboxEventModel.published_at.is_(None))
        )
        or 0
    )
    return {"pending_count": cnt}


@router.post(
    "/recommendations",
    response_model=V2RecommendationResponse,
)
def post_v2_recommendations(
    payload: V2RecommendationRequest,
    request: Request,
    db: DbSession,
) -> V2RecommendationResponse:
    """Return GNN-PPO + Policy Guardrail (concept_slug, learning_mode) recommendation."""
    from app.modules.recommendation.service_v2 import recommend_gnn_ppo_v2

    user = _require_user(request, db)
    return recommend_gnn_ppo_v2(db, user.id, payload.domain_slug)
