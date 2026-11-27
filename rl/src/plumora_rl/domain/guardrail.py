"""Single Source of Truth for Policy Guardrail & Action Masking (INV-SEQ-01, INV-SEQ-03)."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from plumora_rl.domain.specs import (
    NUM_MODES,
    GraphObservation,
    LearningMode,
    NodeFeatureIdx,
)


@dataclass(frozen=True)
class GuardedActionDecision:
    """Result of PolicyGuardrailStrategy.select_action."""

    node_idx: int
    mode: LearningMode
    policy_source: str  # "gnn_ppo" | "gnn_ppo_masked"
    guardrail_applied: bool


class PolicyGuardrailStrategy:
    """Unified Action Masking & Policy Guardrail shared by RL training, eval, Safety Gate & Serving."""

    @staticmethod
    def compute_valid_action_mask(
        obs: GraphObservation | np.ndarray,
        *,
        has_code_challenge: np.ndarray | None = None,
    ) -> np.ndarray:
        """Compute boolean mask of shape (N, 4) enforcing DAG, ZPD (INV-SEQ-01) & code availability (INV-SEQ-03).

        Rules:
        - `is_eligible == False` -> all modes blocked.
        - `depth < 0.25` -> `DEEP_PROBE` and `CODE_PRACTICE` blocked (`INV-SEQ-01`).
        - `depth >= 0.50` -> `LEARN_NEW` blocked.
        - `has_code_challenge == False` or (`code_score >= 1.0` and (`depth < 0.75` or `depth >= 1.0`)) -> `CODE_PRACTICE` blocked (`INV-SEQ-02`, `INV-SEQ-03`).
        - `depth >= 1.0` -> `DEEP_PROBE` blocked (`1.00 Mastery` already reached).
        - `SPACED_REVIEW` only allowed when `needs_review == True` (or `depth >= 0.50` and `retention < 0.85`).
        """
        if isinstance(obs, GraphObservation):
            feats = obs.node_features
            code_avail = obs.has_code_challenge if has_code_challenge is None else has_code_challenge
        else:
            feats = obs
            code_avail = (
                has_code_challenge
                if has_code_challenge is not None
                else np.ones(feats.shape[0], dtype=bool)
            )

        n_nodes = int(feats.shape[0])
        mask = np.zeros((n_nodes, NUM_MODES), dtype=bool)

        for i in range(n_nodes):
            is_eligible = float(feats[i, NodeFeatureIdx.IS_ELIGIBLE]) > 0.5
            if not is_eligible:
                continue

            depth = float(feats[i, NodeFeatureIdx.DEPTH_NORM])
            retention = float(feats[i, NodeFeatureIdx.RETENTION])
            needs_review = float(feats[i, NodeFeatureIdx.NEEDS_REVIEW]) > 0.5
            code_score = float(feats[i, NodeFeatureIdx.CODE_SCORE])
            node_has_code = bool(code_avail[i])

            # Mode 0: LEARN_NEW — allowed only when depth < 0.50
            if depth < 0.50:
                mask[i, LearningMode.LEARN_NEW] = True

            # Mode 1: DEEP_PROBE — requires 0.25 <= depth < 0.75, or < 1.0 when no code challenge exists (D-34 / INV-SEQ-02)
            if 0.25 <= depth < 0.75 or (0.75 <= depth < 1.0 and not node_has_code):
                mask[i, LearningMode.DEEP_PROBE] = True

            # Mode 2: CODE_PRACTICE — requires depth >= 0.25 (INV-SEQ-01), challenge exists (INV-SEQ-03),
            # and blocked if code_score >= 1.0 while depth < 0.75 (INV-SEQ-02) or depth >= 1.0
            if (
                depth >= 0.25
                and node_has_code
                and not (code_score >= 1.0 and (depth < 0.75 or depth >= 1.0))
            ):
                mask[i, LearningMode.CODE_PRACTICE] = True

            # Mode 3: SPACED_REVIEW — allowed when needs_review or (depth >= 0.50 and retention < 0.85)
            if needs_review or (depth >= 0.50 and retention < 0.85):
                mask[i, LearningMode.SPACED_REVIEW] = True

        return mask

    @staticmethod
    def select_action(
        logits: np.ndarray,
        obs: GraphObservation | np.ndarray,
        *,
        has_code_challenge: np.ndarray | None = None,
    ) -> GuardedActionDecision:
        """Select (node_idx, mode) enforcing due-review priority and valid action masking."""
        if isinstance(obs, GraphObservation):
            feats = obs.node_features
            code_avail = obs.has_code_challenge if has_code_challenge is None else has_code_challenge
        else:
            feats = obs
            code_avail = (
                has_code_challenge
                if has_code_challenge is not None
                else np.ones(feats.shape[0], dtype=bool)
            )

        n_nodes = int(feats.shape[0])
        if n_nodes == 0:
            return GuardedActionDecision(0, LearningMode.LEARN_NEW, "gnn_ppo_masked", True)

        needs_review = feats[:, NodeFeatureIdx.NEEDS_REVIEW] > 0.5
        retention = feats[:, NodeFeatureIdx.RETENTION]

        # 1. Ebbinghaus Due-Review Priority: lowest retention node needing review
        if bool(np.any(needs_review)):
            masked_ret = np.where(needs_review, retention, np.inf)
            target_v = int(np.argmin(masked_ret))
            return GuardedActionDecision(
                node_idx=target_v,
                mode=LearningMode.SPACED_REVIEW,
                policy_source="gnn_ppo_masked",
                guardrail_applied=True,
            )

        # 2. Compute valid mask (no due reviews -> disallow mode 3 SPACED_REVIEW during serving)
        mask = PolicyGuardrailStrategy.compute_valid_action_mask(
            feats, has_code_challenge=code_avail
        )
        mask[:, LearningMode.SPACED_REVIEW] = False

        # Check raw argmax from GNN-PPO
        raw_idx = int(np.argmax(logits.reshape(-1)))
        raw_v = raw_idx // NUM_MODES
        raw_m = raw_idx % NUM_MODES
        if 0 <= raw_v < n_nodes and 0 <= raw_m < NUM_MODES and bool(mask[raw_v, raw_m]):
            return GuardedActionDecision(
                node_idx=raw_v,
                mode=LearningMode(raw_m),
                policy_source="gnn_ppo",
                guardrail_applied=False,
            )

        # 3. Fallback if mask is completely empty (e.g., all nodes depth >= 1.0): allow eligible non-review
        if not np.any(mask):
            for i in range(n_nodes):
                if float(feats[i, NodeFeatureIdx.IS_ELIGIBLE]) > 0.5:
                    mask[i, LearningMode.DEEP_PROBE] = True
        if not np.any(mask):
            return GuardedActionDecision(0, LearningMode.LEARN_NEW, "gnn_ppo_masked", True)

        masked_logits = np.where(mask, logits, -1e9)
        sel_idx = int(np.argmax(masked_logits.reshape(-1)))
        return GuardedActionDecision(
            node_idx=sel_idx // NUM_MODES,
            mode=LearningMode(sel_idx % NUM_MODES),
            policy_source="gnn_ppo_masked",
            guardrail_applied=True,
        )
