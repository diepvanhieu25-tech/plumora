"""FastAPI router for /api/v2/domains endpoints (PL3-KG-01, PL3-MEMORY-01)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select

from app.db.models import (
    CodeChallengeModel,
    DbSession,
    DepthQuestionModel,
    DomainConceptMapModel,
    DomainModel,
    GradingRubricModel,
    UserModel,
)
from app.modules.auth import extract_current_user
from app.modules.auth.security import require_internal_service
from app.modules.content.kg_service import (
    get_concept_playbook_detail,
    get_domain_roadmap_for_user,
    list_domains_for_user,
)
from app.modules.content.schemas_v2 import (
    ConceptPlaybookDetailResponse,
    DomainRoadmapResponse,
    DomainsListResponse,
)

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


@router.get(
    "/domains/{domain_slug}/concepts/{concept_slug}",
    response_model=ConceptPlaybookDetailResponse,
)
def get_concept_playbook(
    domain_slug: str,
    concept_slug: str,
    request: Request,
    db: DbSession,
) -> ConceptPlaybookDetailResponse:
    """Get lightweight concept Playbook + competency state strictly by (domain_slug, concept_slug)."""
    user = _require_user(request, db)
    return get_concept_playbook_detail(db, user.id, domain_slug, concept_slug)


@router.get("/internal/domains/{slug}/bundle", dependencies=[Depends(require_internal_service)])
def get_domain_bundle_internal(slug: str, db: DbSession) -> dict[str, Any]:
    """Internal endpoint for assessment/recommendation services under strict schema isolation."""
    dom = db.get(DomainModel, slug)
    if dom is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "DOMAIN_NOT_FOUND", "message": f"Domain '{slug}' not found."},
        )
    nodes = db.scalars(
        select(DomainConceptMapModel)
        .where(DomainConceptMapModel.domain_slug == slug)
        .order_by(DomainConceptMapModel.node_idx)
    ).all()
    slugs = [n.concept_slug for n in nodes]
    questions = (
        db.scalars(
            select(DepthQuestionModel)
            .where(
                DepthQuestionModel.concept_slug.in_(slugs),
                DepthQuestionModel.is_active.is_(True),
            )
            .order_by(
                DepthQuestionModel.depth_tier,
                DepthQuestionModel.version.desc(),
                DepthQuestionModel.display_order,
            )
        ).all()
        if slugs
        else []
    )
    q_ids = [q.id for q in questions]
    rubrics = (
        db.scalars(select(GradingRubricModel).where(GradingRubricModel.question_id.in_(q_ids))).all()
        if q_ids
        else []
    )
    rubric_by_q = {str(r.question_id): r for r in rubrics}
    ch_slugs = (
        set(
            db.scalars(
                select(CodeChallengeModel.concept_slug).where(
                    CodeChallengeModel.concept_slug.in_(slugs),
                    CodeChallengeModel.is_active.is_(True),
                )
            ).all()
        )
        if slugs
        else set()
    )
    return {
        "domain": {
            "slug": dom.slug,
            "title": dom.title,
            "description": dom.description,
            "graph_version": dom.graph_version,
        },
        "nodes": [
            {
                "domain_slug": n.domain_slug,
                "concept_slug": n.concept_slug,
                "node_idx": n.node_idx,
                "title": n.title,
                "tier": n.tier,
                "is_shared": n.is_shared,
                "prerequisites_json": list(n.prerequisites_json or []),
                "has_code_challenge": n.concept_slug in ch_slugs,
            }
            for n in nodes
        ],
        "questions": [
            {
                "id": str(q.id),
                "concept_slug": q.concept_slug,
                "depth_tier": q.depth_tier,
                "task_type": q.task_type,
                "prompt": q.prompt,
                "options_json": q.options_json,
                "correct_option_key": q.correct_option_key,
                "is_placement_eligible": q.is_placement_eligible,
                "is_active": q.is_active,
                "version": q.version,
                "display_order": q.display_order,
                "rubric": (
                    {
                        "criteria_json": rubric_by_q[str(q.id)].criteria_json,
                        "reference_explanation": rubric_by_q[str(q.id)].reference_explanation,
                    }
                    if str(q.id) in rubric_by_q
                    else None
                ),
            }
            for q in questions
        ],
    }


@router.get("/internal/concepts/{concept_slug}/bundle", dependencies=[Depends(require_internal_service)])
def get_concept_bundle_internal(
    concept_slug: str,
    db: DbSession,
    domain_slug: str | None = Query(default=None),
) -> dict[str, Any]:
    """Internal endpoint returning concept node, active questions, rubrics, and active code challenge."""
    node = db.get(DomainConceptMapModel, (domain_slug, concept_slug)) if domain_slug else None
    if node is None:
        node = db.scalars(
            select(DomainConceptMapModel)
            .where(DomainConceptMapModel.concept_slug == concept_slug)
            .order_by(DomainConceptMapModel.domain_slug)
        ).first()
    if node is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "CONCEPT_NOT_FOUND", "message": f"Concept '{concept_slug}' not found."},
        )
    questions = db.scalars(
        select(DepthQuestionModel)
        .where(
            DepthQuestionModel.concept_slug == concept_slug,
            DepthQuestionModel.is_active.is_(True),
        )
        .order_by(
            DepthQuestionModel.depth_tier,
            DepthQuestionModel.version.desc(),
            DepthQuestionModel.display_order,
        )
    ).all()
    q_ids = [q.id for q in questions]
    rubrics = (
        db.scalars(select(GradingRubricModel).where(GradingRubricModel.question_id.in_(q_ids))).all()
        if q_ids
        else []
    )
    rubric_by_q = {str(r.question_id): r for r in rubrics}
    ch = db.scalars(
        select(CodeChallengeModel)
        .where(
            CodeChallengeModel.concept_slug == concept_slug,
            CodeChallengeModel.is_active.is_(True),
        )
        .order_by(CodeChallengeModel.version.desc(), CodeChallengeModel.display_order)
    ).first()
    return {
        "node": {
            "domain_slug": node.domain_slug,
            "concept_slug": node.concept_slug,
            "node_idx": node.node_idx,
            "title": node.title,
            "tier": node.tier,
            "is_shared": node.is_shared,
            "prerequisites_json": list(node.prerequisites_json or []),
            "lesson_markdown": node.lesson_markdown,
            "has_code_challenge": ch is not None,
        },
        "questions": [
            {
                "id": str(q.id),
                "concept_slug": q.concept_slug,
                "depth_tier": q.depth_tier,
                "task_type": q.task_type,
                "prompt": q.prompt,
                "options_json": q.options_json,
                "correct_option_key": q.correct_option_key,
                "is_placement_eligible": q.is_placement_eligible,
                "is_active": q.is_active,
                "version": q.version,
                "display_order": q.display_order,
                "rubric": (
                    {
                        "criteria_json": rubric_by_q[str(q.id)].criteria_json,
                        "reference_explanation": rubric_by_q[str(q.id)].reference_explanation,
                    }
                    if str(q.id) in rubric_by_q
                    else None
                ),
            }
            for q in questions
        ],
        "code_challenge": (
            {
                "id": str(ch.id),
                "concept_slug": ch.concept_slug,
                "title": ch.title,
                "language": ch.language,
                "prompt": ch.prompt,
                "buggy_starter_code": ch.buggy_starter_code,
                "test_cases_json": ch.test_cases_json,
                "timeout_ms": ch.timeout_ms,
                "memory_limit_mb": ch.memory_limit_mb,
                "setup_sql": ch.setup_sql,
                "is_active": ch.is_active,
                "version": ch.version,
                "display_order": ch.display_order,
            }
            if ch is not None
            else None
        ),
    }
