"""Concrete Strategy: Direct unmasked DQN argmax inference (policy_source='dqn')."""

from __future__ import annotations

import numpy as np

from app.modules.recommendation.strategies.base import (
    RecommendationStrategy,
    StrategyDecision,
)


class DqnDirectStrategy(RecommendationStrategy):
    """Direct Q-network greedy recommendation when argmax is naturally eligible."""

    def select_action(
        self,
        q_values: np.ndarray | None,
        eligible_indices: list[int],
    ) -> StrategyDecision:
        assert q_values is not None
        action_id = int(np.argmax(q_values))
        return StrategyDecision(
            action_id=action_id,
            policy_source="dqn",
            guardrail_applied=False,
        )
