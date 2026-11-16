"""Baseline policies (B1, B2, B3) and DQN inference wrappers (D-07, D-08)."""

from __future__ import annotations

from typing import Protocol

import numpy as np
import torch
from stable_baselines3 import DQN

from plumora_rl.config import ACT_DIM


class PolicyProtocol(Protocol):
    """Common interface for Policies operating on the 24-dim observation vector."""

    def select_action(self, obs: np.ndarray) -> int:
        """Select an action index in 0..11 given a 24-dim observation."""


def get_eligible_actions(obs: np.ndarray) -> np.ndarray:
    """Extract eligible action indices from obs[12..23]."""
    eligible_mask = obs[ACT_DIM : 2 * ACT_DIM]
    valid = np.flatnonzero(eligible_mask > 0.5)
    if valid.size == 0:
        return np.array([0], dtype=np.int64)
    return valid


class FixedCurriculumPolicy:
    """B1 — Fixed Curriculum: pick first eligible concept in topological order 0..11."""

    def select_action(self, obs: np.ndarray) -> int:
        valid = get_eligible_actions(obs)
        return int(valid[0])


class ValidRandomPolicy:
    """B2 — Valid-Random: pick uniformly at random among currently eligible concepts."""

    def __init__(self, seed: int = 2026) -> None:
        self._rng = np.random.default_rng(seed)

    def select_action(self, obs: np.ndarray) -> int:
        valid = get_eligible_actions(obs)
        return int(self._rng.choice(valid))


class GreedyMasteryPolicy:
    """B3 — Greedy Mastery Heuristic: finish highest-mastery in-progress eligible concept first."""

    def select_action(self, obs: np.ndarray) -> int:
        valid = get_eligible_actions(obs)
        mastery = obs[:ACT_DIM]
        best_action = int(valid[0])
        best_score = float(mastery[best_action])
        for act in valid[1:]:
            act_int = int(act)
            score = float(mastery[act_int])
            if score > best_score:
                best_score = score
                best_action = act_int
        return best_action


class DQNUnmaskedPolicy:
    """DQN (Unmasked): raw argmax_a Q(s, a) from Stable-Baselines3 DQN model."""

    def __init__(self, model: DQN) -> None:
        self._model = model

    def select_action(self, obs: np.ndarray) -> int:
        action, _ = self._model.predict(obs, deterministic=True)
        return int(action)


class DQNMaskedQPolicy:
    """DQN (Masked Q / Guardrail): argmax Q(s, a) restricted to eligible actions."""

    def __init__(self, model: DQN) -> None:
        self._model = model

    def predict_with_metadata(self, obs: np.ndarray) -> tuple[int, int, bool, list[float]]:
        """Return (selected_action, raw_action, guardrail_applied, q_values_list)."""
        obs_tensor, _ = self._model.policy.obs_to_tensor(obs)
        with torch.no_grad():
            q_values_tensor = self._model.q_net(obs_tensor)
        q_values = q_values_tensor.cpu().numpy().flatten()
        raw_action = int(np.argmax(q_values))

        valid = get_eligible_actions(obs)
        if raw_action in valid:
            return raw_action, raw_action, False, [float(x) for x in q_values]

        masked_q = np.full_like(q_values, -1e9)
        masked_q[valid] = q_values[valid]
        selected_action = int(np.argmax(masked_q))
        return selected_action, raw_action, True, [float(x) for x in q_values]

    def select_action(self, obs: np.ndarray) -> int:
        selected, _, _, _ = self.predict_with_metadata(obs)
        return selected
