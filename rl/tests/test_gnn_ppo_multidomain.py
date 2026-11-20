"""Behavioral RED tests for PL3-RL-01: Multi-Domain Simulator, 3-Layer GNN-PPO & Zero-shot Transfer."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np


def test_pl3_rl_01_multidomain_simulator_obs_action_and_no_leakage() -> None:
    """Verify (N, 8) node features, factored action (v, m), Ebbinghaus dt=1.0, and no hidden var leakage."""
    from plumora_rl.multidomain_sim import (
        DOMAIN_GRAPHS,
        MultiDomainStudentSimulatorEnv,
    )

    assert {"backend", "frontend", "devops", "heldout_data_eng_graph"}.issubset(
        DOMAIN_GRAPHS.keys()
    )
    assert len(DOMAIN_GRAPHS["backend"].nodes) == 12
    assert len(DOMAIN_GRAPHS["frontend"].nodes) == 10
    assert len(DOMAIN_GRAPHS["devops"].nodes) == 9
    assert len(DOMAIN_GRAPHS["heldout_data_eng_graph"].nodes) == 10

    env = MultiDomainStudentSimulatorEnv(domain_slug="frontend", seed=42)
    obs, info = env.reset(seed=42)
    assert obs["node_features"].shape == (10, 8)
    assert np.all(obs["node_features"] >= 0.0)
    assert np.all(obs["node_features"] <= 1.0)
    assert obs["adj_in"].shape == (10, 10)
    assert obs["adj_out"].shape == (10, 10)
    # Hidden learner params must never appear in observation
    assert "alpha" not in obs
    assert "lambda_forget" not in obs
    assert "beta_code" not in obs
    assert info["domain_slug"] == "frontend"

    # Prerequisite violation (tier 4 node fe-xss-csrf = idx 8) must yield -5.0 penalty
    _, reward, _, _, step_info = env.step((8, 0))
    assert reward == -5.0
    assert step_info["prerequisite_violation"] is True


def test_pl3_rl_01_gnn_actor_critic_is_domain_size_agnostic() -> None:
    """3-Layer Directed Adjacency GNN Encoder runs on N=9, N=10, and N=12 with shared weights."""
    import torch

    from plumora_rl.gnn_ppo import GnnActorCritic

    model = GnnActorCritic(node_feat_dim=8, hidden_dim=64, num_modes=4)
    for n_nodes in (9, 10, 12, 16):
        x = torch.rand((n_nodes, 8), dtype=torch.float32)
        adj_in = torch.eye(n_nodes, dtype=torch.float32)
        adj_out = torch.eye(n_nodes, dtype=torch.float32)
        logits, value = model(x, adj_in, adj_out)
        assert logits.shape == (n_nodes, 4)
        assert value.shape == ()


def test_pl3_rl_01_phase3_checkpoint_and_eval_report_verified() -> None:
    """Verify gnn_ppo_v2_base.zip, SHA-256 manifest, and 4-way evaluation report exist."""
    artifacts_dir = Path(__file__).resolve().parents[1] / "artifacts"
    ckpt = artifacts_dir / "gnn_ppo_v2_base.zip"
    manifest_path = artifacts_dir / "manifest_phase3.json"
    report_path = artifacts_dir / "evaluation_phase3_report.json"

    assert ckpt.exists(), "gnn_ppo_v2_base.zip must be trained and exported"
    assert manifest_path.exists(), "manifest_phase3.json must exist"
    assert report_path.exists(), "evaluation_phase3_report.json must exist"

    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert report["eval_seed"] == 2026
    assert report["episodes"] == 500
    assert "scenario_a_known_domains" in report
    assert "scenario_b_zero_shot_transfer" in report
    transfer = report["scenario_b_zero_shot_transfer"]
    assert transfer["gnn_ppo_masked"]["masked_violation_rate"] == 0.0
    assert transfer["gnn_ppo_unmasked"]["invalid_action_rate"] < 0.05
