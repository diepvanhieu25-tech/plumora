"""FastAPI router for /api/v2/expert/* (Full Studio CRUD, Dry-Run & Cohort Analytics)."""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, status

from app.db.models import DbSession, UserModel
from app.modules.auth.rbac import require_roles
from app.modules.content.expert_schemas import (
    ExpertCodeChallengeRequest,
    ExpertCreateDomainRequest,
    ExpertCreateQuestionRequest,
    ExpertGraphUpdateResponse,
    ExpertPlaybookPatchRequest,
    ExpertRubricDryRunRequest,
    ExpertRubricDryRunResponse,
    ExpertUpdateGraphRequest,
)
from app.modules.content.expert_service import (
    create_expert_code_challenge,
    create_expert_domain,
    create_expert_question,
    delete_expert_question,
    dry_run_expert_code_challenge,
    dry_run_expert_rubric,
    get_expert_cohort_analytics,
    get_expert_domain_graph,
    list_expert_code_challenges,
    list_expert_questions,
    patch_expert_concept_playbook,
    update_expert_domain_graph,
    update_expert_question,
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


@router.get("/domains/{slug}/graph")
def get_expert_graph(
    slug: str,
    _user: ExpertUser,
    db: DbSession,
) -> dict[str, Any]:
    """Fetch full domain graph including lesson_markdown, question counts by tier & code challenge flags."""
    return get_expert_domain_graph(db, slug)


@router.put("/domains/{slug}/graph", response_model=ExpertGraphUpdateResponse)
def put_expert_domain_graph(
    slug: str,
    user: ExpertUser,
    payload: ExpertUpdateGraphRequest,
    db: DbSession,
) -> ExpertGraphUpdateResponse:
    """Update domain DAG nodes & edges with cycle validation and stable node_idx."""
    return update_expert_domain_graph(db, slug, user.id, payload)


@router.get("/concepts/{slug}/questions")
def get_expert_questions(
    slug: str,
    _user: ExpertUser,
    db: DbSession,
) -> dict[str, Any]:
    """List active 5-depth questions and rubrics for a concept."""
    return list_expert_questions(db, slug)


@router.post("/concepts/{slug}/questions", status_code=status.HTTP_201_CREATED)
def post_expert_question(
    slug: str,
    _user: ExpertUser,
    payload: ExpertCreateQuestionRequest,
    db: DbSession,
) -> dict[str, Any]:
    """Create a 5-depth question + structured Rubric."""
    return create_expert_question(db, slug, payload)


@router.put("/questions/{question_id}")
def put_expert_question(
    question_id: uuid.UUID,
    _user: ExpertUser,
    payload: ExpertCreateQuestionRequest,
    db: DbSession,
) -> dict[str, Any]:
    """Update an existing 5-depth question and its Rubric."""
    return update_expert_question(db, question_id, payload)


@router.delete("/questions/{question_id}")
def del_expert_question(
    question_id: uuid.UUID,
    _user: ExpertUser,
    db: DbSession,
) -> dict[str, Any]:
    """Deactivate a 5-depth question."""
    return delete_expert_question(db, question_id)


@router.post("/rubric/dry-run", response_model=ExpertRubricDryRunResponse)
def post_expert_rubric_dry_run(
    _user: ExpertUser,
    payload: ExpertRubricDryRunRequest,
) -> ExpertRubricDryRunResponse:
    """Preview live deterministic Rubric grading on a sample student explanation."""
    return dry_run_expert_rubric(payload)


@router.patch("/concepts/{slug}/playbook")
def patch_expert_playbook(
    slug: str,
    _user: ExpertUser,
    payload: ExpertPlaybookPatchRequest,
    db: DbSession,
) -> dict[str, Any]:
    """Update lesson_markdown for a single concept (synced across shared domains)."""
    return patch_expert_concept_playbook(db, slug, payload.lesson_markdown)


@router.post("/code-challenges/dry-run")
def post_expert_code_challenge_dry_run(
    _user: ExpertUser,
    payload: ExpertCodeChallengeRequest,
) -> dict[str, Any]:
    """Run Dual Sandbox Verification without persisting to DB."""
    return dry_run_expert_code_challenge(payload)


@router.get("/concepts/{slug}/code-challenges")
def get_expert_code_challenges(
    slug: str,
    _user: ExpertUser,
    db: DbSession,
) -> dict[str, Any]:
    """List code challenges for a concept."""
    return list_expert_code_challenges(db, slug)


@router.post("/concepts/{slug}/code-challenges", status_code=status.HTTP_201_CREATED)
def post_expert_code_challenge(
    slug: str,
    _user: ExpertUser,
    payload: ExpertCodeChallengeRequest,
    db: DbSession,
) -> dict[str, Any]:
    """Create & Dual-Sandbox-validate a Code Challenge."""
    return create_expert_code_challenge(db, slug, payload)


@router.put("/concepts/{slug}/code-challenges")
def put_expert_code_challenge(
    slug: str,
    _user: ExpertUser,
    payload: ExpertCodeChallengeRequest,
    db: DbSession,
) -> dict[str, Any]:
    """Publish a new active version of a Code Challenge with Dual Sandbox Verification."""
    return create_expert_code_challenge(db, slug, payload)


@router.get("/analytics/cohort")
def get_expert_cohort(
    _user: ExpertUser,
    db: DbSession,
    domain_slug: str | None = Query(default=None),
) -> dict[str, Any]:
    """Return 4-level competency heatmap, Bottleneck Tier Detector & real-time Ebbinghaus decay count."""
    return get_expert_cohort_analytics(db, domain_slug)
