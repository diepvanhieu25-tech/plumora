"""Unit & Integration tests for RL-01 (PL-RL-01: Simulator, Baselines, DQN Checkpoint & Eval)."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from stable_baselines3 import DQN

from plumora_rl.baselines import (
    DQNMaskedQPolicy,
    DQNUnmaskedPolicy,
    FixedCurriculumPolicy,
    GreedyMasteryPolicy,
    ValidRandomPolicy,
)
from plumora_rl.simulator import build_observation

ARTIFACTS_DIR = Path(__file__).resolve().parents[1] / "artifacts"


def test_baselines_select_eligible_actions_accurately() -> None:
    """Verify B1, B2, and B3 respect the 24-dim observation eligibility mask."""
    # Node 0 mastered (0.75), Node 1 in-progress (0.50), Node 2 unlocked (0.00)
    mastery = np.zeros(12, dtype=np.float32)
    mastery[0] = 0.75
    mastery[1] = 0.50
    obs = build_observation(mastery)
    # Eligible concepts are Node 1 (os-basics, 0.50) and Node 2 (web-http, 0.00)
    assert obs[12 + 1] == 1.0
    assert obs[12 + 2] == 1.0
    assert obs[12 + 0] == 0.0

    b1 = FixedCurriculumPolicy()
    b2 = ValidRandomPolicy(seed=101)
    b3 = GreedyMasteryPolicy()

    assert b1.select_action(obs) == 1
    assert b2.select_action(obs) in (1, 2)
    # B3 prioritizes highest in-progress mastery (Node 1 has 0.50 > Node 2 has 0.00)
    assert b3.select_action(obs) == 1


def test_dqn_checkpoint_loads_and_predicts_valid_action() -> None:
    """Verify trained checkpoint.zip loads via SB3 and returns valid actions and Q-values."""
    ckpt_path = ARTIFACTS_DIR / "checkpoint.zip"
    assert ckpt_path.exists()
    model = DQN.load(str(ckpt_path))

    unmasked = DQNUnmaskedPolicy(model)
    masked = DQNMaskedQPolicy(model)

    mastery = np.zeros(12, dtype=np.float32)
    obs = build_observation(mastery)
    # Initially only root nodes 0 and 1 are eligible
    act_u = unmasked.select_action(obs)
    selected_m, raw_m, guardrail_applied, q_vals = masked.predict_with_metadata(obs)

    assert act_u in (0, 1)
    assert selected_m in (0, 1)
    assert raw_m == act_u
    assert guardrail_applied is False
    assert len(q_vals) == 12
