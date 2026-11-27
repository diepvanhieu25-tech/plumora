"""Pydantic schemas for Expert Studio CRUD, Dry-Run, Dual Verification & Cohort Analytics."""

from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


class ExpertCreateDomainRequest(BaseModel):
    """Create a new domain in Knowledge Graph."""

    slug: str = Field(min_length=2, max_length=64, pattern=r"^[a-z0-9_-]+$")
    title: str = Field(min_length=2, max_length=128)
    description: str = ""


class ExpertGraphNodeIn(BaseModel):
    """Node definition inside PUT /api/v2/expert/domains/{slug}/graph."""

    slug: str = Field(min_length=2, max_length=64)
    title: str = Field(min_length=2, max_length=128)
    tier: int = Field(ge=1, le=4)
    is_shared: bool = False
    lesson_markdown: str | None = None


class ExpertGraphEdgeIn(BaseModel):
    """Directed prerequisite edge (concept_slug depends on prereq_slug)."""

    concept_slug: str
    prereq_slug: str


class ExpertUpdateGraphRequest(BaseModel):
    """Update full domain DAG nodes and prerequisite edges."""

    nodes: list[ExpertGraphNodeIn] = Field(min_length=1)
    edges: list[ExpertGraphEdgeIn] = []


class ExpertRubricCriterionIn(BaseModel):
    """Single rubric criterion with weight and optional Socratic hint."""

    name: str = Field(min_length=1, max_length=128)
    weight: float = Field(gt=0.0, le=1.0)
    required_keywords: list[str] = Field(min_length=1)
    socratic_hint: str | None = None


class ExpertRubricIn(BaseModel):
    """Rubric structure enforcing sum(weights) == 1.0."""

    criteria: list[ExpertRubricCriterionIn] = Field(min_length=1)
    reference_explanation: str = Field(min_length=1)


class ExpertCreateQuestionRequest(BaseModel):
    """Create or update a 5-depth question + structured Rubric (supports code_review)."""

    depth_tier: int = Field(ge=1, le=5)
    task_type: str = Field(
        pattern="^(mcq|troubleshooting|code_review|constraint_shifting|teach_back)$"
    )
    prompt: str = Field(min_length=5)
    options: dict[str, str] | None = None
    correct_option_key: str | None = None
    rubric: ExpertRubricIn | None = None
    is_active: bool = True

    @model_validator(mode="after")
    def validate_task_type_fields(self) -> ExpertCreateQuestionRequest:
        if self.task_type == "mcq":
            if not self.options or len(self.options) < 2:
                raise ValueError("MCQ questions require at least 2 options (e.g., A/B/C/D).")
            if not self.correct_option_key or self.correct_option_key.upper() not in {
                k.upper() for k in self.options
            }:
                raise ValueError("MCQ questions require a valid correct_option_key present in options.")
        elif self.rubric is None:
            raise ValueError(f"Task type '{self.task_type}' requires a structured rubric.")
        return self


class ExpertRubricDryRunRequest(BaseModel):
    """Live grading preview request for Expert Rubric Dry-Run."""

    prompt: str = Field(min_length=5)
    sample_answer: str = Field(min_length=1)
    rubric: ExpertRubricIn


class ExpertRubricDryRunResponse(BaseModel):
    """Live grading preview response for Expert Rubric Dry-Run."""

    rubric_score: float
    passed: bool
    grader_source: str
    tutor_summary: str
    criteria_results: list[dict[str, Any]]


class ExpertCodeChallengeRequest(BaseModel):
    """Create or update & Dual-Sandbox-validate a Code Sandbox challenge."""

    title: str = Field(min_length=3, max_length=128)
    language: str = Field(pattern="^(python|sql|javascript)$")
    prompt: str = Field(min_length=5)
    buggy_starter_code: str = Field(min_length=1)
    solution_code: str = Field(min_length=1)
    test_cases: list[dict[str, Any]] = Field(min_length=1)
    timeout_ms: int = Field(default=3000, ge=200, le=3000)
    memory_limit_mb: int = Field(default=128, ge=32, le=128)
    setup_sql: str | None = None


class ExpertPlaybookPatchRequest(BaseModel):
    """Patch lesson_markdown for a single concept without re-uploading the entire domain graph."""

    lesson_markdown: str = Field(min_length=10)

    @field_validator("lesson_markdown")
    @classmethod
    def _validate_non_blank_markdown(cls, v: str) -> str:
        if len(v.strip()) < 10:
            raise ValueError("lesson_markdown must contain at least 10 non-whitespace characters")
        return v


class ExpertGraphUpdateResponse(BaseModel):
    """Response for PUT /api/v2/expert/domains/{slug}/graph."""

    domain_slug: str
    graph_version: int
    dag_valid: bool
    total_nodes: int
    shared_nodes_count: int
    published_event_id: uuid.UUID
