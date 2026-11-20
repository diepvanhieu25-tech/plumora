"""Pydantic schemas for Admin Portal endpoints (SCR-18..SCR-20)."""

from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel, Field


class MicroBatchTrainRequest(BaseModel):
    """Trigger Safe Micro-batch Online RL fine-tuning (SCR-18)."""

    batch_size: int = Field(default=128, ge=1, le=2048)
    kl_target_max: float = Field(default=0.02, gt=0.0, le=0.2)


class ModelActionRequest(BaseModel):
    """Activate or Rollback model request (SCR-19)."""

    reason: str = Field(default="Admin action", min_length=1, max_length=255)


class ModelRegistryItemOut(BaseModel):
    """Model registry entry."""

    model_id: uuid.UUID
    version_tag: str
    checkpoint_sha256: str
    kl_divergence: float
    gate_verdict: str
    is_active: bool
    created_at: str


class OnlineRlStatusResponse(BaseModel):
    """Response for GET /api/v2/admin/online-rl/status."""

    buffer_count: int
    kl_target_max: float
    active_model: ModelRegistryItemOut | None
    models: list[ModelRegistryItemOut]
    benchmark_report: dict[str, Any] | None = None
