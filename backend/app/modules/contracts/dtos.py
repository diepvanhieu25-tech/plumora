"""Pure frozen DTOs shared across Bounded Context boundaries (zero SQLAlchemy dependencies)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class StandardErrorDetail(BaseModel):
    """Canonical machine-readable error envelope."""

    model_config = ConfigDict(frozen=True)

    error_code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class ConceptNodeDTO(BaseModel):
    """Pure concept node metadata within a domain DAG."""

    model_config = ConfigDict(frozen=True)

    domain_slug: str
    concept_slug: str
    node_idx: int
    title: str
    tier: int
    is_shared: bool = False
    prerequisites: tuple[str, ...] = ()
    lesson_markdown: str = ""
    has_code_challenge: bool = False
    question_tiers_available: tuple[int, ...] = ()


class GradingRubricDTO(BaseModel):
    """Pure structured grading rubric for Tier 3-5 open-ended questions."""

    model_config = ConfigDict(frozen=True)

    question_id: uuid.UUID
    criteria_json: list[dict[str, Any]]
    reference_explanation: str


class DepthQuestionDTO(BaseModel):
    """Pure 5-depth or placement question item."""

    model_config = ConfigDict(frozen=True)

    id: uuid.UUID
    concept_slug: str
    depth_tier: int
    task_type: str
    prompt: str
    options_json: dict[str, str] | None = None
    correct_option_key: str | None = None
    is_placement_eligible: bool = False
    is_active: bool = True
    version: int = 1
    display_order: int = 0
    rubric: GradingRubricDTO | None = None


class CodeChallengeDTO(BaseModel):
    """Pure isolated Code Sandbox challenge definition."""

    model_config = ConfigDict(frozen=True)

    id: uuid.UUID
    concept_slug: str
    title: str
    language: str
    prompt: str
    buggy_starter_code: str
    test_cases_json: list[dict[str, Any]]
    timeout_ms: int = 3000
    memory_limit_mb: int = 128
    setup_sql: str | None = None
    is_active: bool = True
    version: int = 1
    display_order: int = 0


class DomainTopologyDTO(BaseModel):
    """Pure domain DAG topology and associated assessment questions."""

    model_config = ConfigDict(frozen=True)

    domain_slug: str
    title: str
    description: str = ""
    graph_version: int = 1
    nodes: tuple[ConceptNodeDTO, ...] = ()
    questions: tuple[DepthQuestionDTO, ...] = ()


class ConceptBundleDTO(BaseModel):
    """Pure per-concept bundle containing node metadata, questions, rubrics, and code challenge."""

    model_config = ConfigDict(frozen=True)

    node: ConceptNodeDTO
    questions: tuple[DepthQuestionDTO, ...] = ()
    code_challenge: CodeChallengeDTO | None = None


class UserNodeCompetencyDTO(BaseModel):
    """Pure per-node learner competency & Ebbinghaus memory state."""

    model_config = ConfigDict(frozen=True)

    concept_slug: str
    depth_level_norm: float = 0.0
    peak_depth_level_norm: float = 0.0
    depth_label: str = "Untested / Below Surface"
    confidence: float = 0.0
    stability_s: float = 3.0
    last_practiced_at: datetime | None = None
    playbook_completed_at: datetime | None = None
    code_practice_score: float = 0.0


class UserCompetencySnapshotDTO(BaseModel):
    """Pure cross-domain competency snapshot for a learner (including state_version & placements)."""

    model_config = ConfigDict(frozen=True)

    user_id: uuid.UUID
    state_version: int = 1
    completed_placement_domains: tuple[str, ...] = ()
    competencies: tuple[UserNodeCompetencyDTO, ...] = ()

    def by_slug(self) -> dict[str, UserNodeCompetencyDTO]:
        return {c.concept_slug: c for c in self.competencies}
