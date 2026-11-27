"""FastAPI router for /api/v2/domains endpoints (thin router using CurrentUser & ContentRepository)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies import CurrentUser, DbSession, require_internal_service
from app.modules.content.kg_service import (
    get_concept_playbook_detail,
    get_domain_roadmap_for_user,
    list_domains_for_user,
)
from app.modules.content.repository import ContentRepository
from app.modules.content.schemas_v2 import (
    ConceptPlaybookDetailResponse,
    DomainRoadmapResponse,
    DomainsListResponse,
)
from app.shared.events.outbox import relay_pending_outbox_events

router = APIRouter(prefix="/api/v2", tags=["content_kg"])


@router.get("/domains", response_model=DomainsListResponse)
def get_domains(user: CurrentUser, db: DbSession) -> DomainsListResponse:
    """List multi-domain Knowledge Graphs with user summary."""
    return list_domains_for_user(db, user.id)


@router.get("/domains/{slug}/roadmap", response_model=DomainRoadmapResponse)
def get_domain_roadmap(
    slug: str,
    user: CurrentUser,
    db: DbSession,
    simulated_time_offset_days: float = Query(default=0.0, ge=0.0),
) -> DomainRoadmapResponse:
    """Get domain DAG roadmap with cross-domain shared competency and Ebbinghaus decay."""
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
    user: CurrentUser,
    db: DbSession,
) -> ConceptPlaybookDetailResponse:
    """Get lightweight concept Playbook + competency state strictly by (domain_slug, concept_slug)."""
    return get_concept_playbook_detail(db, user.id, domain_slug, concept_slug)


@router.get("/internal/domains/{slug}/bundle", dependencies=[Depends(require_internal_service)])
def get_domain_bundle_internal(slug: str, db: DbSession) -> dict[str, Any]:
    """Internal endpoint for assessment/recommendation services under strict schema isolation."""
    repo = ContentRepository(db)
    dom = repo.get_domain(slug)
    if dom is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "DOMAIN_NOT_FOUND", "message": f"Domain '{slug}' not found."},
        )
    nodes = repo.list_domain_nodes(slug)
    slugs = [n.concept_slug for n in nodes]
    questions = repo.list_questions_for_slugs(slugs)
    rubric_by_q = repo.map_rubrics_by_question_id([q.id for q in questions])
    ch_slugs = repo.list_active_challenge_slugs(slugs)
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
    repo = ContentRepository(db)
    node = repo.get_concept_node(concept_slug, domain_slug=domain_slug)
    if node is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "CONCEPT_NOT_FOUND", "message": f"Concept '{concept_slug}' not found."},
        )
    questions = repo.list_questions_for_slugs([concept_slug])
    rubric_by_q = repo.map_rubrics_by_question_id([q.id for q in questions])
    ch = repo.get_active_code_challenge(concept_slug)
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


@router.get("/internal/outbox/pending-count", dependencies=[Depends(require_internal_service)])
def get_content_outbox_pending_count_internal(db: DbSession) -> dict[str, Any]:
    """Internal endpoint returning pending outbox event count & breakdown on content_svc."""
    cnt, by_type = ContentRepository(db).count_pending_outbox()
    return {"pending_count": cnt, "by_event_type": by_type}


@router.post("/internal/outbox/relay", dependencies=[Depends(require_internal_service)])
def post_content_outbox_relay_internal(db: DbSession) -> dict[str, int]:
    """Internal endpoint triggering immediate outbox relay on content_svc."""
    return {"relayed": relay_pending_outbox_events(db)}
