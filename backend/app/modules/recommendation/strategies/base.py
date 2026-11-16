"""Strategy Pattern Interface for Plumora Recommendation Policies (D-07, D-10)."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import NamedTuple

import numpy as np


class StrategyDecision(NamedTuple):
    action_id: int
    policy_source: str
    guardrail_applied: bool


class RecommendationStrategy(ABC):
    """Abstract Strategy interface for choosing next learning action."""

    @abstractmethod
    def select_action(
        self,
        q_values: np.ndarray | None,
        eligible_indices: list[int],
    ) -> StrategyDecision:
        """Select the next action index given Q-values and eligible DAG indices."""
        raise NotImplementedError
