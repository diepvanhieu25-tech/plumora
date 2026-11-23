"""Unit & parity tests for plumora_rl.domain (Zero-Torch SSoT) and plumora_rl.inference."""

from __future__ import annotations

import math
import subprocess
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

import numpy as np
import torch

from plumora_rl.domain import (
    EbbinghausMemoryModel,
    GraphObservationBuilder,
    LearningMode,
    MultiObjectiveRewardCalculator,
    NodeCompetencyInput,
    NodeFeatureIdx,
    PolicyGuardrailStrategy,
)
from plumora_rl.gnn_ppo import GnnActorCritic
from plumora_rl.inference import ActorTransition, NumpyGnnPredictor
from plumora_rl.multidomain_sim import MultiDomainStudentSimulatorEnv


def test_numpy_gnn_predictor_matches_pytorch_within_1e5() -> None:
    """NumpyGnnPredictor forward logits & critic value must match PyTorch GnnActorCritic within atol=1e-5."""
    torch.manual_seed(1234)
    model = GnnActorCritic(node_feat_dim=8, hidden_dim=64, num_modes=4)
    model.eval()

    np_weights = {
        name.replace(".", "__"): param.detach().cpu().numpy().astype(np.float32)
        for name, param in model.named_parameters()
    }
    predictor = NumpyGnnPredictor("test-sha", np_weights)

    rng = np.random.default_rng(77)
    for n_nodes in (5, 9, 10, 12):
        x_np = rng.uniform(0.0, 1.0, size=(n_nodes, 8)).astype(np.float32)
        prereqs = [[j for j in range(i) if rng.random() < 0.3] for i in range(n_nodes)]
        adj_in, adj_out = GraphObservationBuilder.build_normalized_adjacencies_from_indices(
            n_nodes, prereqs
        )

        with torch.no_grad():
            pt_logits, pt_val = model(
                torch.from_numpy(x_np),
                torch.from_numpy(adj_in),
                torch.from_numpy(adj_out),
            )
        np_logits = predictor.predict_logits(x_np, adj_in, adj_out)
        np_val = predictor.predict_value(x_np, adj_in, adj_out)

        np.testing.assert_allclose(np_logits, pt_logits.numpy(), atol=1e-5, rtol=1e-4)
        assert math.isclose(np_val, float(pt_val.item()), abs_tol=1e-5)


def test_graph_observation_builder_row_normalization_and_goal_path() -> None:
    """GraphObservationBuilder normalizes adj_in/adj_out rows and computes reverse-BFS is_goal_path."""
    # DAG: n0 -> n2 -> n3 (Tier 4), n1 -> n2, n0 -> n4 (side leaf already mastered)
    nodes = [
        NodeCompetencyInput("n0", 0, tier=1, prerequisites=(), depth_level_norm=0.75),
        NodeCompetencyInput("n1", 1, tier=1, prerequisites=(), depth_level_norm=0.75),
        NodeCompetencyInput("n2", 2, tier=2, prerequisites=("n0", "n1"), depth_level_norm=0.0),
        NodeCompetencyInput("n3", 3, tier=4, prerequisites=("n2",), depth_level_norm=0.0),
        NodeCompetencyInput("n4", 4, tier=2, prerequisites=("n0",), depth_level_norm=1.0),
    ]
    obs = GraphObservationBuilder.build(nodes)

    assert obs.node_features.shape == (5, 8)
    # n2 has 2 incoming prerequisites -> each row entry must be 0.5
    assert math.isclose(float(obs.adj_in[2, 0]), 0.5, rel_tol=1e-6)
    assert math.isclose(float(obs.adj_in[2, 1]), 0.5, rel_tol=1e-6)
    assert math.isclose(float(obs.adj_in[2].sum()), 1.0, rel_tol=1e-6)
    # n0 has 2 outgoing dependents (n2, n4) -> each row entry must be 0.5
    assert math.isclose(float(obs.adj_out[0, 2]), 0.5, rel_tol=1e-6)
    assert math.isclose(float(obs.adj_out[0, 4]), 0.5, rel_tol=1e-6)

    # n3 is unmastered Tier-4 leaf -> ancestors n2, n0, n1 are on goal path; mastered n4 is NOT
    goal_col = obs.node_features[:, NodeFeatureIdx.IS_GOAL_PATH]
    assert goal_col[0] == 1.0
    assert goal_col[1] == 1.0
    assert goal_col[2] == 1.0
    assert goal_col[3] == 1.0
    assert goal_col[4] == 0.0


def test_ebbinghaus_memory_model_due_timestamp_and_stability() -> None:
    """EbbinghausMemoryModel.compute_next_review_due_at solves exp(-dt/S) = 0.60 accurately."""
    t0 = datetime(2026, 11, 20, 12, 0, 0, tzinfo=UTC)
    due = EbbinghausMemoryModel.compute_next_review_due_at(t0, stability_s=3.0, depth_norm=0.75)
    assert due is not None
    expected_dt = -3.0 * math.log(0.60)
    actual_dt = (due - t0).total_seconds() / 86400.0
    assert math.isclose(actual_dt, expected_dt, rel_tol=1e-6)
    assert math.isclose(EbbinghausMemoryModel.compute_retention(actual_dt, 3.0), 0.60, rel_tol=1e-6)

    # Below depth 0.50 -> no scheduled review
    assert EbbinghausMemoryModel.compute_next_review_due_at(t0, stability_s=3.0, depth_norm=0.25) is None

    # Stability update pass vs fail
    assert math.isclose(EbbinghausMemoryModel.update_stability(3.0, 1.0, passed=True), 5.4, rel_tol=1e-6)
    assert math.isclose(EbbinghausMemoryModel.update_stability(3.0, 0.4, passed=False), 2.1, rel_tol=1e-6)

    # Elapsed days calculation
    elapsed = EbbinghausMemoryModel.compute_elapsed_days(t0, now=t0 + timedelta(days=2.5))
    assert math.isclose(elapsed, 2.5, rel_tol=1e-6)


def test_policy_guardrail_strategy_enforces_dag_zpd_code_and_review() -> None:
    """PolicyGuardrailStrategy enforces INV-SEQ-01, INV-SEQ-03, DAG lock, and due-review priority."""
    nodes = [
        # Node 0: fresh eligible (depth=0.0) -> ONLY Learn_New allowed (INV-SEQ-01)
        NodeCompetencyInput("n0", 0, tier=1, depth_level_norm=0.0, has_code_challenge=True),
        # Node 1: applied (depth=0.50), NO code challenge -> ONLY Deep_Probe allowed (INV-SEQ-03)
        NodeCompetencyInput("n1", 1, tier=1, depth_level_norm=0.50, has_code_challenge=False),
        # Node 2: locked (prereq n1 < 0.75) -> ALL modes blocked
        NodeCompetencyInput("n2", 2, tier=2, prerequisites=("n1",), depth_level_norm=0.0),
    ]
    obs = GraphObservationBuilder.build(nodes)
    mask = PolicyGuardrailStrategy.compute_valid_action_mask(obs)

    assert bool(mask[0, LearningMode.LEARN_NEW]) is True
    assert bool(mask[0, LearningMode.DEEP_PROBE]) is False
    assert bool(mask[0, LearningMode.CODE_PRACTICE]) is False
    assert bool(mask[1, LearningMode.LEARN_NEW]) is False
    assert bool(mask[1, LearningMode.DEEP_PROBE]) is True
    assert bool(mask[1, LearningMode.CODE_PRACTICE]) is False
    assert not np.any(mask[2])

    # Adversarial logits preferring locked node 2 -> must select valid action instead
    adv_logits = np.full((3, 4), -5.0, dtype=np.float32)
    adv_logits[2, 0] = 99.0
    adv_logits[1, LearningMode.DEEP_PROBE] = 2.0
    decision = PolicyGuardrailStrategy.select_action(adv_logits, obs)
    assert decision.node_idx == 1
    assert decision.mode == LearningMode.DEEP_PROBE
    assert decision.guardrail_applied is True
    assert decision.policy_source == "gnn_ppo_masked"

    # Due-review priority picks node with lowest retention
    review_nodes = [
        NodeCompetencyInput("r0", 0, tier=1, depth_level_norm=0.75, retention_override=0.55),
        NodeCompetencyInput("r1", 1, tier=1, depth_level_norm=0.75, retention_override=0.32),
    ]
    rev_obs = GraphObservationBuilder.build(review_nodes)
    rev_decision = PolicyGuardrailStrategy.select_action(np.zeros((2, 4), dtype=np.float32), rev_obs)
    assert rev_decision.node_idx == 1
    assert rev_decision.mode == LearningMode.SPACED_REVIEW
    assert rev_decision.guardrail_applied is True


def test_multi_objective_reward_calculator_verified_formula() -> None:
    """MultiObjectiveRewardCalculator computes verified delta-based rewards matching RL_PLAN."""
    rb = MultiObjectiveRewardCalculator.compute(
        depth_before=0.50,
        depth_after=0.75,
        retention_before=0.45,
        retention_after=1.0,
        code_before=0.0,
        code_after=1.0,
        mode=LearningMode.CODE_PRACTICE,
        step_passed=True,
        goal_mastered=False,
    )
    expected = -0.4 + 5.0 * 0.25 + 3.0 * 0.55 + 2.5 * 1.0 - 0.35
    assert math.isclose(rb.total_reward, expected, rel_tol=1e-5)

    # Re-submitting already completed code yields zero gain (prevents reward hacking)
    rb_repeat = MultiObjectiveRewardCalculator.compute(
        depth_before=1.0,
        depth_after=1.0,
        retention_before=1.0,
        retention_after=1.0,
        code_before=1.0,
        code_after=1.0,
        mode=LearningMode.CODE_PRACTICE,
        step_passed=True,
        goal_mastered=False,
    )
    assert rb_repeat.total_reward < 0.0


def test_numpy_gnn_kl_regularized_micro_batch_update() -> None:
    """Analytical PPO update with explicit KL penalty updates actor head and keeps KL bounded."""
    ckpt_path = Path(__file__).resolve().parents[1] / "artifacts" / "gnn_ppo_v2_base.zip"
    predictor = NumpyGnnPredictor.from_checkpoint_zip(ckpt_path)

    env = MultiDomainStudentSimulatorEnv(domain_slug="frontend", seed=11)
    obs, _ = env.reset(seed=11)
    transitions = [
        ActorTransition(
            node_features=obs["node_features"],
            adj_in=obs["adj_in"],
            adj_out=obs["adj_out"],
            action_idx=0,
            reward=1.95,
        ),
        ActorTransition(
            node_features=obs["node_features"],
            adj_in=obs["adj_in"],
            adj_out=obs["adj_out"],
            action_idx=4,
            reward=-0.55,
        ),
    ]
    res = predictor.micro_batch_ppo_update(transitions, epochs=4, lr=0.005, beta_kl=0.5)
    assert res.transitions_used == 2
    assert res.epochs_run == 4
    assert 0.0 <= res.mean_kl_divergence < 0.05
    assert not np.allclose(
        res.updated_weights["actor_head__2__weight"],
        predictor.w["actor_head__2__weight"],
    )


def test_domain_and_inference_packages_are_zero_torch() -> None:
    """Importing plumora_rl.domain and plumora_rl.inference must NOT import torch or gymnasium."""
    rl_src = str(Path(__file__).resolve().parents[1] / "src")
    code = (
        "import sys; "
        "from plumora_rl.domain import GraphObservationBuilder, EbbinghausMemoryModel, "
        "PolicyGuardrailStrategy, MultiObjectiveRewardCalculator; "
        "from plumora_rl.inference import NumpyGnnPredictor; "
        "assert 'torch' not in sys.modules, 'torch must not be imported'; "
        "assert 'gymnasium' not in sys.modules, 'gymnasium must not be imported'; "
        "print('ZERO_TORCH_OK')"
    )
    proc = subprocess.run(
        [sys.executable, "-c", code],
        env={"PYTHONPATH": rl_src},
        capture_output=True,
        text=True,
        check=True,
    )
    assert "ZERO_TORCH_OK" in proc.stdout
