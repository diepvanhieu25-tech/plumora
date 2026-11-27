"""Expert Studio: 5-Depth Question & Rubric CRUD + Live Dry-Run."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import (
    DepthQuestionModel,
    GradingRubricModel,
)
from app.modules.assessment.rubric_grader import (
    DeterministicRubricGrader,
    RubricCriterion,
)
from app.modules.assessment.sandbox_worker import (
    IsolatedSandboxWorkerAdapter,
)
from app.modules.content.expert_schemas import (
    ExpertCreateQuestionRequest,
    ExpertRubricDryRunRequest,
    ExpertRubricDryRunResponse,
)
from app.modules.content.services.domain_graph import (
    _emit_content_mutation_in_tx,
    _flush_content_caches_after_commit,
)

_SANDBOX = IsolatedSandboxWorkerAdapter()
_DRY_RUN_GRADER = DeterministicRubricGrader()


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


