"""Gymnasium Student Simulator environment implementation for Plumora (D-07)."""

from __future__ import annotations

from typing import Any

import gymnasium as gym
import numpy as np
from gymnasium import spaces

from plumora_rl.config import ACT_DIM, CONCEPTS_DAG, MAX_STEPS, OBS_DIM, PASS_THRESHOLD


def compute_eligibility_mask(mastery: np.ndarray) -> np.ndarray:
    """Return 12-dim float32 mask: 1.0 if unlocked and not yet mastered (<0.75), else 0.0."""
    eligible = np.zeros(ACT_DIM, dtype=np.float32)
    for spec in CONCEPTS_DAG:
        idx = spec.action_id
        if float(mastery[idx]) >= PASS_THRESHOLD:
            continue
        if all(float(mastery[p]) >= PASS_THRESHOLD for p in spec.prerequisites):
            eligible[idx] = 1.0
    return eligible


def build_observation(mastery: np.ndarray) -> np.ndarray:
    """Construct the 24-dim float32 observation vector [12 mastery + 12 is_eligible]."""
    clipped_mastery = np.clip(mastery.astype(np.float32), 0.0, 1.0)
    eligible = compute_eligibility_mask(clipped_mastery)
    return np.concatenate([clipped_mastery, eligible]).astype(np.float32)


class StudentSimulatorEnv(gym.Env[np.ndarray, int | np.integer[Any]]):
    """24-dimensional Student Simulator environment over the 12-concept Backend DAG."""

    def __init__(self, *, max_steps: int = MAX_STEPS, allow_partial_init: bool = True) -> None:
        super().__init__()
        self.metadata = {"render_modes": []}
        self.max_steps = max_steps
        self.allow_partial_init = allow_partial_init
        self.observation_space = spaces.Box(
            low=0.0,
            high=1.0,
            shape=(OBS_DIM,),
            dtype=np.float32,
        )
        self.action_space = spaces.Discrete(ACT_DIM)

        self._mastery: np.ndarray = np.zeros(ACT_DIM, dtype=np.float32)
        self._latent_competence: np.ndarray = np.zeros(ACT_DIM, dtype=np.float32)
        self._alpha: float = 0.55
        self._steps: int = 0

    def _sample_partial_dag_state(self) -> np.ndarray:
        """Sample a valid intermediate DAG mastery state for 30% of episodes (D-07)."""
        mastery = np.zeros(ACT_DIM, dtype=np.float32)
        num_mastered = int(self.np_random.integers(1, 8))
        for _ in range(num_mastered):
            eligible = compute_eligibility_mask(mastery)
            valid_indices = np.flatnonzero(eligible > 0.5)
            if valid_indices.size == 0:
                break
            chosen = int(self.np_random.choice(valid_indices))
            mastery[chosen] = float(self.np_random.choice([0.75, 1.00]))

        eligible_after = compute_eligibility_mask(mastery)
        valid_after = np.flatnonzero(eligible_after > 0.5)
        for idx in valid_after:
            if float(self.np_random.random()) < 0.35:
                mastery[int(idx)] = float(self.np_random.choice([0.25, 0.50]))
        return mastery

    def reset(
        self,
        *,
        seed: int | None = None,
        options: dict[str, Any] | None = None,
    ) -> tuple[np.ndarray, dict[str, Any]]:
        """Reset episode and sample virtual student profile without leaking latent alpha."""
        super().reset(seed=seed)
        self._steps = 0

        if options is not None and "force_alpha" in options:
            self._alpha = float(np.clip(float(options["force_alpha"]), 0.35, 0.75))
        else:
            self._alpha = float(self.np_random.uniform(0.35, 0.75))

        if options is not None and "initial_mastery" in options:
            init_arr = np.asarray(options["initial_mastery"], dtype=np.float32)
            if init_arr.shape != (ACT_DIM,):
                raise ValueError(f"initial_mastery must have shape ({ACT_DIM},)")
            self._mastery = np.clip(init_arr.copy(), 0.0, 1.0)
        elif self.allow_partial_init and float(self.np_random.random()) < 0.30:
            self._mastery = self._sample_partial_dag_state()
        else:
            self._mastery = np.zeros(ACT_DIM, dtype=np.float32)

        self._latent_competence = np.zeros(ACT_DIM, dtype=np.float32)
        obs = build_observation(self._mastery)
        info: dict[str, Any] = {
            "step": self._steps,
            "mastered_count": int(np.sum(self._mastery >= PASS_THRESHOLD)),
        }
        return obs, info

    def step(
        self,
        action: int | np.integer[Any],
    ) -> tuple[np.ndarray, float, bool, bool, dict[str, Any]]:
        """Execute learning & 4-question single-choice MCQ assessment step (D-06, D-07)."""
        act_id = int(action)
        if not (0 <= act_id < ACT_DIM):
            raise ValueError(f"Action {act_id} out of bounds for Discrete({ACT_DIM})")

        self._steps += 1
        eligible = compute_eligibility_mask(self._mastery)
        old_mastery = float(self._mastery[act_id])

        if old_mastery >= PASS_THRESHOLD:
            reward = -3.0
            prereq_violation = False
            redundant_action = True
            attempt_score: float | None = None
        elif eligible[act_id] < 0.5:
            reward = -5.0
            prereq_violation = True
            redundant_action = False
            attempt_score = None
        else:
            prereq_violation = False
            redundant_action = False
            spec = CONCEPTS_DAG[act_id]
            tier_difficulty = 0.08 + 0.07 * float(spec.tier - 1)
            if spec.prerequisites:
                prereq_mean = float(
                    np.mean([self._mastery[p] for p in spec.prerequisites])
                )
            else:
                prereq_mean = 0.85

            # Count how many other eligible concepts are currently unfinished (0 < mastery < 0.75).
            # Context-switching across multiple unfinished topics increases cognitive load.
            unfinished_others = int(
                np.sum(
                    (self._mastery > 0.0)
                    & (self._mastery < PASS_THRESHOLD)
                    & (np.arange(ACT_DIM) != act_id)
                )
            )
            cognitive_load_penalty = 0.14 * float(unfinished_others)

            base_competence = (
                0.24
                if old_mastery == 0.0
                else (0.52 + 0.55 * old_mastery)
            )
            effective_p = float(
                np.clip(
                    base_competence
                    + 0.42 * self._alpha * (1.0 - tier_difficulty)
                    + 0.12 * prereq_mean
                    - cognitive_load_penalty,
                    0.18,
                    0.96,
                )
            )
            self._latent_competence[act_id] = effective_p
            correct_count = int(
                self.np_random.binomial(4, effective_p)
            )
            attempt_score = float(correct_count) / 4.0
            new_mastery = max(old_mastery, attempt_score)
            self._mastery[act_id] = new_mastery

            newly_mastered = (
                1.0
                if (new_mastery >= PASS_THRESHOLD and old_mastery < PASS_THRESHOLD)
                else 0.0
            )
            reward = (
                -0.5
                + 4.0 * (new_mastery - old_mastery)
                + 5.0 * newly_mastered
            )
            if bool(np.all(self._mastery >= PASS_THRESHOLD)):
                reward += 15.0

        terminated = bool(np.all(self._mastery >= PASS_THRESHOLD))
        truncated = bool((not terminated) and (self._steps >= self.max_steps))
        obs = build_observation(self._mastery)
        info: dict[str, Any] = {
            "step": self._steps,
            "prerequisite_violation": prereq_violation,
            "redundant_action": redundant_action,
            "invalid_action": bool(prereq_violation or redundant_action),
            "attempt_score": attempt_score,
            "mastered_count": int(np.sum(self._mastery >= PASS_THRESHOLD)),
        }
        return obs, float(reward), terminated, truncated, info
