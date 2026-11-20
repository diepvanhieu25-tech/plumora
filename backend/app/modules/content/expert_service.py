"""Service layer for Expert Domain/DAG authoring, 5-Depth Rubrics & Code Challenges."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.models import (
    CodeChallengeModel,
    DepthQuestionModel,
    DomainConceptMapModel,
    DomainModel,
    GradingRubricModel,
)
from app.modules.assessment.sandbox_worker import (
    IsolatedSandboxWorkerAdapter,
    SandboxSecurityError,
    SandboxTimeoutError,
)
from app.modules.content.dag_validator import DagCycleError, validate_dag_acyclic
from app.modules.content.expert_schemas import (
    ExpertCodeChallengeRequest,
    ExpertCreateDomainRequest,
    ExpertCreateQuestionRequest,
    ExpertGraphUpdateResponse,
    ExpertUpdateGraphRequest,
)
from app.modules.events.outbox import record_outbox_event_in_tx, relay_pending_outbox_events

_SANDBOX = IsolatedSandboxWorkerAdapter()


def create_expert_domain(db: Session, payload: ExpertCreateDomainRequest) -> dict[str, Any]:
    """Create a new domain in Knowledge Graph."""
    if db.get(DomainModel, payload.slug) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error_code": "DOMAIN_EXISTS", "message": f"Domain '{payload.slug}' already exists."},
        )
    dom = DomainModel(
        slug=payload.slug,
        title=payload.title,
        description=payload.description,
        is_published=True,
        graph_version=1,
    )
    db.add(dom)
    db.commit()
    return {"slug": dom.slug, "title": dom.title, "graph_version": dom.graph_version}


def update_expert_domain_graph(
    db: Session,
    domain_slug: str,
    expert_id: uuid.UUID,
    payload: ExpertUpdateGraphRequest,
) -> ExpertGraphUpdateResponse:
    """Validate DAG acyclicity, replace domain nodes/edges, and emit DomainGraphUpdatedEvent."""
    dom = db.get(DomainModel, domain_slug)
    if dom is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "DOMAIN_NOT_FOUND", "message": f"Domain '{domain_slug}' not found."},
        )

    node_slugs = [n.slug for n in payload.nodes]
    edges = [(e.concept_slug, e.prereq_slug) for e in payload.edges]
    try:
        validate_dag_acyclic(node_slugs, edges)
    except DagCycleError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "error_code": exc.error_code,
                "message": str(exc),
                "cycle_path": exc.cycle_path,
            },
        ) from exc

    prereq_map: dict[str, list[str]] = {n.slug: [] for n in payload.nodes}
    for e in payload.edges:
        if e.concept_slug in prereq_map and e.prereq_slug not in prereq_map[e.concept_slug]:
            prereq_map[e.concept_slug].append(e.prereq_slug)

    existing_rows = db.scalars(
        select(DomainConceptMapModel).where(DomainConceptMapModel.domain_slug == domain_slug)
    ).all()
    existing_lessons = {r.concept_slug: r.lesson_markdown for r in existing_rows}

    db.execute(delete(DomainConceptMapModel).where(DomainConceptMapModel.domain_slug == domain_slug))
    for idx, n in enumerate(payload.nodes):
        lesson_md = (
            n.lesson_markdown
            if n.lesson_markdown is not None and n.lesson_markdown.strip()
            else existing_lessons.get(n.slug, f"## {n.title}")
        )
        db.add(
            DomainConceptMapModel(
                domain_slug=domain_slug,
                concept_slug=n.slug,
                node_idx=idx,
                title=n.title,
                tier=n.tier,
                is_shared=n.is_shared,
                prerequisites_json=prereq_map[n.slug],
                lesson_markdown=lesson_md,
            )
        )

    dom.graph_version += 1
    ev_id = uuid.uuid4()
    record_outbox_event_in_tx(
        db,
        event_id=ev_id,
        event_type="DomainGraphUpdatedEvent",
        stream_name="plumora:stream:domain_events",
        payload={
            "event_id": str(ev_id),
            "occurred_at": datetime.now(UTC).isoformat(),
            "domain_slug": domain_slug,
            "graph_version": dom.graph_version,
            "updated_by_expert_id": str(expert_id),
            "change_summary": f"Updated {len(payload.nodes)} nodes and {len(payload.edges)} edges",
        },
    )
    db.commit()
    relay_pending_outbox_events(db)

    return ExpertGraphUpdateResponse(
        domain_slug=domain_slug,
        graph_version=dom.graph_version,
        dag_valid=True,
        total_nodes=len(payload.nodes),
        shared_nodes_count=sum(1 for n in payload.nodes if n.is_shared),
        published_event_id=ev_id,
    )


def create_expert_question(
    db: Session,
    concept_slug: str,
    payload: ExpertCreateQuestionRequest,
) -> dict[str, Any]:
    """Create a 5-depth question and validate Rubric weight sum == 1.0."""
    if payload.rubric is not None:
        total_w = sum(c.weight for c in payload.rubric.criteria)
        if abs(total_w - 1.0) > 1e-4:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail={
                    "error_code": "RUBRIC_WEIGHT_SUM_INVALID",
                    "message": f"Rubric weights must sum to 1.0 (got {total_w:.4f}).",
                },
            )

    q_id = uuid.uuid4()
    db.add(
        DepthQuestionModel(
            id=q_id,
            concept_slug=concept_slug,
            depth_tier=payload.depth_tier,
            task_type=payload.task_type,
            prompt=payload.prompt,
            options_json=payload.options,
            correct_option_key=payload.correct_option_key,
            is_placement_eligible=payload.depth_tier <= 2 and payload.task_type == "mcq",
        )
    )
    db.flush()

    if payload.rubric is not None:
        db.add(
            GradingRubricModel(
                id=uuid.uuid4(),
                question_id=q_id,
                criteria_json=[c.model_dump() for c in payload.rubric.criteria],
                reference_explanation=payload.rubric.reference_explanation,
            )
        )
    db.commit()
    return {"item_id": str(q_id), "concept_slug": concept_slug, "depth_tier": payload.depth_tier}


def create_expert_code_challenge(
    db: Session,
    concept_slug: str,
    payload: ExpertCodeChallengeRequest,
) -> dict[str, Any]:
    """Validate solution_code passes 100% of test_cases in Isolated Sandbox before saving."""
    try:
        res = _SANDBOX.execute(
            language=payload.language,
            source_code=payload.solution_code,
            test_cases=payload.test_cases,
            timeout_ms=payload.timeout_ms,
            memory_limit_mb=payload.memory_limit_mb,
        )
    except (SandboxTimeoutError, SandboxSecurityError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"error_code": exc.error_code, "message": str(exc)},
        ) from exc

    if res.passed_tests != res.total_tests:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "error_code": "SOLUTION_TESTS_FAILED",
                "message": f"Solution code passed {res.passed_tests}/{res.total_tests} tests.",
            },
        )

    ch_id = uuid.uuid4()
    db.add(
        CodeChallengeModel(
            id=ch_id,
            concept_slug=concept_slug,
            title=payload.title,
            language=payload.language,
            prompt=payload.prompt,
            buggy_starter_code=payload.buggy_starter_code,
            solution_code=payload.solution_code,
            test_cases_json=payload.test_cases,
            timeout_ms=payload.timeout_ms,
            memory_limit_mb=payload.memory_limit_mb,
        )
    )
    db.commit()
    return {
        "item_id": str(ch_id),
        "concept_slug": concept_slug,
        "validation_run": {
            "solution_passed_all_tests": True,
            "runtime_ms": res.runtime_ms,
        },
    }
