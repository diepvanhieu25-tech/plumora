"""ORM models for the Content & Knowledge Graph bounded context (schema: content_svc)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON, Uuid

from app.db.base import Base


class DomainModel(Base):
    """Multi-domain knowledge graph catalog (PL3-KG-01)."""

    __tablename__ = "domains"

    slug: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    graph_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )


class DomainConceptMapModel(Base):
    """Domain-specific concept nodes, tier, shared flag, and DAG prerequisites (PL3-KG-01)."""

    __tablename__ = "domain_concept_map"
    __table_args__ = (
        CheckConstraint("tier BETWEEN 1 AND 4", name="ck_domain_concept_tier_1_4"),
    )

    domain_slug: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("domains.slug", ondelete="CASCADE"),
        primary_key=True,
    )
    concept_slug: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    node_idx: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    tier: Mapped[int] = mapped_column(Integer, nullable=False)
    is_shared: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    prerequisites_json: Mapped[list[str]] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"),
        nullable=False,
        default=list,
    )
    lesson_markdown: Mapped[str] = mapped_column(Text, nullable=False, default="")


class DepthQuestionModel(Base):
    """5-Depth Probing and Adaptive Placement question bank (PL3-ASSESS-01)."""

    __tablename__ = "depth_questions"
    __table_args__ = (
        CheckConstraint("depth_tier BETWEEN 1 AND 5", name="ck_depth_questions_tier_1_5"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    concept_slug: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    depth_tier: Mapped[int] = mapped_column(Integer, nullable=False)
    task_type: Mapped[str] = mapped_column(String(32), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    options_json: Mapped[dict[str, str] | None] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"),
        nullable=True,
    )
    correct_option_key: Mapped[str | None] = mapped_column(String(1), nullable=True)
    is_placement_eligible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class GradingRubricModel(Base):
    """Structured Rubric for Tier 3-5 open-ended depth questions (PL3-TUTOR-01)."""

    __tablename__ = "grading_rubrics"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("depth_questions.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    criteria_json: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"),
        nullable=False,
    )
    reference_explanation: Mapped[str] = mapped_column(Text, nullable=False)


class CodeChallengeModel(Base):
    """Isolated Code Sandbox challenges with unit test cases (PL3-GRADER-01)."""

    __tablename__ = "code_challenges"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    concept_slug: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    language: Mapped[str] = mapped_column(String(16), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    buggy_starter_code: Mapped[str] = mapped_column(Text, nullable=False)
    solution_code: Mapped[str] = mapped_column(Text, nullable=False)
    test_cases_json: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"),
        nullable=False,
    )
    timeout_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=3000)
    memory_limit_mb: Mapped[int] = mapped_column(Integer, nullable=False, default=128)
    setup_sql: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
