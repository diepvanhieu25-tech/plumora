"""Shared pure Policy Guardrail selector delegating to plumora_rl.domain.PolicyGuardrailStrategy (C03)."""

from __future__ import annotations

import numpy as np
from plumora_rl.domain import (
    NODE_FEAT_DIM,
    GraphObservation,
    NodeFeatureIdx,
    PolicyGuardrailStrategy,
)


def select_guarded_action(
    logits: np.ndarray,
    *,
    eligible: np.ndarray,
    needs_review: np.ndarray,
    depth: np.ndarray,
    retention: np.ndarray,
    code_score: np.ndarray | None = None,
    has_code_challenge: np.ndarray | None = None,
) -> tuple[int, int, str, bool]:
    """Select (node_idx, mode_idx, policy_source, guardrail_applied) via PolicyGuardrailStrategy SSoT."""
    n_nodes = int(logits.shape[0])
    feats = np.zeros((n_nodes, NODE_FEAT_DIM), dtype=np.float32)
    feats[:, NodeFeatureIdx.DEPTH_NORM] = depth.astype(np.float32, copy=False)
    feats[:, NodeFeatureIdx.RETENTION] = retention.astype(np.float32, copy=False)
    feats[:, NodeFeatureIdx.IS_ELIGIBLE] = eligible.astype(np.float32, copy=False)
    feats[:, NodeFeatureIdx.NEEDS_REVIEW] = needs_review.astype(np.float32, copy=False)
    if code_score is not None:
        feats[:, NodeFeatureIdx.CODE_SCORE] = code_score.astype(np.float32, copy=False)

    decision = PolicyGuardrailStrategy.select_action(
        logits,
        feats,
        has_code_challenge=has_code_challenge,
    )
    return (
        decision.node_idx,
        int(decision.mode),
        decision.policy_source,
        decision.guardrail_applied,
    )


def select_guarded_action_from_obs(
    logits: np.ndarray,
    obs: GraphObservation,
) -> tuple[int, int, str, bool]:
    """Select (node_idx, mode_idx, policy_source, guardrail_applied) directly from GraphObservation."""
    decision = PolicyGuardrailStrategy.select_action(logits, obs)
    return (
        decision.node_idx,
        int(decision.mode),
        decision.policy_source,
        decision.guardrail_applied,
    )
