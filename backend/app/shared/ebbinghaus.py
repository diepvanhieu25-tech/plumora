"""Ebbinghaus memory decay & spaced repetition stability tracker (delegating to plumora_rl.domain)."""

from __future__ import annotations

from datetime import datetime

from plumora_rl.domain import EbbinghausMemoryModel
from plumora_rl.domain.ebbinghaus import (
    INITIAL_STABILITY_DAYS,
    MAX_STABILITY_DAYS,
    MIN_DEPTH_FOR_RETENTION,
    MIN_STABILITY_DAYS,
    NEEDS_REVIEW_RETENTION_THRESHOLD,
)


def compute_elapsed_days(
    last_practiced_at: datetime | None,
    simulated_time_offset_days: float = 0.0,
    now: datetime | None = None,
) -> float:
    """Compute elapsed days since last_practiced_at plus optional dev/test simulated offset."""
    return EbbinghausMemoryModel.compute_elapsed_days(
        last_practiced_at,
        simulated_time_offset_days=simulated_time_offset_days,
        now=now,
    )


def compute_retention(delta_days: float, stability_s: float) -> float:
    """Compute Ebbinghaus retention R(t) = exp(-delta_days / S) clamped to [1e-6, 1.0]."""
    return EbbinghausMemoryModel.compute_retention(delta_days, stability_s)


def is_review_needed(depth_level_norm: float, retention: float) -> bool:
    """Return True iff depth_level_norm >= 0.50 and R(t) < 0.60."""
    return EbbinghausMemoryModel.is_review_needed(depth_level_norm, retention)


def update_stability(old_s: float, score: float, passed: bool | None = None) -> float:
    """Update stability S_new after a review, deep probe, or code attempt."""
    return EbbinghausMemoryModel.update_stability(old_s, score, passed=passed)


def compute_next_review_due_at(
    last_practiced_at: datetime | None,
    stability_s: float,
    depth_norm: float = MIN_DEPTH_FOR_RETENTION,
) -> datetime | None:
    """Compute exact timestamp when R(t) drops to 0.60."""
    return EbbinghausMemoryModel.compute_next_review_due_at(
        last_practiced_at,
        stability_s,
        depth_norm=depth_norm,
    )


__all__ = [
    "INITIAL_STABILITY_DAYS",
    "MAX_STABILITY_DAYS",
    "MIN_DEPTH_FOR_RETENTION",
    "MIN_STABILITY_DAYS",
    "NEEDS_REVIEW_RETENTION_THRESHOLD",
    "EbbinghausMemoryModel",
    "compute_elapsed_days",
    "compute_next_review_due_at",
    "compute_retention",
    "is_review_needed",
    "update_stability",
]
