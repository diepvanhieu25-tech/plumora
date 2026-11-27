"""ORM models for the Assessment & Grader bounded context (schema: assess_svc)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON, Uuid

from app.db.base import Base


class UserNodeCompetencyModel(Base):
    """Cross-domain 3D competency + Ebbinghaus memory state per (user, concept_slug)."""

    __tablename__ = "user_node_competency"
    __table_args__ = (
        CheckConstraint(
            "depth_level_norm >= 0.0 AND depth_level_norm <= 1.0",
            name="ck_user_node_depth_0_1",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True)
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
    playbook_completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
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
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
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
    """Idempotent attempt log for Placement, Depth Probe, Spaced Review, and Code Sandbox."""

    __tablename__ = "attempt_records"
    __table_args__ = (
        UniqueConstraint("user_id", "submission_id", name="uq_attempt_records_user_submission"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
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
