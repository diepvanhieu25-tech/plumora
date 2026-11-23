"""Single Source of Truth for verified multi-objective RL reward calculation (INV-DEPTH-01)."""

from __future__ import annotations

from dataclasses import dataclass

from plumora_rl.domain.ebbinghaus import NEEDS_REVIEW_RETENTION_THRESHOLD
from plumora_rl.domain.specs import COGNITIVE_COSTS, LearningMode


@dataclass(frozen=True)
class RewardBreakdown:
    """Auditable breakdown of each multi-objective reward component."""

    step_cost: float
    depth_gain_reward: float
    retention_recovery_reward: float
    code_gain_reward: float
    cognitive_cost: float
    goal_mastered_bonus: float
    total_reward: float


class MultiObjectiveRewardCalculator:
    """Verified multi-objective reward formula shared by Simulator & Online Experience Buffer.

    R = -0.4 + 5.0 * max(0, depth_after - depth_before)
             + 3.0 * retention_recovered
             + 2.5 * max(0, code_after - code_before)
             - cognitive_cost(mode)
             + (15.0 if goal_mastered else 0.0)
    """

    STEP_COST: float = -0.4
    DEPTH_WEIGHT: float = 5.0
    RETENTION_WEIGHT: float = 3.0
    CODE_WEIGHT: float = 2.5
    GOAL_BONUS: float = 15.0
    PREREQ_VIOLATION_PENALTY: float = -5.0
    REDUNDANT_ACTION_PENALTY: float = -3.0

    @classmethod
    def compute(
        cls,
        *,
        depth_before: float,
        depth_after: float,
        retention_before: float,
        retention_after: float,
        code_before: float,
        code_after: float,
        mode: LearningMode | int,
        step_passed: bool = True,
        goal_mastered: bool = False,
    ) -> RewardBreakdown:
        """Compute verified multi-objective reward strictly from competency state deltas."""
        mode_idx = int(mode)
        if mode_idx < 0 or mode_idx >= len(COGNITIVE_COSTS):
            raise ValueError(f"Unknown learning mode index: {mode_idx}")

        delta_depth = max(0.0, float(depth_after) - float(depth_before))
        delta_code = max(0.0, float(code_after) - float(code_before))
        if float(retention_before) < NEEDS_REVIEW_RETENTION_THRESHOLD and step_passed:
            delta_ret_rec = max(0.0, float(retention_after) - float(retention_before))
        else:
            delta_ret_rec = 0.0

        depth_rew = cls.DEPTH_WEIGHT * delta_depth
        ret_rew = cls.RETENTION_WEIGHT * delta_ret_rec
        code_rew = cls.CODE_WEIGHT * delta_code
        cog_cost = COGNITIVE_COSTS[mode_idx]
        goal_rew = cls.GOAL_BONUS if goal_mastered else 0.0
        total = cls.STEP_COST + depth_rew + ret_rew + code_rew - cog_cost + goal_rew

        return RewardBreakdown(
            step_cost=cls.STEP_COST,
            depth_gain_reward=round(depth_rew, 6),
            retention_recovery_reward=round(ret_rew, 6),
            code_gain_reward=round(code_rew, 6),
            cognitive_cost=cog_cost,
            goal_mastered_bonus=goal_rew,
            total_reward=round(total, 6),
        )
