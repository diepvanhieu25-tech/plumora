"""Concrete Strategy: Guardrailed Q-Masking inference (policy_source='dqn_masked_q')."""

from __future__ import annotations

import numpy as np

from app.modules.recommendation.strategies.base import (
    RecommendationStrategy,
    StrategyDecision,
)


class DqnMaskedQStrategy(RecommendationStrategy):
    """Safety guardrail: filter Q-values by DAG eligibility when unconstrained argmax violates DAG."""

    def select_action(
        self,
        q_values: np.ndarray | None,
        eligible_indices: list[int],
    ) -> StrategyDecision:
        assert q_values is not None
        masked_q = np.full_like(q_values, -1e9)
        masked_q[eligible_indices] = q_values[eligible_indices]
        selected_action_id = int(np.argmax(masked_q))
        return StrategyDecision(
            action_id=selected_action_id,
            policy_source="dqn_masked_q",
            guardrail_applied=True,
        )
