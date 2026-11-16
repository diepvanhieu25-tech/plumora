"""Concrete Strategy: Topological DAG fallback policy (policy_source='fallback_rule')."""

from __future__ import annotations

import numpy as np

from app.modules.recommendation.strategies.base import (
    RecommendationStrategy,
    StrategyDecision,
)


class DagTierFallbackStrategy(RecommendationStrategy):
    """Graceful degradation fallback when RL checkpoint is missing, corrupted, or unverified."""

    def select_action(
        self,
        q_values: np.ndarray | None,
        eligible_indices: list[int],
    ) -> StrategyDecision:
        # First eligible concept in topological order (B1 Baseline)
        selected_action_id = int(eligible_indices[0])
        return StrategyDecision(
            action_id=selected_action_id,
            policy_source="fallback_rule",
            guardrail_applied=False,
        )
