"""Fitness Function 3: Shared RL/Math Kernel Parity & Zero-Torch Backend Import."""

from __future__ import annotations

import subprocess
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

import numpy as np
from plumora_rl.domain import (
    EbbinghausMemoryModel,
    GraphEdgeInput,
    GraphObservationBuilder,
    LearningMode,
    MultiObjectiveRewardCalculator,
    NodeCompetencyInput,
    NodeFeatureIdx,
    PolicyGuardrailStrategy,
)
from plumora_rl.inference import NumpyGnnPredictor

from app.modules.recommendation.gnn_loader import load_verified_gnn_checkpoint
from app.modules.recommendation.guardrail import select_guarded_action_from_obs


def test_arch_backend_imports_plumora_rl_without_torch() -> None:
    """Backend must import plumora_rl.domain and plumora_rl.inference with ZERO torch/gymnasium load."""
    code = (
        "import sys; "
        "from plumora_rl.domain import GraphObservationBuilder, PolicyGuardrailStrategy, "
        "MultiObjectiveRewardCalculator, EbbinghausMemoryModel; "
        "from plumora_rl.inference import NumpyGnnPredictor; "
        "assert 'torch' not in sys.modules, 'torch leaked into backend!'; "
        "assert 'gymnasium' not in sys.modules, 'gymnasium leaked into backend!'; "
        "print('ZERO_TORCH_VERIFIED')"
    )
    res = subprocess.run(
        [sys.executable, "-c", code],
        capture_output=True,
        text=True,
        check=True,
    )
    assert "ZERO_TORCH_VERIFIED" in res.stdout


def test_arch_rl_kernel_and_backend_guardrail_numerical_parity() -> None:
    """GraphObservationBuilder, PolicyGuardrailStrategy, Ebbinghaus, Reward, and NumpyGnnPredictor parity."""
    nodes = [
        NodeCompetencyInput(
            concept_slug="n0",
            node_idx=0,
            tier=1,
            prerequisites=(),
            depth_level_norm=0.75,
            confidence=0.85,
            retention_override=0.95,
            is_shared=True,
            code_practice_score=0.0,
            has_code_challenge=True,
        ),
        NodeCompetencyInput(
            concept_slug="n1",
            node_idx=1,
            tier=2,
            prerequisites=("n0",),
            depth_level_norm=0.0,
            confidence=0.0,
            retention_override=1.0,
            is_shared=False,
            code_practice_score=0.0,
            has_code_challenge=False,
        ),
        NodeCompetencyInput(
            concept_slug="n2",
            node_idx=2,
            tier=3,
            prerequisites=("n1",),
            depth_level_norm=0.0,
            confidence=0.0,
            retention_override=1.0,
            is_shared=False,
            code_practice_score=0.0,
            has_code_challenge=True,
        ),
    ]
    edges = [
        GraphEdgeInput(prereq_slug="n0", concept_slug="n1"),
        GraphEdgeInput(prereq_slug="n1", concept_slug="n2"),
    ]
    obs = GraphObservationBuilder.build(nodes, extra_edges=edges)

    # 1. Row-degree normalized adjacency check (non-zero rows sum to 1.0)
    assert obs.node_features.shape == (3, 8)
    for mat in (obs.adj_in, obs.adj_out):
        row_sums = mat.sum(axis=1)
        for s in row_sums:
            assert abs(float(s) - 0.0) < 1e-5 or abs(float(s) - 1.0) < 1e-5
    assert obs.node_features[0, NodeFeatureIdx.IS_GOAL_PATH] == 1.0
    assert obs.node_features[2, NodeFeatureIdx.IS_GOAL_PATH] == 1.0

    # 2. PolicyGuardrailStrategy vs backend wrapper parity
    logits = np.array(
        [
            [0.1, 0.2, 0.9, 0.0],
            [0.8, 0.95, 0.99, 0.0],
            [9.9, 9.9, 9.9, 9.9],
        ],
        dtype=np.float32,
    )
    direct = PolicyGuardrailStrategy.select_action(logits, obs)
    w_node, w_mode, w_src, w_guard = select_guarded_action_from_obs(logits, obs)
    assert direct.node_idx == w_node
    assert int(direct.mode) == w_mode
    assert direct.policy_source == w_src
    assert direct.guardrail_applied == w_guard
    # n2 is locked -> must never be selected; n1 has depth=0 -> Deep_Probe/Code_Practice masked
    assert direct.node_idx in (0, 1)

    # 3. Ebbinghaus next_review_due_at mathematical exactness: exp(-dt/S) == 0.60
    now = datetime.now(UTC)
    due = EbbinghausMemoryModel.compute_next_review_due_at(now, stability_s=4.0)
    assert due is not None
    dt_days = (due - now).total_seconds() / 86400.0
    assert abs(EbbinghausMemoryModel.compute_retention(dt_days, 4.0) - 0.60) < 1e-5
    past = now - timedelta(days=3)
    assert EbbinghausMemoryModel.compute_elapsed_days(past, now=now) >= 2.99

    # 4. MultiObjectiveRewardCalculator verified positive delta vs failed step
    pos_r = MultiObjectiveRewardCalculator.compute(
        depth_before=0.50,
        depth_after=0.75,
        retention_before=0.90,
        retention_after=1.0,
        code_before=0.0,
        code_after=0.0,
        mode=LearningMode.DEEP_PROBE,
        step_passed=True,
    )
    neg_r = MultiObjectiveRewardCalculator.compute(
        depth_before=0.50,
        depth_after=0.50,
        retention_before=0.90,
        retention_after=0.90,
        code_before=0.0,
        code_after=0.0,
        mode=LearningMode.DEEP_PROBE,
        step_passed=False,
    )
    assert pos_r.total_reward > neg_r.total_reward

    # 5. Loaded production checkpoint forward pass via NumpyGnnPredictor matches backend loader
    repo_root = Path(__file__).resolve().parents[3]
    ckpt_zip = repo_root / "rl" / "artifacts" / "gnn_ppo_v2_base.zip"
    if ckpt_zip.exists():
        pred = NumpyGnnPredictor.from_checkpoint_zip(ckpt_zip)
        loaded = load_verified_gnn_checkpoint()
        assert loaded is not None
        logits_a = pred.forward_with_cache(obs.node_features, obs.adj_in, obs.adj_out)[0]
        logits_b = loaded.forward_with_cache(obs.node_features, obs.adj_in, obs.adj_out)[0]
        assert np.allclose(logits_a, logits_b, atol=1e-5)
