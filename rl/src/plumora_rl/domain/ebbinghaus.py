"""Single Source of Truth for Ebbinghaus memory decay & stability dynamics."""

from __future__ import annotations

import math
from datetime import UTC, datetime, timedelta

INITIAL_STABILITY_DAYS: float = 3.0
MAX_STABILITY_DAYS: float = 60.0
MIN_STABILITY_DAYS: float = 1.5
NEEDS_REVIEW_RETENTION_THRESHOLD: float = 0.60
MIN_DEPTH_FOR_RETENTION: float = 0.50
PASS_SCORE_THRESHOLD: float = 0.75


class EbbinghausMemoryModel:
    """Canonical Ebbinghaus forgetting curve R(t) = exp(-dt / S) and scheduling math."""

    INITIAL_STABILITY_DAYS: float = INITIAL_STABILITY_DAYS
    MAX_STABILITY_DAYS: float = MAX_STABILITY_DAYS
    MIN_STABILITY_DAYS: float = MIN_STABILITY_DAYS
    NEEDS_REVIEW_RETENTION_THRESHOLD: float = NEEDS_REVIEW_RETENTION_THRESHOLD
    MIN_DEPTH_FOR_RETENTION: float = MIN_DEPTH_FOR_RETENTION

    @staticmethod
    def compute_elapsed_days(
        last_practiced_at: datetime | None,
        simulated_time_offset_days: float = 0.0,
        now: datetime | None = None,
    ) -> float:
        """Compute elapsed days since last_practiced_at plus optional test/sandbox offset."""
        if last_practiced_at is None:
            return max(0.0, float(simulated_time_offset_days))
        current = now if now is not None else datetime.now(UTC)
        if current.tzinfo is None:
            current = current.replace(tzinfo=UTC)
        lp = (
            last_practiced_at
            if last_practiced_at.tzinfo is not None
            else last_practiced_at.replace(tzinfo=UTC)
        )
        elapsed_real = max(0.0, (current - lp).total_seconds() / 86400.0)
        return max(0.0, elapsed_real + max(0.0, float(simulated_time_offset_days)))

    @staticmethod
    def compute_retention(elapsed_days: float, stability_s: float) -> float:
        """Compute R(t) = exp(-elapsed_days / S) clamped to [1e-6, 1.0]."""
        safe_s = max(MIN_STABILITY_DAYS, float(stability_s))
        safe_dt = max(0.0, float(elapsed_days))
        r = math.exp(-safe_dt / safe_s)
        return max(1e-6, min(1.0, r))

    @staticmethod
    def is_review_needed(depth_norm: float, retention: float) -> bool:
        """Return True iff depth_norm >= 0.50 and retention < 0.60."""
        return (
            float(depth_norm) >= MIN_DEPTH_FOR_RETENTION
            and float(retention) < NEEDS_REVIEW_RETENTION_THRESHOLD
        )

    @staticmethod
    def update_stability(
        stability_s: float,
        score: float,
        passed: bool | None = None,
    ) -> float:
        """Update memory stability S_new after a review/probe/code attempt."""
        base_s = float(stability_s) if float(stability_s) > 0.0 else INITIAL_STABILITY_DAYS
        is_passed = (float(score) >= PASS_SCORE_THRESHOLD) if passed is None else bool(passed)
        if is_passed:
            return min(MAX_STABILITY_DAYS, base_s * (1.0 + 0.8 * max(0.0, min(1.0, float(score)))))
        return max(MIN_STABILITY_DAYS, 0.7 * base_s)

    @staticmethod
    def compute_next_review_due_at(
        last_practiced_at: datetime | None,
        stability_s: float,
        depth_norm: float = 0.50,
    ) -> datetime | None:
        """Solve exp(-dt / S) = 0.60 -> dt = -S * ln(0.60) days after last_practiced_at."""
        if last_practiced_at is None or float(depth_norm) < MIN_DEPTH_FOR_RETENTION:
            return None
        lp = (
            last_practiced_at
            if last_practiced_at.tzinfo is not None
            else last_practiced_at.replace(tzinfo=UTC)
        )
        safe_s = max(MIN_STABILITY_DAYS, float(stability_s))
        due_days = -safe_s * math.log(NEEDS_REVIEW_RETENTION_THRESHOLD)
        return lp + timedelta(days=due_days)
