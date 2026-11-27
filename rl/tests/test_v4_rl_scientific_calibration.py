"""Gate 2 RED -> GREEN Behavioral Tests for v4.0 RL Scientific Calibration (D-32, D-33, D-34)."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from gymnasium.utils import env_checker

from plumora_rl.domain import (
    GraphObservationBuilder,
    LearningMode,
    NodeCompetencyInput,
    PolicyGuardrailStrategy,
)
from plumora_rl.gnn_ppo import GnnActorCritic, export_gnn_ppo_checkpoint
from plumora_rl.inference import ActorTransition, NumpyGnnPredictor
from plumora_rl.multidomain_sim import STEP_ELAPSED_DAYS, MultiDomainStudentSimulatorEnv


def test_v4_simulator_gymnasium_check_env_and_dt_025() -> None:
    """D-32: STEP_ELAPSED_DAYS == 0.25 and padded mode passes Gymnasium check_env cleanly."""
    assert STEP_ELAPSED_DAYS == 0.25

    padded_env = MultiDomainStudentSimulatorEnv(
        domain_slug="frontend",
        seed=42,
        pad_observations=True,
    )
    env_checker.check_env(padded_env, skip_render_check=True)

    env = MultiDomainStudentSimulatorEnv(
        domain_slug="backend",
        seed=42,
        include_prior_states=False,
    )
    env.reset(seed=42)
    env._depth[0] = 0.75
    env._dt[0] = 0.0
    # Step on root node 1 -> node 0 elapsed time must advance by 0.25 days (not 1.0)
    env.step((1, int(LearningMode.LEARN_NEW)))
    assert abs(float(env._dt[0]) - 0.25) < 1e-6


def test_v4_simulator_reset_includes_realistic_prior_states() -> None:
    """D-33: ~30% of episodes initialize from valid Placement / Shared-node prior states."""
    env = MultiDomainStudentSimulatorEnv(domain_slug=None, seed=101)
    prior_count = 0
    for ep in range(100):
        obs, _ = env.reset(seed=1000 + ep)
        depths = obs["node_features"][:, 0]
        if bool(np.any(depths >= 0.50)):
            prior_count += 1
            # Any unlocked prior state must still respect DAG eligibility invariants
            for node in env.graph.nodes:
                if depths[node.node_idx] >= 0.75:
                    for p in node.prerequisites:
                        assert depths[p] >= 0.75
    assert 15 <= prior_count <= 45, f"Expected ~30% prior-state episodes, got {prior_count}/100"


def test_v4_guardrail_and_simulator_lock_deep_probe_when_only_code_remains() -> None:
    """D-34: At depth >= 0.75 with code_score < 1.0 (and challenge exists), DEEP_PROBE is locked -> CODE_PRACTICE."""
    nodes = [
        NodeCompetencyInput(
            "n0",
            0,
            tier=1,
            depth_level_norm=0.75,
            confidence=0.85,
            retention_override=0.95,
            code_practice_score=0.0,
            has_code_challenge=True,
        ),
    ]
    obs = GraphObservationBuilder.build(nodes)
    mask = PolicyGuardrailStrategy.compute_valid_action_mask(obs)
    assert bool(mask[0, LearningMode.DEEP_PROBE]) is False, (
        "DEEP_PROBE must be blocked once depth >= 0.75 and only Code Sandbox remains for 1.00 Mastery"
    )
    assert bool(mask[0, LearningMode.CODE_PRACTICE]) is True

    # Simulator must also treat DEEP_PROBE at depth=0.75 (code_score=0.0) as redundant and never grant 1.00 without code
    env = MultiDomainStudentSimulatorEnv(
        domain_slug="frontend",
        seed=7,
        include_prior_states=False,
    )
    env.reset(seed=7)
    env._depth[0] = 0.75
    env._code_score[0] = 0.0
    _, rew, _, _, info = env.step((0, int(LearningMode.DEEP_PROBE)))
    assert info["redundant_action"] is True
    assert rew == -3.0
    assert float(env._depth[0]) == 0.75


def test_v4_numpy_gnn_td_critic_advantage_and_valid_mask(tmp_path: Path) -> None:
    """D-33: micro_batch_ppo_update computes TD Critic advantage from next_node_features & done."""
    pt_model = GnnActorCritic()
    ckpt_file = tmp_path / "test_v4.zip"
    sha = export_gnn_ppo_checkpoint(pt_model, ckpt_file, {"v": "4.0"})
    pred = NumpyGnnPredictor.from_checkpoint_zip(ckpt_file, expected_sha256=sha)

    feats0 = np.zeros((4, 8), dtype=np.float32)
    feats0[0, 3] = 1.0  # node 0 eligible
    feats1 = feats0.copy()
    feats1[0, 0] = 0.50  # depth increased to 0.50
    adj = np.zeros((4, 4), dtype=np.float32)
    valid_mask = PolicyGuardrailStrategy.compute_valid_action_mask(feats0)

    tr = ActorTransition(
        node_features=feats0,
        adj_in=adj,
        adj_out=adj,
        action_idx=0,  # (node 0, LEARN_NEW)
        reward=2.1,
        next_node_features=feats1,
        done=False,
        valid_mask=valid_mask,
    )
    res = pred.micro_batch_ppo_update([tr, tr], epochs=2, lr=0.002, beta_kl=0.5)
    assert res.transitions_used == 2
    assert 0.0 <= res.mean_kl_divergence < 0.05
