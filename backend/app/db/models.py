"""PostgreSQL SQLAlchemy models and session management for Plumora SSoT (D-05, D-06, D-10, D-11)."""

from __future__ import annotations

import uuid
from collections.abc import Generator
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import Depends
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from sqlalchemy.types import JSON, Uuid

from app.config import settings


class Base(DeclarativeBase):
    """Base declarative class for all Plumora PostgreSQL tables."""


class UserModel(Base):
    """Learner account table (Data Minimization per D-11)."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(64), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="learner")
    state_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )


class ConceptModel(Base):
    """12 Backend learning concepts table (D-05)."""

    __tablename__ = "concepts"
    __table_args__ = (CheckConstraint("tier BETWEEN 1 AND 4", name="ck_concepts_tier_1_4"),)

    action_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    tier: Mapped[int] = mapped_column(Integer, nullable=False)
    lesson_markdown: Mapped[str] = mapped_column(Text, nullable=False)
    content_version: Mapped[str] = mapped_column(String(32), nullable=False, default="1.0.0")


class ConceptPrerequisiteModel(Base):
    """Directed Acyclic Graph prerequisite edges between concepts (D-05)."""

    __tablename__ = "concept_prerequisites"
    __table_args__ = (
        CheckConstraint(
            "prereq_action_id != concept_action_id",
            name="ck_prereq_not_self",
        ),
    )

    concept_action_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("concepts.action_id", ondelete="CASCADE"),
        primary_key=True,
    )
    prereq_action_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("concepts.action_id", ondelete="CASCADE"),
        primary_key=True,
    )


class QuizQuestionModel(Base):
    """Single-choice MCQ question bank for each concept (D-06)."""

    __tablename__ = "quiz_questions"
    __table_args__ = (
        CheckConstraint(
            "correct_option_key IN ('A', 'B', 'C', 'D')",
            name="ck_quiz_question_correct_key",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    concept_action_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("concepts.action_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    options_json: Mapped[dict[str, str]] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"),
        nullable=False,
    )
    correct_option_key: Mapped[str] = mapped_column(String(1), nullable=False)


class UserConceptMasteryModel(Base):
    """Per-learner concept mastery scores (High-water mark per D-06, D-10)."""

    __tablename__ = "user_concept_mastery"
    __table_args__ = (
        CheckConstraint(
            "mastery_score >= 0.0 AND mastery_score <= 1.0",
            name="ck_mastery_score_0_1",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    concept_action_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("concepts.action_id", ondelete="CASCADE"),
        primary_key=True,
    )
    mastery_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    is_mastered: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )


class QuizAttemptModel(Base):
    """Quiz attempt history with idempotent (user_id, submission_id) constraint (D-06, D-10)."""

    __tablename__ = "quiz_attempts"
    __table_args__ = (
        UniqueConstraint("user_id", "submission_id", name="uq_quiz_attempts_user_submission"),
        CheckConstraint("correct_count BETWEEN 0 AND 4", name="ck_quiz_attempts_correct_0_4"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    submission_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    concept_action_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("concepts.action_id", ondelete="CASCADE"),
        nullable=False,
    )
    correct_count: Mapped[int] = mapped_column(Integer, nullable=False)
    attempt_score: Mapped[float] = mapped_column(Float, nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    mastery_before: Mapped[float] = mapped_column(Float, nullable=False)
    mastery_after: Mapped[float] = mapped_column(Float, nullable=False)
    answers_json: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"),
        nullable=False,
    )
    state_version: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    newly_unlocked_json: Mapped[list[str] | None] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"),
        nullable=True,
        default=None,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )


class RecommendationLogModel(Base):
    """Audit log of RL / Fallback recommendations served to learners (D-07, D-10)."""

    __tablename__ = "recommendation_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    state_version: Mapped[int] = mapped_column(Integer, nullable=False)
    recommended_action_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    policy_source: Mapped[str] = mapped_column(String(32), nullable=False)
    state_source: Mapped[str] = mapped_column(String(32), nullable=False)
    guardrail_applied: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    checkpoint_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )


engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


class DomainModel(Base):
    """Multi-domain knowledge graph catalog (P3-SLICE-1, PL3-KG-01)."""

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


class UserNodeCompetencyModel(Base):
    """Cross-domain 3D competency + Ebbinghaus memory state per (user, concept_slug)."""

    __tablename__ = "user_node_competency"
    __table_args__ = (
        CheckConstraint(
            "depth_level_norm >= 0.0 AND depth_level_norm <= 1.0",
            name="ck_user_node_depth_0_1",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    concept_slug: Mapped[str] = mapped_column(String(64), primary_key=True)
    depth_level_norm: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    peak_depth_level_norm: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    depth_label: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="Untested / Below Surface",
    )
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    stability_s: Mapped[float] = mapped_column(Float, nullable=False, default=3.0)
    last_practiced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    code_practice_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )


class AssessmentSessionModel(Base):
    """Session state for Adaptive Placement, 5-Depth Probing, and Spaced Review."""

    __tablename__ = "assessment_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    domain_slug: Mapped[str] = mapped_column(String(64), nullable=False)
    concept_slug: Mapped[str | None] = mapped_column(String(64), nullable=True)
    session_mode: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    current_depth_tier: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    consecutive_fails_at_tier: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    highest_passed_tier: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    steps_completed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    state_json: Mapped[dict[str, Any]] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"),
        nullable=False,
        default=dict,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )


class AttemptRecordModel(Base):
    """Idempotent attempt log for v2 Placement, Depth Probe, Spaced Review, and Code Sandbox."""

    __tablename__ = "attempt_records"
    __table_args__ = (
        UniqueConstraint("user_id", "submission_id", name="uq_attempt_records_user_submission"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    submission_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    session_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    concept_slug: Mapped[str] = mapped_column(String(64), nullable=False)
    attempt_type: Mapped[str] = mapped_column(String(32), nullable=False)
    question_or_challenge_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    step_score: Mapped[float] = mapped_column(Float, nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    grader_source: Mapped[str] = mapped_column(String(32), nullable=False)
    response_json: Mapped[dict[str, Any]] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )


class OutboxEventModel(Base):
    """Transactional Outbox table for reliable Redis Streams event publishing (PL3-ARCH-01)."""

    __tablename__ = "outbox_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), unique=True, nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    stream_name: Mapped[str] = mapped_column(String(64), nullable=False)
    payload_json: Mapped[dict[str, Any]] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"),
        nullable=False,
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )


class ConsumedEventModel(Base):
    """Idempotent consumer deduplication table keyed by event_id (PL3-ARCH-01)."""

    __tablename__ = "consumed_events"

    event_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True)
    consumer_group: Mapped[str] = mapped_column(String(64), nullable=False)
    consumed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )


class RlExperienceBufferModel(Base):
    """Verified Experience Buffer for Safe Micro-batch Online RL (INV-ONLINE-RL-01)."""

    __tablename__ = "rl_experience_buffer"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), unique=True, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    domain_slug: Mapped[str] = mapped_column(String(64), nullable=False)
    concept_slug: Mapped[str] = mapped_column(String(64), nullable=False)
    action_mode: Mapped[str] = mapped_column(String(32), nullable=False)
    reward: Mapped[float] = mapped_column(Float, nullable=False)
    obs_before_json: Mapped[dict[str, Any] | list[list[float]]] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"),
        nullable=False,
    )
    obs_after_json: Mapped[dict[str, Any] | list[list[float]]] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )


class ModelRegistryModel(Base):
    """Safe Model Registry supporting Safety Gate & 1-Click Rollback (INV-ONLINE-RL-01)."""

    __tablename__ = "model_registry"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    version_tag: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    checkpoint_path: Mapped[str] = mapped_column(String(255), nullable=False)
    checkpoint_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    kl_divergence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    gate_verdict: Mapped[str] = mapped_column(String(16), nullable=False, default="BLOCKED")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    eval_metrics_json: Mapped[dict[str, Any]] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"),
        nullable=False,
        default=dict,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class OnlineEvalRunModel(Base):
    """Automated Safety Evaluation Gate run audit log (200-episode gate)."""

    __tablename__ = "online_eval_runs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_model_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("model_registry.id", ondelete="CASCADE"),
        nullable=False,
    )
    gate_verdict: Mapped[str] = mapped_column(String(16), nullable=False)
    invalid_action_rate_unmasked: Mapped[float] = mapped_column(Float, nullable=False)
    masked_violation_rate: Mapped[float] = mapped_column(Float, nullable=False)
    mean_reward_ratio_vs_prod: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )


def get_db() -> Generator[Session, None, None]:
    """Yield a transactional SQLAlchemy database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


DbSession = Annotated[Session, Depends(get_db)]
