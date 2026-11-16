"""Independent evaluation suite for B1, B2, B3, DQN Unmasked, and DQN Masked Q (D-08)."""

from __future__ import annotations

from typing import Any

import numpy as np
from stable_baselines3 import DQN

from plumora_rl.baselines import (
    DQNMaskedQPolicy,
    DQNUnmaskedPolicy,
    FixedCurriculumPolicy,
    GreedyMasteryPolicy,
    PolicyProtocol,
    ValidRandomPolicy,
)
from plumora_rl.config import EVAL_EPISODES, EVAL_SEED, MAX_STEPS
from plumora_rl.simulator import StudentSimulatorEnv


def compute_summary_stats(values: list[float]) -> dict[str, float]:
    """Compute mean, std, median, and IQR (q75 - q25) for a list of numeric values."""
    arr = np.asarray(values, dtype=np.float64)
    q75, q25 = np.percentile(arr, [75, 25])
    return {
        "mean": round(float(np.mean(arr)), 4),
        "std": round(float(np.std(arr)), 4),
        "median": round(float(np.median(arr)), 4),
        "iqr": round(float(q75 - q25), 4),
    }


def evaluate_policy(
    policy: PolicyProtocol,
    base_seed: int,
    num_episodes: int,
) -> dict[str, dict[str, float]]:
    """Evaluate a single policy on num_episodes deterministic learner trajectories."""
    env = StudentSimulatorEnv(max_steps=MAX_STEPS, allow_partial_init=True)
    completions: list[float] = []
    steps_list: list[float] = []
    rewards_list: list[float] = []
    invalid_rates: list[float] = []

    for ep_idx in range(num_episodes):
        ep_seed = base_seed * 10000 + ep_idx
        obs, _ = env.reset(seed=ep_seed)
        terminated = False
        truncated = False
        ep_reward = 0.0
        ep_steps = 0
        ep_invalid = 0

        while not (terminated or truncated):
            action = policy.select_action(obs)
            obs, reward, terminated, truncated, info = env.step(action)
            ep_reward += float(reward)
            ep_steps += 1
            if info.get("prerequisite_violation", False) or info.get("redundant_action", False):
                ep_invalid += 1

        completions.append(1.0 if terminated else 0.0)
        steps_list.append(float(ep_steps))
        rewards_list.append(ep_reward)
        invalid_rates.append(float(ep_invalid) / float(max(ep_steps, 1)))

    return {
        "completion_rate": compute_summary_stats(completions),
        "steps_to_completion": compute_summary_stats(steps_list),
        "episodic_reward": compute_summary_stats(rewards_list),
        "invalid_action_rate": compute_summary_stats(invalid_rates),
    }


def run_full_benchmark(
    model: DQN,
    eval_seed: int = EVAL_SEED,
    num_episodes: int = EVAL_EPISODES,
) -> dict[str, Any]:
    """Run the 500-episode benchmark across B1, B2, B3, DQN Unmasked, and DQN Masked Q."""
    policies: dict[str, PolicyProtocol] = {
        "B1_fixed_curriculum": FixedCurriculumPolicy(),
        "B2_valid_random": ValidRandomPolicy(seed=eval_seed),
        "B3_greedy_mastery": GreedyMasteryPolicy(),
        "DQN_unmasked": DQNUnmaskedPolicy(model),
        "DQN_masked_q": DQNMaskedQPolicy(model),
    }

    results: dict[str, dict[str, dict[str, float]]] = {}
    for name, policy in policies.items():
        results[name] = evaluate_policy(policy, base_seed=eval_seed, num_episodes=num_episodes)

    return {
        "eval_seed": eval_seed,
        "num_episodes": num_episodes,
        "policies": results,
    }
