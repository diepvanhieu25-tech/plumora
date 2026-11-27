"""FastAPI router for /api/v2 assessment, placement, playbook & code sandbox (thin router)."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.dependencies import CurrentUser, DbSession, require_internal_service
from app.modules.assessment.models import UserNodeCompetencyModel
from app.modules.assessment.repository import AssessmentRepository
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
)
from app.modules.assessment.services import (
    abandon_assessment_session,
    complete_concept_playbook,
    get_code_challenge_for_concept,
    start_depth_or_review_session,
    start_placement_session,
    submit_code_sandbox,
    submit_depth_or_review_step,
    submit_placement_answer,
)
from app.shared.events.outbox import relay_pending_outbox_events

router = APIRouter(prefix="/api/v2", tags=["assessment_v2"])


class InternalCohortRequest(BaseModel):
    concept_slugs: list[str] = Field(default_factory=list, max_length=200)


def compute_authoritative_state_version(
    db: Session,
    user_id: uuid.UUID,
    rows: list[UserNodeCompetencyModel],
) -> int:
    """Compute strictly monotonic state_version from competency timestamps and attempt count."""
    attempt_cnt = AssessmentRepository(db).count_user_attempts(user_id)
    max_updated_us = max(
        (int(r.updated_at.timestamp() * 1_000_000) for r in rows if r.updated_at is not None),
        default=0,
    )
    return 1 + len(rows) + attempt_cnt + max_updated_us


@router.post(
    "/domains/{domain_slug}/concepts/{slug}/playbook/complete",
    response_model=PlaybookCompleteResponse,
)
def post_playbook_complete(
    domain_slug: str,
    slug: str,
    payload: PlaybookCompleteRequest,
    user: CurrentUser,
    db: DbSession,
) -> PlaybookCompleteResponse:
    """Mark Playbook completed (INV-SEQ-01) and optionally grade Quick Concept Check."""
    return complete_concept_playbook(db, user, domain_slug, slug, payload)


@router.post(
    "/domains/{slug}/placement/start",
    response_model=PlacementStartResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_placement_start(slug: str, user: CurrentUser, db: DbSession) -> PlacementStartResponse:
    """Start an Adaptive Placement session for a domain."""
    return start_placement_session(db, user, slug)


@router.post(
    "/domains/{slug}/placement/{session_id}/answer",
    response_model=PlacementAnswerResponse,
)
def post_placement_answer(
    slug: str,
    session_id: uuid.UUID,
    payload: PlacementAnswerRequest,
    user: CurrentUser,
    db: DbSession,
) -> PlacementAnswerResponse:
    """Submit an Adaptive Placement answer."""
    return submit_placement_answer(db, user, slug, session_id, payload)


@router.post(
    "/assessments/start",
    response_model=AssessmentStartResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_assessment_start(
    payload: AssessmentStartRequest,
    user: CurrentUser,
    db: DbSession,
) -> AssessmentStartResponse:
    """Start a 5-Depth Probing or Spaced Review session."""
    return start_depth_or_review_session(db, user, payload)


@router.post(
    "/assessments/{session_id}/submit",
    response_model=AssessmentSubmitResponse,
)
def post_assessment_submit(
    session_id: uuid.UUID,
    payload: AssessmentSubmitRequest,
    user: CurrentUser,
    db: DbSession,
) -> AssessmentSubmitResponse:
    """Submit a 5-Depth Probing or Spaced Review step."""
    return submit_depth_or_review_step(db, user, session_id, payload)


@router.post(
    "/assessments/{session_id}/abandon",
    response_model=AssessmentAbandonResponse,
)
def post_assessment_abandon(
    session_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
) -> AssessmentAbandonResponse:
    """Abandon an active assessment session (triggers insufficient_evidence if < 2 steps)."""
    return abandon_assessment_session(db, user, session_id)


@router.get("/concepts/{slug}/code-challenge", response_model=CodeChallengeOut)
def get_code_challenge(
    slug: str,
    user: CurrentUser,
    db: DbSession,
    domain_slug: str | None = Query(default=None),
) -> CodeChallengeOut:
    """Get active public Code Sandbox challenge for a concept."""
    return get_code_challenge_for_concept(db, user, slug, domain_slug=domain_slug)


@router.post("/concepts/{slug}/code-sandbox/submit", response_model=CodeSandboxSubmitResponse)
def post_code_sandbox_submit(
    slug: str,
    payload: CodeSandboxSubmitRequest,
    user: CurrentUser,
    db: DbSession,
    domain_slug: str | None = Query(default=None),
) -> CodeSandboxSubmitResponse:
    """Execute user code in Isolated Code Sandbox Worker."""
    return submit_code_sandbox(db, user, slug, payload, domain_slug=domain_slug)


@router.get("/internal/users/{user_id}/competencies", dependencies=[Depends(require_internal_service)])
def get_user_competencies_internal(user_id: uuid.UUID, db: DbSession) -> dict[str, Any]:
    """Internal endpoint returning user competencies, monotonic state_version & completed placements."""
    repo = AssessmentRepository(db)
    rows = repo.list_user_competencies(user_id)
    completed_placements = repo.list_completed_placement_domains(user_id)
    state_ver = compute_authoritative_state_version(db, user_id, rows)
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


@router.post("/internal/analytics/cohort", dependencies=[Depends(require_internal_service)])
def post_cohort_analytics_internal(
    payload: InternalCohortRequest,
    db: DbSession,
) -> dict[str, Any]:
    """Internal endpoint providing bounded competency & SQL-aggregated bottleneck stats for Cohort Analytics."""
    slugs = [s.strip() for s in payload.concept_slugs if s.strip()]
    if not slugs:
        return {"competencies": [], "sessions": [], "bottlenecks": []}
    repo = AssessmentRepository(db)
    comp_rows = repo.list_cohort_competencies(slugs)
    bn_rows = repo.aggregate_cohort_bottlenecks(slugs)
    return {
        "competencies": [
            {
                "user_id": str(c.user_id),
                "concept_slug": c.concept_slug,
                "depth_level_norm": float(c.depth_level_norm),
                "stability_s": float(c.stability_s),
                "last_practiced_at": c.last_practiced_at.isoformat() if c.last_practiced_at else None,
            }
            for c in comp_rows
        ],
        "bottlenecks": [
            {"concept_slug": c_slug, "current_depth_tier": tier_num, "count": cnt}
            for c_slug, tier_num, cnt in bn_rows
        ],
    }


@router.get("/internal/outbox/pending-count", dependencies=[Depends(require_internal_service)])
def get_outbox_pending_count_internal(db: DbSession) -> dict[str, Any]:
    """Internal endpoint returning pending outbox event count & breakdown by event_type."""
    cnt, by_type = AssessmentRepository(db).count_pending_outbox()
    return {"pending_count": cnt, "by_event_type": by_type}


@router.post("/internal/outbox/relay", dependencies=[Depends(require_internal_service)])
def post_outbox_relay_internal(db: DbSession) -> dict[str, int]:
    """Internal endpoint triggering immediate outbox relay on assess_svc."""
    return {"relayed": relay_pending_outbox_events(db)}
