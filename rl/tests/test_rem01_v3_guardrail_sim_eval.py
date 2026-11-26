"""Behavioral RED -> GREEN tests for REM-01: Guardrail v3, INV-SEQ-02 Simulator & Eval Metrics."""

from __future__ import annotations

import numpy as np

from plumora_rl.domain import (
    GraphObservationBuilder,
    LearningMode,
    NodeCompetencyInput,
    PolicyGuardrailStrategy,
)
from plumora_rl.evaluate_phase3 import evaluate_policy
from plumora_rl.multidomain_sim import MultiDomainStudentSimulatorEnv


def test_rem01_guardrail_locks_deep_probe_at_mastery_and_code_below_075() -> None:
    """Guardrail must block DEEP_PROBE when depth>=1.0 and CODE_PRACTICE when code_score>=1.0 at depth<0.75."""
    nodes = [
        # Node 0: 1.00 Mastery with slightly decayed retention (0.75, not yet <0.60 needs_review)
        # DEEP_PROBE must be FALSE (already 1.00 Mastery!)
        NodeCompetencyInput(
            "n0",
            0,
            tier=1,
            depth_level_norm=1.0,
            confidence=0.95,
            retention_override=0.75,
            code_practice_score=1.0,
            has_code_challenge=True,
        ),
        # Node 1: Applied (0.50) where learner ALREADY passed Code Sandbox (code_score=1.0)
        # Under INV-SEQ-02, CODE_PRACTICE at depth<0.75 cannot advance depth -> must be FALSE, only DEEP_PROBE TRUE
        NodeCompetencyInput(
            "n1",
            1,
            tier=1,
            depth_level_norm=0.50,
            confidence=0.75,
            retention_override=1.0,
            code_practice_score=1.0,
            has_code_challenge=True,
        ),
    ]
    obs = GraphObservationBuilder.build(nodes)
    mask = PolicyGuardrailStrategy.compute_valid_action_mask(obs)

    assert bool(mask[0, LearningMode.DEEP_PROBE]) is False, (
        "DEEP_PROBE must be blocked on nodes already at 1.00 Mastery"
    )
    assert bool(mask[0, LearningMode.CODE_PRACTICE]) is False
    assert bool(mask[1, LearningMode.CODE_PRACTICE]) is False, (
        "CODE_PRACTICE must be blocked when code_score >= 1.0 and depth < 0.75 (INV-SEQ-02)"
    )
    assert bool(mask[1, LearningMode.DEEP_PROBE]) is True

    # Adversarial logits trying to pick Node 0 DEEP_PROBE or Node 1 CODE_PRACTICE must be redirected to Node 1 DEEP_PROBE
    logits = np.full((2, 4), -2.0, dtype=np.float32)
    logits[0, LearningMode.DEEP_PROBE] = 50.0
    logits[1, LearningMode.CODE_PRACTICE] = 40.0
    decision = PolicyGuardrailStrategy.select_action(logits, obs)
    assert decision.node_idx == 1
    assert decision.mode == LearningMode.DEEP_PROBE


def test_rem01_simulator_enforces_inv_seq_02_ceiling_and_redundant_penalties() -> None:
    """Simulator must cap CODE_PRACTICE at 0.50 when depth < 0.75 (INV-SEQ-02) and penalize repeat CODE_PRACTICE."""
    env = MultiDomainStudentSimulatorEnv(domain_slug="frontend", seed=7)
    env.reset(seed=7)

    # Set root node 0 to Surface (0.25) and high beta_code so CODE_PRACTICE passes deterministically
    env._depth[0] = 0.25
    env._beta_code = 10.0

    # 1st CODE_PRACTICE at depth=0.25 (<0.75) -> must cap at 0.50 (NOT jump to 0.75!)
    _, _, _, _, info1 = env.step((0, int(LearningMode.CODE_PRACTICE)))
    assert info1["passed"] is True
    assert float(env._code_score[0]) == 1.0
    assert float(env._depth[0]) == 0.50, (
        f"INV-SEQ-02 violated in simulator: depth jumped to {env._depth[0]} instead of capping at 0.50"
    )

    # 2nd CODE_PRACTICE while depth=0.50 (<0.75) and code_score=1.0 -> must be redundant_action (-3.0)
    _, rew2, _, _, info2 = env.step((0, int(LearningMode.CODE_PRACTICE)))
    assert info2["redundant_action"] is True
    assert rew2 == -3.0


def test_rem01_evaluate_policy_reports_steps_to_completion_and_redundant_in_invalid_rate() -> None:
    """evaluate_policy must report steps_to_completion metrics and count redundant_action in invalid_action_rate."""

    class _SpamLearnNewModel:
        def predict(self, _obs: np.ndarray, deterministic: bool = True) -> tuple[int, None]:
            _ = deterministic
            # Always pick (node 0, mode 0 = Learn_New) -> becomes redundant_action once depth >= 0.50
            return 0, None

    res = evaluate_policy(
        "dqn_mlp",
        ("frontend",),
        eval_seed=2026,
        episodes=5,
        sb3_model=_SpamLearnNewModel(),
        masked=False,
    )
    assert "steps_to_completion" in res, "Missing steps_to_completion in evaluation summary"
    assert res["invalid_action_rate"] > 0.5, (
        f"Spamming redundant Learn_New 60x must produce high invalid_action_rate, got {res['invalid_action_rate']}"
    )
