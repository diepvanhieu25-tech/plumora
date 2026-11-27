"""ORM models for the Recommendation & Online RL bounded context (schema: rec_ai_svc)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON, Uuid

from app.db.base import Base


class RecommendationLogModel(Base):
    """Audit log of GNN-PPO / Guardrail / Fallback v2 recommendations served to learners."""

    __tablename__ = "recommendation_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    domain_slug: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="backend",
        index=True,
    )
    recommended_concept_slug: Mapped[str | None] = mapped_column(String(64), nullable=True)
    recommended_mode: Mapped[str | None] = mapped_column(String(32), nullable=True)
    state_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    policy_source: Mapped[str] = mapped_column(String(32), nullable=False)
    state_source: Mapped[str] = mapped_column(String(32), nullable=False)
    guardrail_applied: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    checkpoint_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
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
