"""Pluggable TaskGraderStrategy Registry adhering to Open/Closed Principle (OCP)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from fastapi import HTTPException, status

from app.modules.assessment.depth_state_machine import PASS_THRESHOLD
from app.modules.assessment.rubric_grader import (
    CircuitBreakerRubricService,
    DeterministicRubricGrader,
    LlmRubricGraderAdapter,
    RubricCriterion,
)
from app.modules.contracts.dtos import DepthQuestionDTO


@dataclass(frozen=True)
class StepGradeOutput:
    """Normalized grading result across MCQ and open-ended Rubric task strategies."""

    step_score: float
    step_passed: bool
    grader_source: str
    rubric_score: float | None = None
    tutor_summary: str | None = None
    criteria_results: list[dict[str, Any]] | None = None


class TaskGraderStrategy(Protocol):
    """Strategy interface for evaluating a single 5-Depth assessment step."""

    def grade_step(
        self,
        question: DepthQuestionDTO,
        *,
        selected_option: str | None,
        written_explanation: str | None,
        is_first_miss_hint_mode: bool = False,
    ) -> StepGradeOutput:
        ...


class McqGraderStrategy:
    """Deterministic single-choice MCQ grader for Tiers 1-2."""

    def grade_step(
        self,
        question: DepthQuestionDTO,
        *,
        selected_option: str | None,
        written_explanation: str | None,
        is_first_miss_hint_mode: bool = False,
    ) -> StepGradeOutput:
        _ = (written_explanation, is_first_miss_hint_mode)
        if not selected_option:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail={"error_code": "ANSWER_REQUIRED", "message": "selected_option is required for MCQ."},
            )
        passed = selected_option.upper() == (question.correct_option_key or "").upper()
        return StepGradeOutput(
            step_score=1.0 if passed else 0.0,
            step_passed=passed,
            grader_source="deterministic_mcq",
        )


class RubricTaskGraderStrategy:
    """Rubric-based open-ended grader for troubleshooting, code_review, constraint_shifting & teach_back."""

    def __init__(self, rubric_service: CircuitBreakerRubricService) -> None:
        self._rubric_service = rubric_service

    def grade_step(
        self,
        question: DepthQuestionDTO,
        *,
        selected_option: str | None,
        written_explanation: str | None,
        is_first_miss_hint_mode: bool = False,
    ) -> StepGradeOutput:
        _ = selected_option
        explanation = (written_explanation or "").strip()
        if len(explanation) < 10:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail={
                    "error_code": "EXPLANATION_TOO_SHORT",
                    "message": "Written explanation must be at least 10 characters.",
                },
            )
        rubric = question.rubric
        criteria = [
            RubricCriterion(
                name=str(c["name"]),
                weight=float(c["weight"]),
                required_keywords=[str(k) for k in c["required_keywords"]],
                socratic_hint=str(c["socratic_hint"]) if c.get("socratic_hint") else None,
            )
            for c in (rubric.criteria_json if rubric else [])
        ]
        ref_exp = rubric.reference_explanation if rubric else ""
        res = self._rubric_service.grade_with_fallback(
            prompt=question.prompt,
            written_explanation=explanation,
            criteria=criteria,
            reference_explanation=ref_exp,
            hide_missing_keywords=is_first_miss_hint_mode,
        )
        return StepGradeOutput(
            step_score=res.rubric_score,
            step_passed=res.rubric_score >= PASS_THRESHOLD,
            grader_source=res.grader_source,
            rubric_score=res.rubric_score,
            tutor_summary=res.tutor_summary,
            criteria_results=res.criteria_results,
        )


class TaskGraderRegistry:
    """Registry mapping task_type -> TaskGraderStrategy."""

    def __init__(self, rubric_service: CircuitBreakerRubricService | None = None) -> None:
        svc = rubric_service or CircuitBreakerRubricService(
            primary=LlmRubricGraderAdapter(timeout_s=4.0),
            fallback=DeterministicRubricGrader(),
            failure_threshold=2,
        )
        mcq = McqGraderStrategy()
        rubric_strategy = RubricTaskGraderStrategy(svc)
        self._strategies: dict[str, TaskGraderStrategy] = {
            "mcq": mcq,
            "troubleshooting": rubric_strategy,
            "code_review": rubric_strategy,
            "constraint_shifting": rubric_strategy,
            "teach_back": rubric_strategy,
        }

    def register(self, task_type: str, strategy: TaskGraderStrategy) -> None:
        self._strategies[task_type] = strategy

    def get(self, task_type: str) -> TaskGraderStrategy:
        return self._strategies.get(task_type, self._strategies["troubleshooting"])
