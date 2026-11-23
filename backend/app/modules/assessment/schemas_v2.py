"""Pydantic schemas for Phase 3/v3 Assessment, Playbook Completion, Code Sandbox & Recommendations."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class PlacementQuestionItem(BaseModel):
    """Question payload returned in Adaptive Placement."""

    question_id: uuid.UUID
    concept_slug: str
    tier: int
    prompt: str
    options: dict[str, str]


class PlacementStartResponse(BaseModel):
    """Response for POST /api/v2/domains/{slug}/placement/start."""

    session_id: uuid.UUID
    domain_slug: str
    max_questions: int
    current_question: PlacementQuestionItem | None


class PlacementAnswerRequest(BaseModel):
    """Request for POST /api/v2/domains/{slug}/placement/{session_id}/answer."""

    submission_id: uuid.UUID
    question_id: uuid.UUID
    selected_option: str = Field(min_length=1, max_length=1)


class PlacementInitializedNode(BaseModel):
    """Initialized competency entry produced by Adaptive Placement."""

    concept_slug: str
    depth_level_norm: float
    confidence: float
    stability_s: float


class PlacementAnswerResponse(BaseModel):
    """Response for POST /api/v2/domains/{slug}/placement/{session_id}/answer."""

    idempotent_replay: bool = False
    step_passed: bool
    placement_status: str  # "in_progress" | "completed"
    next_question: PlacementQuestionItem | None
    initialized_nodes: list[PlacementInitializedNode]


class PlaybookCompleteRequest(BaseModel):
    """Request for POST /api/v2/domains/{domain_slug}/concepts/{slug}/playbook/complete (INV-SEQ-01)."""

    submission_id: uuid.UUID | None = None
    quick_check_answers: list[dict[str, str]] = Field(default_factory=list)


class UpdatedCompetencyOut(BaseModel):
    """Updated competency & real Ebbinghaus memory state."""

    depth_level_norm: float
    depth_label: str
    confidence: float
    stability_s: float
    stability_s_before: float | None = None
    stability_s_after: float | None = None
    retention_ebbinghaus: float
    next_review_due_at: datetime | None = None


class PlaybookCompleteResponse(BaseModel):
    """Response for POST /api/v2/domains/{domain_slug}/concepts/{slug}/playbook/complete."""

    domain_slug: str
    concept_slug: str
    playbook_completed: bool
    idempotent_replay: bool = False
    updated_competency: UpdatedCompetencyOut


class AssessmentStartRequest(BaseModel):
    """Request for POST /api/v2/assessments/start."""

    domain_slug: str
    concept_slug: str
    session_mode: str = Field(pattern="^(depth_probe|spaced_review)$")


class DepthStepItem(BaseModel):
    """Single step item in 5-Depth Probing State Machine."""

    question_id: uuid.UUID
    depth_tier: int
    task_type: str
    prompt: str
    options: dict[str, str] | None = None
    rubric_summary: list[dict[str, Any]] | None = None


class AssessmentStartResponse(BaseModel):
    """Response for POST /api/v2/assessments/start."""

    session_id: uuid.UUID
    concept_slug: str
    session_mode: str
    current_depth_tier: int
    step_item: DepthStepItem


class AssessmentSubmitRequest(BaseModel):
    """Request for POST /api/v2/assessments/{session_id}/submit."""

    submission_id: uuid.UUID
    question_id: uuid.UUID
    selected_option: str | None = None
    written_explanation: str | None = None


class TutorFeedbackOut(BaseModel):
    """AI Tutor & Rubric breakdown output."""

    summary: str
    criteria_results: list[dict[str, Any]]


class AssessmentSubmitResponse(BaseModel):
    """Response for POST /api/v2/assessments/{session_id}/submit."""

    attempt_id: uuid.UUID
    idempotent_replay: bool
    step_score: float
    step_passed: bool
    grader_source: str
    session_status: str
    next_depth_tier: int | None
    next_step_item: DepthStepItem | None
    updated_competency: UpdatedCompetencyOut
    tutor_feedback: TutorFeedbackOut | None = None


class AssessmentAbandonResponse(BaseModel):
    """Response for POST /api/v2/assessments/{session_id}/abandon."""

    session_id: uuid.UUID
    session_status: str
    updated_competency: UpdatedCompetencyOut


class CodeChallengeOut(BaseModel):
    """Public Code Challenge payload."""

    challenge_id: uuid.UUID
    concept_slug: str
    title: str
    language: str
    prompt: str
    buggy_starter_code: str
    public_test_cases: list[dict[str, Any]]
    timeout_ms: int
    memory_limit_mb: int


class CodeSandboxSubmitRequest(BaseModel):
    """Request for POST /api/v2/concepts/{slug}/code-sandbox/submit."""

    submission_id: uuid.UUID
    challenge_id: uuid.UUID
    language: str = Field(pattern="^(python|sql|javascript)$")
    source_code: str = Field(min_length=1, max_length=20000)


class CodeSandboxSubmitResponse(BaseModel):
    """Response for POST /api/v2/concepts/{slug}/code-sandbox/submit."""

    attempt_id: uuid.UUID
    idempotent_replay: bool
    passed_tests: int
    total_tests: int
    code_score: float
    runtime_ms: int
    memory_kb: int
    test_results: list[dict[str, Any]]
    updated_competency: UpdatedCompetencyOut


class V2RecommendationRequest(BaseModel):
    """Request for POST /api/v2/recommendations."""

    domain_slug: str


class V2RecommendedAction(BaseModel):
    """Recommended (concept_slug, learning_mode) pair."""

    concept_slug: str
    title: str
    tier: int
    learning_mode: str
    reason_vi: str


class V2RecommendationResponse(BaseModel):
    """Response for POST /api/v2/recommendations."""

    domain_slug: str
    status: str  # "active" | "completed"
    recommended_action: V2RecommendedAction | None
    policy_source: str
    state_source: str
    guardrail_applied: bool
    retention_alert: bool
    checkpoint_sha256: str
    node_features_snapshot: list[list[float]] = []
