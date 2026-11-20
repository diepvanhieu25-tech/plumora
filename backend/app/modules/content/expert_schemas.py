"""Pydantic schemas for Expert Portal endpoints (SCR-15..SCR-17)."""

from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel, Field


class ExpertCreateDomainRequest(BaseModel):
    """Create a new domain in Knowledge Graph (SCR-15)."""

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
    """Single rubric criterion with weight."""

    name: str = Field(min_length=1, max_length=128)
    weight: float = Field(gt=0.0, le=1.0)
    required_keywords: list[str] = Field(min_length=1)


class ExpertRubricIn(BaseModel):
    """Rubric structure enforcing sum(weights) == 1.0."""

    criteria: list[ExpertRubricCriterionIn] = Field(min_length=1)
    reference_explanation: str = Field(min_length=1)


class ExpertCreateQuestionRequest(BaseModel):
    """Create a 5-depth question + optional structured Rubric (SCR-16)."""

    depth_tier: int = Field(ge=1, le=5)
    task_type: str = Field(pattern="^(mcq|troubleshooting|constraint_shifting|teach_back)$")
    prompt: str = Field(min_length=5)
    options: dict[str, str] | None = None
    correct_option_key: str | None = None
    rubric: ExpertRubricIn | None = None


class ExpertCodeChallengeRequest(BaseModel):
    """Create & validate a Code Sandbox challenge (SCR-17)."""

    title: str = Field(min_length=3, max_length=128)
    language: str = Field(pattern="^(python|sql|javascript)$")
    prompt: str = Field(min_length=5)
    buggy_starter_code: str = Field(min_length=1)
    solution_code: str = Field(min_length=1)
    test_cases: list[dict[str, Any]] = Field(min_length=1)
    timeout_ms: int = Field(default=3000, ge=200, le=3000)
    memory_limit_mb: int = Field(default=128, ge=32, le=128)


class ExpertGraphUpdateResponse(BaseModel):
    """Response for PUT /api/v2/expert/domains/{slug}/graph."""

    domain_slug: str
    graph_version: int
    dag_valid: bool
    total_nodes: int
    shared_nodes_count: int
    published_event_id: uuid.UUID
