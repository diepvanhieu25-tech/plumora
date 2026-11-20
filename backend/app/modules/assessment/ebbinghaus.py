"""Ebbinghaus memory decay and spaced repetition stability tracker (PL3-MEMORY-01)."""

from __future__ import annotations

import math
from datetime import UTC, datetime

INITIAL_STABILITY_DAYS: float = 3.0
MAX_STABILITY_DAYS: float = 60.0
MIN_STABILITY_DAYS: float = 1.5
NEEDS_REVIEW_RETENTION_THRESHOLD: float = 0.60
MIN_DEPTH_FOR_RETENTION: float = 0.50


def compute_elapsed_days(
    last_practiced_at: datetime | None,
    simulated_time_offset_days: float = 0.0,
    now: datetime | None = None,
) -> float:
    """Compute elapsed days since last_practiced_at plus optional dev/test simulated offset."""
    if last_practiced_at is None:
        return max(0.0, simulated_time_offset_days)
    current = now if now is not None else datetime.now(UTC)
    lp = last_practiced_at if last_practiced_at.tzinfo is not None else last_practiced_at.replace(tzinfo=UTC)
    elapsed_real = max(0.0, (current - lp).total_seconds() / 86400.0)
    return max(0.0, elapsed_real + max(0.0, simulated_time_offset_days))


def compute_retention(delta_days: float, stability_s: float) -> float:
    """Compute Ebbinghaus retention R(t) = exp(-delta_days / S) clamped to (0.0, 1.0]."""
    safe_s = max(MIN_STABILITY_DAYS, stability_s)
    safe_dt = max(0.0, delta_days)
    r = math.exp(-safe_dt / safe_s)
    return max(1e-6, min(1.0, r))


def is_review_needed(depth_level_norm: float, retention: float) -> bool:
    """Return True when depth_level_norm >= 0.50 and R(t) < 0.60."""
    return depth_level_norm >= MIN_DEPTH_FOR_RETENTION and retention < NEEDS_REVIEW_RETENTION_THRESHOLD


def update_stability(old_s: float, score: float) -> float:
    """Update stability S_new after a review or deep probe attempt per PL3-MEMORY-01."""
    base_s = old_s if old_s > 0.0 else INITIAL_STABILITY_DAYS
    if score >= 0.75:
        return min(MAX_STABILITY_DAYS, base_s * (1.0 + 0.8 * score))
    return max(MIN_STABILITY_DAYS, 0.7 * base_s)
