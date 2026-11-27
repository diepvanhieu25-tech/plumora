"""Expert Studio: Code Challenge Dual-Sandbox CRUD & Cohort Analytics."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import HTTPException, status
from plumora_rl.domain import EbbinghausMemoryModel
from sqlalchemy import func, select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.models import (
    AssessmentSessionModel,
    CodeChallengeModel,
    DomainConceptMapModel,
    UserNodeCompetencyModel,
)
from app.modules.assessment.rubric_grader import (
    DeterministicRubricGrader,
)
from app.modules.assessment.sandbox_worker import (
    IsolatedSandboxWorkerAdapter,
    SandboxSecurityError,
    SandboxTimeoutError,
)
from app.modules.content.expert_schemas import (
    ExpertCodeChallengeRequest,
)
from app.modules.content.services.domain_graph import (
    _emit_content_mutation_in_tx,
    _flush_content_caches_after_commit,
)
from app.shared.events.internal_client import (
    assessment_service_url,
    fetch_cohort_analytics_data_internal,
)

_SANDBOX = IsolatedSandboxWorkerAdapter()
_DRY_RUN_GRADER = DeterministicRubricGrader()


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
    bottleneck_agg: dict[str, dict[int, int]] = {}

    def _load_remote_cohort() -> None:
        remote_data = fetch_cohort_analytics_data_internal(slugs)
        if remote_data is None:
            return
        comp_items.extend(remote_data.get("competencies", []))
        for b in remote_data.get("bottlenecks", []):
            c_slug = str(b.get("concept_slug", ""))
            t_num = int(b.get("current_depth_tier", 1))
            cnt = int(b.get("count", 0))
            if c_slug and cnt > 0:
                bottleneck_agg.setdefault(c_slug, {})[t_num] = (
                    bottleneck_agg.get(c_slug, {}).get(t_num, 0) + cnt
                )
        for s in remote_data.get("sessions", []):
            c_slug = str(s.get("concept_slug", ""))
            t_num = int(s.get("current_depth_tier", 1))
            if c_slug:
                bottleneck_agg.setdefault(c_slug, {})[t_num] = (
                    bottleneck_agg.get(c_slug, {}).get(t_num, 0) + 1
                )

    if assessment_service_url():
        _load_remote_cohort()
    else:
        try:
            comp_rows = db.scalars(
                select(UserNodeCompetencyModel)
                .where(UserNodeCompetencyModel.concept_slug.in_(slugs))
                .limit(5000)
            ).all()
            bn_rows = db.execute(
                select(
                    AssessmentSessionModel.concept_slug,
                    AssessmentSessionModel.current_depth_tier,
                    func.count(),
                )
                .where(
                    AssessmentSessionModel.concept_slug.in_(slugs),
                    AssessmentSessionModel.status.in_(["ceiling_reached", "insufficient_evidence"]),
                )
                .group_by(
                    AssessmentSessionModel.concept_slug,
                    AssessmentSessionModel.current_depth_tier,
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
            for c_slug, tier_num, cnt in bn_rows:
                if c_slug:
                    bottleneck_agg.setdefault(str(c_slug), {})[int(tier_num)] = int(cnt)
        except SQLAlchemyError:
            db.rollback()
            _load_remote_cohort()

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

        tier_hits = bottleneck_agg.get(n.concept_slug, {})
        bottleneck_tier = max(tier_hits, key=lambda t: tier_hits[t]) if tier_hits else None
        bottleneck_events = sum(tier_hits.values())

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
                "bottleneck_events": bottleneck_events,
            }
        )

    return {
        "domain_slug": target_domain,
        "total_active_learners": len(active_learners),
        "total_needs_review_nodes": total_needs_review,
        "concepts": heatmap,
    }
