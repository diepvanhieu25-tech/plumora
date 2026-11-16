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
    state_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )


class ConceptModel(Base):
    """12 Backend learning concepts table (D-05)."""

    __tablename__ = "concepts"
    __table_args__ = (
        CheckConstraint("tier BETWEEN 1 AND 4", name="ck_concepts_tier_1_4"),
    )

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


def get_db() -> Generator[Session, None, None]:
    """Yield a transactional SQLAlchemy database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


DbSession = Annotated[Session, Depends(get_db)]
