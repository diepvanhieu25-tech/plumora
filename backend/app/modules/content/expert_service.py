"""Service layer for Expert Studio CRUD, Dual Sandbox Verification & Cohort Analytics."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from plumora_rl.domain import EbbinghausMemoryModel
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.models import (
    AssessmentSessionModel,
    CodeChallengeModel,
    DepthQuestionModel,
    DomainConceptMapModel,
    DomainModel,
    GradingRubricModel,
    UserNodeCompetencyModel,
)
from app.modules.assessment.rubric_grader import (
    DeterministicRubricGrader,
    RubricCriterion,
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
    ExpertRubricDryRunRequest,
    ExpertRubricDryRunResponse,
    ExpertUpdateGraphRequest,
)
from app.modules.events.internal_client import (
    assessment_service_url,
    bump_kg_cache_epoch,
    fetch_cohort_analytics_data_internal,
)
from app.modules.events.outbox import record_outbox_event_in_tx, relay_pending_outbox_events

_SANDBOX = IsolatedSandboxWorkerAdapter()
_DRY_RUN_GRADER = DeterministicRubricGrader()


def _emit_content_mutation_in_tx(
    db: Session,
    *,
    concept_slug: str | None = None,
    domain_slug: str | None = None,
    change_summary: str,
) -> list[str]:
    """Increment graph_version and record DomainGraphUpdatedEvent for all affected domains."""
    affected: list[str] = []
    if domain_slug:
        affected.append(domain_slug)
    if concept_slug:
        mapped_domains = db.scalars(
            select(DomainConceptMapModel.domain_slug).where(
                DomainConceptMapModel.concept_slug == concept_slug
            )
        ).all()
        for d_slug in mapped_domains:
            if d_slug not in affected:
                affected.append(str(d_slug))

    for d_slug in affected:
        dom = db.get(DomainModel, d_slug)
        if dom is not None:
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
                    "domain_slug": d_slug,
                    "graph_version": dom.graph_version,
                    "change_summary": change_summary,
                },
            )
    return affected


def _flush_content_caches_after_commit(db: Session, affected_domains: list[str]) -> None:
    """Invalidate Redis plumora:kg:* + cross-worker _BUNDLE_CACHE epoch and relay outbox."""
    bump_kg_cache_epoch(affected_domains if affected_domains else None)
    relay_pending_outbox_events(db)


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
    bump_kg_cache_epoch([dom.slug])
    return {"slug": dom.slug, "title": dom.title, "graph_version": dom.graph_version}


def get_expert_domain_graph(db: Session, domain_slug: str) -> dict[str, Any]:
    """Return full domain graph with lesson_markdown, question_counts_by_tier, and has_code_challenge."""
    dom = db.get(DomainModel, domain_slug)
    if dom is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "DOMAIN_NOT_FOUND", "message": f"Domain '{domain_slug}' not found."},
        )
    nodes = db.scalars(
        select(DomainConceptMapModel)
        .where(DomainConceptMapModel.domain_slug == domain_slug)
        .order_by(DomainConceptMapModel.node_idx)
    ).all()
    slugs = [n.concept_slug for n in nodes]
    qs = (
        db.scalars(
            select(DepthQuestionModel).where(
                DepthQuestionModel.concept_slug.in_(slugs),
                DepthQuestionModel.is_active.is_(True),
            )
        ).all()
        if slugs
        else []
    )
    counts_by_slug: dict[str, dict[str, int]] = {
        s: {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0} for s in slugs
    }
    for q in qs:
        tier_key = str(q.depth_tier)
        if q.concept_slug in counts_by_slug and tier_key in counts_by_slug[q.concept_slug]:
            counts_by_slug[q.concept_slug][tier_key] += 1

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

    edges: list[dict[str, str]] = []
    node_items: list[dict[str, Any]] = []
    for n in nodes:
        prereqs = list(n.prerequisites_json or [])
        for p in prereqs:
            edges.append({"concept_slug": n.concept_slug, "prereq_slug": p})
        node_items.append(
            {
                "node_idx": n.node_idx,
                "slug": n.concept_slug,
                "title": n.title,
                "tier": n.tier,
                "is_shared": n.is_shared,
                "prerequisites": prereqs,
                "lesson_markdown": n.lesson_markdown,
                "question_counts_by_tier": counts_by_slug.get(n.concept_slug, {}),
                "has_code_challenge": n.concept_slug in ch_slugs,
            }
        )

    return {
        "domain_slug": dom.slug,
        "title": dom.title,
        "description": dom.description,
        "graph_version": dom.graph_version,
        "nodes": node_items,
        "edges": edges,
    }


def update_expert_domain_graph(
    db: Session,
    domain_slug: str,
    expert_id: uuid.UUID,
    payload: ExpertUpdateGraphRequest,
) -> ExpertGraphUpdateResponse:
    """Validate DAG acyclicity, preserve stable node_idx for existing nodes, and emit DomainGraphUpdatedEvent."""
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
    existing_idx_map = {r.concept_slug: r.node_idx for r in existing_rows}
    used_indices: set[int] = set()
    next_new_idx = (max(existing_idx_map.values()) + 1) if existing_idx_map else 0

    db.execute(delete(DomainConceptMapModel).where(DomainConceptMapModel.domain_slug == domain_slug))
    for n in payload.nodes:
        if n.slug in existing_idx_map and existing_idx_map[n.slug] not in used_indices:
            stable_idx = existing_idx_map[n.slug]
        else:
            while next_new_idx in used_indices:
                next_new_idx += 1
            stable_idx = next_new_idx
            next_new_idx += 1
        used_indices.add(stable_idx)

        lesson_md = (
            n.lesson_markdown
            if n.lesson_markdown is not None and n.lesson_markdown.strip()
            else existing_lessons.get(n.slug, f"## {n.title}")
        )
        db.add(
            DomainConceptMapModel(
                domain_slug=domain_slug,
                concept_slug=n.slug,
                node_idx=stable_idx,
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
    _flush_content_caches_after_commit(db, [domain_slug])

    return ExpertGraphUpdateResponse(
        domain_slug=domain_slug,
        graph_version=dom.graph_version,
        dag_valid=True,
        total_nodes=len(payload.nodes),
        shared_nodes_count=sum(1 for n in payload.nodes if n.is_shared),
        published_event_id=ev_id,
    )


def list_expert_questions(db: Session, concept_slug: str) -> dict[str, Any]:
    """List all active 5-depth questions and their rubrics for a concept."""
    qs = db.scalars(
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
    q_ids = [q.id for q in qs]
    rubrics = (
        db.scalars(select(GradingRubricModel).where(GradingRubricModel.question_id.in_(q_ids))).all()
        if q_ids
        else []
    )
    rubric_by_q = {r.question_id: r for r in rubrics}
    return {
        "concept_slug": concept_slug,
        "questions": [
            {
                "id": str(q.id),
                "concept_slug": q.concept_slug,
                "depth_tier": q.depth_tier,
                "task_type": q.task_type,
                "prompt": q.prompt,
                "options": q.options_json,
                "correct_option_key": q.correct_option_key,
                "is_placement_eligible": q.is_placement_eligible,
                "is_active": q.is_active,
                "version": q.version,
                "rubric": (
                    {
                        "criteria": rubric_by_q[q.id].criteria_json,
                        "reference_explanation": rubric_by_q[q.id].reference_explanation,
                    }
                    if q.id in rubric_by_q
                    else None
                ),
            }
            for q in qs
        ],
    }


def _validate_rubric_weight_sum(payload: ExpertCreateQuestionRequest) -> None:
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


def create_expert_question(
    db: Session,
    concept_slug: str,
    payload: ExpertCreateQuestionRequest,
) -> dict[str, Any]:
    """Create a 5-depth question and validate Rubric weight sum == 1.0."""
    _validate_rubric_weight_sum(payload)

    max_ver = int(
        db.scalar(
            select(func.max(DepthQuestionModel.version)).where(
                DepthQuestionModel.concept_slug == concept_slug,
                DepthQuestionModel.depth_tier == payload.depth_tier,
            )
        )
        or 0
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
            correct_option_key=payload.correct_option_key.upper() if payload.correct_option_key else None,
            is_placement_eligible=payload.depth_tier <= 2 and payload.task_type == "mcq",
            is_active=payload.is_active,
            version=max_ver + 1,
        )
    )
    db.flush()

    if payload.rubric is not None:
        db.add(
            GradingRubricModel(
                id=uuid.uuid4(),
                question_id=q_id,
                criteria_json=[c.model_dump(exclude_none=True) for c in payload.rubric.criteria],
                reference_explanation=payload.rubric.reference_explanation,
            )
        )
    affected = _emit_content_mutation_in_tx(
        db,
        concept_slug=concept_slug,
        change_summary=f"Created tier-{payload.depth_tier} question for {concept_slug}",
    )
    db.commit()
    _flush_content_caches_after_commit(db, affected)
    return {
        "item_id": str(q_id),
        "concept_slug": concept_slug,
        "depth_tier": payload.depth_tier,
        "version": max_ver + 1,
    }


def update_expert_question(
    db: Session,
    question_id: uuid.UUID,
    payload: ExpertCreateQuestionRequest,
) -> dict[str, Any]:
    """Update an existing 5-depth question and its rubric."""
    _validate_rubric_weight_sum(payload)
    q = db.get(DepthQuestionModel, question_id)
    if q is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "QUESTION_NOT_FOUND", "message": "Question not found."},
        )
    q.depth_tier = payload.depth_tier
    q.task_type = payload.task_type
    q.prompt = payload.prompt
    q.options_json = payload.options
    q.correct_option_key = payload.correct_option_key.upper() if payload.correct_option_key else None
    q.is_placement_eligible = payload.depth_tier <= 2 and payload.task_type == "mcq"
    q.is_active = payload.is_active
    q.version += 1

    existing_r = db.scalars(
        select(GradingRubricModel).where(GradingRubricModel.question_id == q.id)
    ).first()
    if payload.rubric is not None:
        crit_dump = [c.model_dump(exclude_none=True) for c in payload.rubric.criteria]
        if existing_r is not None:
            existing_r.criteria_json = crit_dump
            existing_r.reference_explanation = payload.rubric.reference_explanation
        else:
            db.add(
                GradingRubricModel(
                    id=uuid.uuid4(),
                    question_id=q.id,
                    criteria_json=crit_dump,
                    reference_explanation=payload.rubric.reference_explanation,
                )
            )
    elif existing_r is not None:
        db.delete(existing_r)

    affected = _emit_content_mutation_in_tx(
        db,
        concept_slug=q.concept_slug,
        change_summary=f"Updated question {q.id} (v{q.version}) for {q.concept_slug}",
    )
    db.commit()
    _flush_content_caches_after_commit(db, affected)
    return {
        "item_id": str(q.id),
        "concept_slug": q.concept_slug,
        "depth_tier": q.depth_tier,
        "version": q.version,
    }


def delete_expert_question(db: Session, question_id: uuid.UUID) -> dict[str, Any]:
    """Soft-deactivate a 5-depth question so historical attempts remain auditable."""
    q = db.get(DepthQuestionModel, question_id)
    if q is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "QUESTION_NOT_FOUND", "message": "Question not found."},
        )
    q.is_active = False
    affected = _emit_content_mutation_in_tx(
        db,
        concept_slug=q.concept_slug,
        change_summary=f"Deactivated question {q.id} for {q.concept_slug}",
    )
    db.commit()
    _flush_content_caches_after_commit(db, affected)
    return {"deleted": True, "item_id": str(q.id)}


def dry_run_expert_rubric(payload: ExpertRubricDryRunRequest) -> ExpertRubricDryRunResponse:
    """Preview live Rubric grading on a sample student answer."""
    total_w = sum(c.weight for c in payload.rubric.criteria)
    if abs(total_w - 1.0) > 1e-4:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "error_code": "RUBRIC_WEIGHT_SUM_INVALID",
                "message": f"Rubric weights must sum to 1.0 (got {total_w:.4f}).",
            },
        )
    criteria = [
        RubricCriterion(
            name=c.name,
            weight=c.weight,
            required_keywords=c.required_keywords,
            socratic_hint=c.socratic_hint,
        )
        for c in payload.rubric.criteria
    ]
    score, summary, crit_results, source = _DRY_RUN_GRADER.grade(
        prompt=payload.prompt,
        written_explanation=payload.sample_answer,
        criteria=criteria,
        reference_explanation=payload.rubric.reference_explanation,
    )
    return ExpertRubricDryRunResponse(
        rubric_score=score,
        passed=score >= 0.75,
        grader_source=source,
        tutor_summary=summary,
        criteria_results=crit_results,
    )


def list_expert_code_challenges(db: Session, concept_slug: str) -> dict[str, Any]:
    """List code challenges for a concept (active first, newest version first)."""
    rows = db.scalars(
        select(CodeChallengeModel)
        .where(CodeChallengeModel.concept_slug == concept_slug)
        .order_by(CodeChallengeModel.is_active.desc(), CodeChallengeModel.version.desc())
    ).all()
    return {
        "concept_slug": concept_slug,
        "challenges": [
            {
                "id": str(ch.id),
                "concept_slug": ch.concept_slug,
                "title": ch.title,
                "language": ch.language,
                "prompt": ch.prompt,
                "buggy_starter_code": ch.buggy_starter_code,
                "solution_code": ch.solution_code,
                "test_cases": ch.test_cases_json,
                "timeout_ms": ch.timeout_ms,
                "memory_limit_mb": ch.memory_limit_mb,
                "setup_sql": ch.setup_sql,
                "is_active": ch.is_active,
                "version": ch.version,
            }
            for ch in rows
        ],
    }


def _run_dual_sandbox_verification(payload: ExpertCodeChallengeRequest) -> dict[str, Any]:
    """Dual Sandbox Verification: solution_code MUST pass 100% AND buggy_starter_code MUST fail >=1 test."""
    try:
        sol_res = _SANDBOX.execute(
            language=payload.language,
            source_code=payload.solution_code,
            test_cases=payload.test_cases,
            timeout_ms=payload.timeout_ms,
            memory_limit_mb=payload.memory_limit_mb,
            setup_sql=payload.setup_sql,
        )
    except (SandboxTimeoutError, SandboxSecurityError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"error_code": exc.error_code, "message": str(exc)},
        ) from exc

    if sol_res.passed_tests != sol_res.total_tests:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "error_code": "SOLUTION_TESTS_FAILED",
                "message": f"Solution code passed {sol_res.passed_tests}/{sol_res.total_tests} tests.",
                "test_results": sol_res.test_results,
            },
        )

    starter_failed = False
    starter_results: list[dict[str, Any]] = []
    try:
        starter_res = _SANDBOX.execute(
            language=payload.language,
            source_code=payload.buggy_starter_code,
            test_cases=payload.test_cases,
            timeout_ms=payload.timeout_ms,
            memory_limit_mb=payload.memory_limit_mb,
            setup_sql=payload.setup_sql,
        )
        starter_failed = starter_res.passed_tests < starter_res.total_tests
        starter_results = starter_res.test_results
    except (SandboxTimeoutError, SandboxSecurityError):
        starter_failed = True

    if not starter_failed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "error_code": "STARTER_CODE_MUST_FAIL",
                "message": "buggy_starter_code passed 100% of test cases; starter code must fail at least 1 test.",
                "test_results": starter_results,
            },
        )

    return {
        "solution_passed_all_tests": True,
        "starter_failed_at_least_one": True,
        "runtime_ms": sol_res.runtime_ms,
        "memory_kb": sol_res.memory_kb,
        "passed_tests": sol_res.passed_tests,
        "total_tests": sol_res.total_tests,
        "test_results": sol_res.test_results,
    }


def patch_expert_concept_playbook(
    db: Session,
    concept_slug: str,
    lesson_markdown: str,
) -> dict[str, Any]:
    """Update lesson_markdown for a single concept across all domains sharing it (D-41)."""
    rows = db.scalars(
        select(DomainConceptMapModel).where(DomainConceptMapModel.concept_slug == concept_slug)
    ).all()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "CONCEPT_NOT_FOUND",
                "message": f"Concept '{concept_slug}' not found.",
            },
        )
    cleaned = lesson_markdown.strip()
    for r in rows:
        r.lesson_markdown = cleaned
    affected = _emit_content_mutation_in_tx(
        db,
        concept_slug=concept_slug,
        change_summary=f"Updated Playbook markdown for {concept_slug}",
    )
    db.commit()
    _flush_content_caches_after_commit(db, affected)
    return {
        "concept_slug": concept_slug,
        "updated_domains_count": len(rows),
        "affected_domains": sorted({r.domain_slug for r in rows}),
        "markdown_length": len(cleaned),
    }


def dry_run_expert_code_challenge(payload: ExpertCodeChallengeRequest) -> dict[str, Any]:
    """Run Dual Sandbox Verification without persisting to DB (D-41)."""
    validation_run = _run_dual_sandbox_verification(payload)
    return {
        "verified": True,
        "solution_passed": bool(validation_run.get("solution_passed_all_tests", True)),
        "starter_failed": bool(validation_run.get("starter_failed_at_least_one", True)),
        "runtime_ms": int(validation_run.get("runtime_ms", 0)),
        "memory_kb": int(validation_run.get("memory_kb", 0)),
        "passed_tests": int(validation_run.get("passed_tests", 0)),
        "total_tests": int(validation_run.get("total_tests", 0)),
        "test_results": validation_run.get("test_results", []),
    }


def create_expert_code_challenge(
    db: Session,
    concept_slug: str,
    payload: ExpertCodeChallengeRequest,
) -> dict[str, Any]:
    """Dual-Sandbox-validate, deactivate old versions, and save a new active Code Challenge."""
    validation_run = _run_dual_sandbox_verification(payload)

    max_ver = int(
        db.scalar(
            select(func.max(CodeChallengeModel.version)).where(
                CodeChallengeModel.concept_slug == concept_slug
            )
        )
        or 0
    )
    db.execute(
        update(CodeChallengeModel)
        .where(CodeChallengeModel.concept_slug == concept_slug)
        .values(is_active=False)
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
            setup_sql=payload.setup_sql,
            is_active=True,
            version=max_ver + 1,
        )
    )
    affected = _emit_content_mutation_in_tx(
        db,
        concept_slug=concept_slug,
        change_summary=f"Published code challenge v{max_ver + 1} for {concept_slug}",
    )
    db.commit()
    _flush_content_caches_after_commit(db, affected)
    return {
        "item_id": str(ch_id),
        "concept_slug": concept_slug,
        "version": max_ver + 1,
        "validation_run": validation_run,
    }


def get_expert_cohort_analytics(db: Session, domain_slug: str | None = None) -> dict[str, Any]:
    """Compute 4-level competency heatmap, Bottleneck Tier Detector & real-time Ebbinghaus decay count."""
    target_domain = domain_slug or "backend"
    nodes = db.scalars(
        select(DomainConceptMapModel)
        .where(DomainConceptMapModel.domain_slug == target_domain)
        .order_by(DomainConceptMapModel.node_idx)
    ).all()
    if not nodes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "DOMAIN_NOT_FOUND", "message": f"Domain '{target_domain}' not found."},
        )

    slugs = [n.concept_slug for n in nodes]
    comp_items: list[dict[str, Any]] = []
    session_items: list[dict[str, Any]] = []

    if assessment_service_url():
        remote_data = fetch_cohort_analytics_data_internal(slugs)
        if remote_data is not None:
            comp_items = list(remote_data.get("competencies", []))
            session_items = list(remote_data.get("sessions", []))
    else:
        try:
            comp_rows = db.scalars(
                select(UserNodeCompetencyModel).where(UserNodeCompetencyModel.concept_slug.in_(slugs))
            ).all()
            session_rows = db.scalars(
                select(AssessmentSessionModel).where(
                    AssessmentSessionModel.concept_slug.in_(slugs),
                    AssessmentSessionModel.status.in_(["ceiling_reached", "insufficient_evidence"]),
                )
            ).all()
            comp_items = [
                {
                    "user_id": str(c.user_id),
                    "concept_slug": c.concept_slug,
                    "depth_level_norm": float(c.depth_level_norm),
                    "stability_s": float(c.stability_s),
                    "last_practiced_at": c.last_practiced_at,
                }
                for c in comp_rows
            ]
            session_items = [
                {
                    "concept_slug": s.concept_slug,
                    "current_depth_tier": int(s.current_depth_tier),
                }
                for s in session_rows
            ]
        except SQLAlchemyError:
            db.rollback()
            remote_data = fetch_cohort_analytics_data_internal(slugs)
            if remote_data is not None:
                comp_items = list(remote_data.get("competencies", []))
                session_items = list(remote_data.get("sessions", []))

    heatmap: list[dict[str, Any]] = []
    total_needs_review = 0
    active_learners: set[str] = set()

    for n in nodes:
        n_comps = [c for c in comp_items if c.get("concept_slug") == n.concept_slug]
        surface = applied = deep = mastery = needs_rev = 0
        for c in n_comps:
            active_learners.add(str(c["user_id"]))
            depth_norm = float(c.get("depth_level_norm", 0.0))
            stab_s = float(c.get("stability_s", 3.0))
            lp_raw = c.get("last_practiced_at")
            lp_dt = (
                datetime.fromisoformat(lp_raw)
                if isinstance(lp_raw, str)
                else (lp_raw if isinstance(lp_raw, datetime) else None)
            )

            if depth_norm >= 1.0:
                mastery += 1
            elif depth_norm >= 0.75:
                deep += 1
            elif depth_norm >= 0.50:
                applied += 1
            elif depth_norm >= 0.25:
                surface += 1

            if lp_dt is not None and depth_norm >= EbbinghausMemoryModel.MIN_DEPTH_FOR_RETENTION:
                dt = EbbinghausMemoryModel.compute_elapsed_days(lp_dt, 0.0)
                ret = EbbinghausMemoryModel.compute_retention(dt, stab_s)
                if EbbinghausMemoryModel.is_review_needed(depth_norm, ret):
                    needs_rev += 1
                    total_needs_review += 1

        n_bottlenecks = [s for s in session_items if s.get("concept_slug") == n.concept_slug]
        tier_hits: dict[int, int] = {}
        for s in n_bottlenecks:
            tier_num = int(s.get("current_depth_tier", 1))
            tier_hits[tier_num] = tier_hits.get(tier_num, 0) + 1
        bottleneck_tier = max(tier_hits, key=lambda t: tier_hits[t]) if tier_hits else None

        heatmap.append(
            {
                "concept_slug": n.concept_slug,
                "title": n.title,
                "tier": n.tier,
                "surface_count": surface,
                "applied_count": applied,
                "deep_count": deep,
                "mastery_count": mastery,
                "needs_review_count": needs_rev,
                "bottleneck_tier": bottleneck_tier,
                "bottleneck_events": len(n_bottlenecks),
            }
        )

    return {
        "domain_slug": target_domain,
        "total_active_learners": len(active_learners),
        "total_needs_review_nodes": total_needs_review,
        "concepts": heatmap,
    }
