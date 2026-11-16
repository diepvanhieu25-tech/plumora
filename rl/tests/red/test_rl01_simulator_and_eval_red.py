"""Behavioral TDD tests for RL-01 (PL-RL-01: Simulator, Reward, Baselines, Training & Eval)."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np

from plumora_rl.config import EVAL_EPISODES, EVAL_SEED, TRAIN_SEEDS, VAL_SEED
from plumora_rl.simulator import StudentSimulatorEnv

ARTIFACTS_DIR = Path(__file__).resolve().parents[2] / "artifacts"


def test_pl_rl_01_simulator_reset_and_observation_no_leakage() -> None:
    """PL-RL-01 (D-07): Reset returns 24-dim observation [12 mastery + 12 is_eligible] with no leakage."""
    env = StudentSimulatorEnv(allow_partial_init=False)
    obs, info = env.reset(seed=101)
    assert obs.shape == (24,)
    assert obs.dtype == np.float32
    assert np.all(obs[:12] == 0.0)
    # Only Tier 1 root nodes (0: net-internet, 1: os-basics) are eligible initially
    assert obs[12] == 1.0 and obs[13] == 1.0
    assert np.all(obs[14:] == 0.0)
    assert "latent_alpha" not in info
    assert "alpha" not in info


def test_pl_rl_01_locked_action_penalized_minus_5() -> None:
    """PL-RL-01 (D-07): Selecting a Locked concept (action 11 sec-api) yields -5.0 reward."""
    env = StudentSimulatorEnv(allow_partial_init=False)
    env.reset(seed=101)
    obs, reward, terminated, truncated, info = env.step(11)
    assert reward == -5.0
    assert terminated is False
    assert truncated is False
    assert info["prerequisite_violation"] is True
    assert info["redundant_action"] is False
    assert obs[11] == 0.0


def test_pl_rl_01_redundant_mastered_action_penalized_minus_3() -> None:
    """PL-RL-01 (D-07): Selecting an already mastered concept (>= 0.75) yields -3.0 reward."""
    initial_mastery = [0.75] + [0.0] * 11
    env = StudentSimulatorEnv(allow_partial_init=False)
    obs, _ = env.reset(seed=101, options={"initial_mastery": initial_mastery})
    assert obs[0] == 0.75
    assert obs[12] == 0.0  # Node 0 is already mastered, so is_eligible[0] == 0.0
    assert obs[14] == 1.0  # Node 2 (web-http) has prerequisite 0 mastered, so is_eligible[2] == 1.0

    obs_next, reward, terminated, truncated, info = env.step(0)
    assert reward == -3.0
    assert terminated is False
    assert truncated is False
    assert info["redundant_action"] is True
    assert info["prerequisite_violation"] is False
    assert obs_next[0] == 0.75


def test_pl_rl_01_terminal_bonus_when_all_12_concepts_mastered() -> None:
    """PL-RL-01 (D-07): Mastering the 12th concept grants +15.0 terminal bonus and terminated=True."""
    initial_mastery = [1.0] * 11 + [0.50]
    env = StudentSimulatorEnv(allow_partial_init=False)
    obs, _ = env.reset(
        seed=101,
        options={"initial_mastery": initial_mastery, "force_alpha": 0.75},
    )
    assert obs[11] == 0.50
    assert obs[23] == 1.0  # Node 11 (sec-api) is the only remaining eligible concept

    terminated = False
    total_steps = 0
    last_reward = 0.0
    while not terminated and total_steps < 15:
        obs, reward, terminated, truncated, _ = env.step(11)
        last_reward = reward
        total_steps += 1
        assert not truncated
    assert terminated is True
    assert obs[11] >= 0.75
    # Step reward: -0.5 + 4.0*(new - old) + 5.0 (newly mastered) + 15.0 (terminal bonus) >= 20.5
    assert last_reward >= 20.5


def test_pl_rl_01_truncation_at_40_steps() -> None:
    """PL-RL-01 (D-07): Episode truncates at max_steps = 40 if not all 12 concepts mastered."""
    env = StudentSimulatorEnv(allow_partial_init=False)
    env.reset(seed=202)
    truncated = False
    steps = 0
    for _ in range(40):
        _, _, terminated, truncated, _ = env.step(11)
        steps += 1
        if terminated or truncated:
            break
    assert steps == 40
    assert truncated is True


def test_pl_rl_01_baselines_and_evaluated_artifacts_meet_contract() -> None:
    """PL-RL-01 (D-04, D-08): Verify trained DQN checkpoint, SHA-256, logs, and <5% invalid rate."""
    ckpt_path = ARTIFACTS_DIR / "checkpoint.zip"
    manifest_path = ARTIFACTS_DIR / "manifest.json"
    train_log_path = ARTIFACTS_DIR / "training_log.json"
    eval_report_path = ARTIFACTS_DIR / "evaluation_report.json"

    assert ckpt_path.exists(), "Missing rl/artifacts/checkpoint.zip"
    assert manifest_path.exists(), "Missing rl/artifacts/manifest.json"
    assert train_log_path.exists(), "Missing rl/artifacts/training_log.json"
    assert eval_report_path.exists(), "Missing rl/artifacts/evaluation_report.json"

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    actual_sha256 = hashlib.sha256(ckpt_path.read_bytes()).hexdigest()
    assert manifest["checkpoint_sha256"] == actual_sha256
    assert tuple(manifest["train_seeds"]) == TRAIN_SEEDS
    assert manifest["val_seed"] == VAL_SEED
    assert manifest["eval_seed"] == EVAL_SEED
    assert manifest["timesteps_per_seed"] >= 100_000

    train_log = json.loads(train_log_path.read_text(encoding="utf-8"))
    assert len(train_log["runs"]) == 3
    for run in train_log["runs"]:
        assert run["timesteps"] >= 100_000
        assert run["val_episodes"] == 200

    eval_report = json.loads(eval_report_path.read_text(encoding="utf-8"))
    assert eval_report["eval_seed"] == EVAL_SEED
    assert eval_report["num_episodes"] == EVAL_EPISODES

    policies = eval_report["policies"]
    for required_key in (
        "B1_fixed_curriculum",
        "B2_valid_random",
        "B3_greedy_mastery",
        "DQN_unmasked",
        "DQN_masked_q",
    ):
        assert required_key in policies
        for metric in (
            "completion_rate",
            "steps_to_completion",
            "episodic_reward",
            "invalid_action_rate",
        ):
            assert "mean" in policies[required_key][metric]
            assert "std" in policies[required_key][metric]
            assert "median" in policies[required_key][metric]
            assert "iqr" in policies[required_key][metric]

    dqn_unmasked = policies["DQN_unmasked"]
    b2_random = policies["B2_valid_random"]
    assert dqn_unmasked["invalid_action_rate"]["mean"] < 0.05
    assert dqn_unmasked["episodic_reward"]["mean"] > b2_random["episodic_reward"]["mean"]
