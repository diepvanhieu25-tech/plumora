"""Shared pure Policy Guardrail selector used identically by serving and Safety Evaluation Gate (C03)."""

from __future__ import annotations

import numpy as np


def select_guarded_action(
    logits: np.ndarray,
    *,
    eligible: np.ndarray,
    needs_review: np.ndarray,
    depth: np.ndarray,
    retention: np.ndarray,
) -> tuple[int, int, str, bool]:
    """Select (node_idx, mode_idx, policy_source, guardrail_applied) with identical serving & Safety Gate rules.

    Rules:
    1. Due-review priority: if any node has needs_review=True (depth >= 0.50 & retention < 0.60),
       immediately select Spaced_Review (mode 3) on the node with lowest retention.
    2. Never select Spaced_Review (mode 3) when no node needs review.
    3. Never select locked (eligible=False) nodes.
    """
    if bool(np.any(needs_review)):
        masked_ret = np.where(needs_review, retention, np.inf)
        target_v = int(np.argmin(masked_ret))
        return target_v, 3, "gnn_ppo_masked", True

    flat_logits = logits.reshape(-1)
    raw_idx = int(np.argmax(flat_logits))
    raw_v = raw_idx // 4
    raw_m = raw_idx % 4

    if bool(eligible[raw_v]) and float(depth[raw_v]) < 1.0 and raw_m != 3:
        return raw_v, raw_m, "gnn_ppo", False

    n_nodes = int(logits.shape[0])
    mask = np.zeros((n_nodes, 4), dtype=bool)
    for i in range(n_nodes):
        if bool(eligible[i]) and float(depth[i]) < 1.0:
            mask[i, 0:3] = True
    if not np.any(mask):
        for i in range(n_nodes):
            if bool(eligible[i]):
                mask[i, 0:3] = True

    if not np.any(mask):
        return 0, 0, "gnn_ppo_masked", True

    masked_logits = np.where(mask, logits, -1e9)
    sel_idx = int(np.argmax(masked_logits.reshape(-1)))
    return sel_idx // 4, sel_idx % 4, "gnn_ppo_masked", True
