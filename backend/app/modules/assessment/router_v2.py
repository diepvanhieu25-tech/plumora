"""FastAPI router for /api/v2 assessment, placement, code sandbox, and recommendations."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Request, status

from app.db.models import DbSession, UserModel
from app.modules.assessment.schemas_v2 import (
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
    V2RecommendationRequest,
    V2RecommendationResponse,
)
from app.modules.assessment.service_v2 import (
    get_code_challenge_for_concept,
    start_depth_or_review_session,
    start_placement_session,
    submit_code_sandbox,
    submit_depth_or_review_step,
    submit_placement_answer,
)
from app.modules.auth import extract_current_user

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
    "/domains/{slug}/placement/start",
    response_model=PlacementStartResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_placement_start(
    slug: str,
    request: Request,
    db: DbSession,
) -> PlacementStartResponse:
    """Start an Adaptive Placement session for a domain (SCR-10)."""
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
    """Submit an Adaptive Placement answer (SCR-10)."""
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
    """Start a 5-Depth Probing or Spaced Review session (SCR-12, SCR-14)."""
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
    """Submit a 5-Depth Probing or Spaced Review step (SCR-12, SCR-14)."""
    user = _require_user(request, db)
    return submit_depth_or_review_step(db, user, session_id, payload)


@router.get(
    "/concepts/{slug}/code-challenge",
    response_model=CodeChallengeOut,
)
def get_code_challenge(
    slug: str,
    request: Request,
    db: DbSession,
) -> CodeChallengeOut:
    """Get public Code Sandbox challenge for a concept (SCR-13)."""
    user = _require_user(request, db)
    return get_code_challenge_for_concept(db, user, slug)


@router.post(
    "/concepts/{slug}/code-sandbox/submit",
    response_model=CodeSandboxSubmitResponse,
)
def post_code_sandbox_submit(
    slug: str,
    payload: CodeSandboxSubmitRequest,
    request: Request,
    db: DbSession,
) -> CodeSandboxSubmitResponse:
    """Execute user code in Isolated Code Sandbox Worker (SCR-13)."""
    user = _require_user(request, db)
    return submit_code_sandbox(db, user, slug, payload)


@router.post(
    "/recommendations",
    response_model=V2RecommendationResponse,
)
def post_v2_recommendations(
    payload: V2RecommendationRequest,
    request: Request,
    db: DbSession,
) -> V2RecommendationResponse:
    """Return GNN-PPO + Policy Guardrail (concept_slug, learning_mode) recommendation for SCR-11."""
    from app.modules.recommendation.service_v2 import recommend_gnn_ppo_v2

    user = _require_user(request, db)
    return recommend_gnn_ppo_v2(db, user.id, payload.domain_slug)
