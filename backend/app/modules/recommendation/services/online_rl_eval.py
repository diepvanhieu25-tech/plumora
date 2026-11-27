"""Offline 200-episode Safety Evaluation Gate & domain topology rollout helpers."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import numpy as np
from plumora_rl.domain import (
    EbbinghausMemoryModel,
    GraphObservationBuilder,
    LearningMode,
    MultiObjectiveRewardCalculator,
    NodeFeatureIdx,
    PolicyGuardrailStrategy,
)
from plumora_rl.inference import NumpyGnnPredictor
from sqlalchemy.orm import Session

from app.core.config import REPO_ROOT, settings
from app.modules.recommendation.guardrail import select_guarded_action
from app.shared.contracts.adapters import (
    get_content_catalog_port,
)

logger = logging.getLogger(__name__)

_CFG_CKPT_PATH = Path(settings.rl_checkpoint_path)
BASE_CKPT_PATH = (
    _CFG_CKPT_PATH
    if _CFG_CKPT_PATH.exists()
    else REPO_ROOT / "rl" / "artifacts" / "gnn_ppo_v2_base.zip"
)
WORKER_HEARTBEAT_KEY = "plumora:worker:rec_ai_cg"
COMPETENCY_STREAM_NAME = "plumora:competency_events"
DOMAIN_STREAM_NAME = "plumora:stream:domain_events"


def _load_domain_topology_for_rl(
    db: Session,
    domain_slug: str,
) -> tuple[list[str], np.ndarray, np.ndarray, np.ndarray, list[int], list[list[int]]]:
    """Load real domain DAG topology with row-degree normalized (adj_in, adj_out) via GraphObservationBuilder."""
    c_port = get_content_catalog_port(db)
    topology = c_port.get_domain_topology(domain_slug)
    if topology is None or not topology.nodes:
        raise ValueError(f"Domain '{domain_slug}' has no nodes in topology")

    ordered = sorted(topology.nodes, key=lambda n: n.node_idx)
    node_order = [n.concept_slug for n in ordered]
    tiers = [int(n.tier) for n in ordered]
    n_nodes = len(node_order)
    slug_to_idx = {s: i for i, s in enumerate(node_order)}

    src_edges: list[int] = []
    dst_edges: list[int] = []
    prereq_indices: list[list[int]] = [[] for _ in range(n_nodes)]
    for i, node in enumerate(ordered):
        for p_slug in node.prerequisites:
            p_idx = slug_to_idx.get(p_slug)
            if p_idx is not None:
                src_edges.append(p_idx)
                dst_edges.append(i)
                prereq_indices[i].append(p_idx)

    adj_in, adj_out = GraphObservationBuilder.build_normalized_adjacencies_from_indices(
        n_nodes, prereq_indices
    )
    edge_index = (
        np.array([src_edges, dst_edges], dtype=np.int64)
        if src_edges
        else np.zeros((2, 0), dtype=np.int64)
    )
    return node_order, adj_in, adj_out, edge_index, tiers, prereq_indices


def _rollout_policy_eval_on_topologies(
    model: NumpyGnnPredictor,
    topologies: list[tuple[str, list[str], np.ndarray, np.ndarray, list[int], list[list[int]]]],
    *,
    episodes: int = 200,
    seed: int = 2026,
) -> tuple[float, float, float, list[str]]:
    """Evaluate a checkpoint across real domain DAG topologies with 60-step Simulator parity (D-32, D-33, D-34)."""
    rng = np.random.default_rng(seed)
    ep_rewards: list[float] = []
    unmasked_invalid = 0
    masked_invalid = 0
    total_steps = 0
    domains_evaluated = sorted({t[0] for t in topologies})
    step_elapsed_days = 0.25

    for ep in range(episodes):
        _dslug, node_order, adj_in, adj_out, tiers, prereq_indices = topologies[ep % len(topologies)]
        n_nodes = len(node_order)
        depth = np.zeros(n_nodes, dtype=np.float32)
        confidence = np.zeros(n_nodes, dtype=np.float32)
        code_score = np.zeros(n_nodes, dtype=np.float32)
        stability = np.full(n_nodes, EbbinghausMemoryModel.INITIAL_STABILITY_DAYS, dtype=np.float32)
        dt_days = np.zeros(n_nodes, dtype=np.float32)
        alpha = float(rng.uniform(0.35, 0.75))
        lambda_forget = float(rng.uniform(0.80, 1.20))
        beta_code = float(rng.uniform(0.35, 0.80))
        ep_rew = 0.0

        for _step in range(60):
            retention = np.ones(n_nodes, dtype=np.float32)
            for i in range(n_nodes):
                if depth[i] >= EbbinghausMemoryModel.MIN_DEPTH_FOR_RETENTION:
                    s_eff = max(
                        EbbinghausMemoryModel.MIN_STABILITY_DAYS,
                        float(stability[i]) / lambda_forget,
                    )
                    retention[i] = float(
                        EbbinghausMemoryModel.compute_retention(float(dt_days[i]), s_eff)
                    )

            feats = np.zeros((n_nodes, 8), dtype=np.float32)
            eligible = np.zeros(n_nodes, dtype=bool)
            needs_review = np.zeros(n_nodes, dtype=bool)
            for i in range(n_nodes):
                prereq_ok = all(depth[p] >= 0.75 for p in prereq_indices[i])
                needs_rev_i = EbbinghausMemoryModel.is_review_needed(
                    float(depth[i]), float(retention[i])
                )
                needs_review[i] = needs_rev_i
                eligible[i] = prereq_ok
                feats[i, NodeFeatureIdx.DEPTH_NORM] = depth[i]
                feats[i, NodeFeatureIdx.CONFIDENCE] = confidence[i]
                feats[i, NodeFeatureIdx.RETENTION] = retention[i]
                feats[i, NodeFeatureIdx.IS_ELIGIBLE] = 1.0 if prereq_ok else 0.0
                feats[i, NodeFeatureIdx.NEEDS_REVIEW] = 1.0 if needs_rev_i else 0.0
                feats[i, NodeFeatureIdx.TIER_DIFFICULTY] = float(tiers[i]) / 4.0
                feats[i, NodeFeatureIdx.CODE_SCORE] = code_score[i]
                feats[i, NodeFeatureIdx.IS_GOAL_PATH] = 1.0

            if bool(np.all(depth >= 0.75) and np.all(retention >= 0.60)):
                break

            total_steps += 1
            logits = model.predict_logits(feats, adj_in, adj_out)
            valid_mask = PolicyGuardrailStrategy.compute_valid_action_mask(feats)
            raw_idx = int(np.argmax(logits.reshape(-1)))
            raw_v = raw_idx // 4
            raw_m = raw_idx % 4
            # Count BOTH prerequisite_violation AND redundant_action in unmasked_invalid_rate (D-33)
            if raw_v < 0 or raw_v >= n_nodes or not bool(valid_mask[raw_v, raw_m]):
                unmasked_invalid += 1

            sel_v, sel_m, _pol_src, _applied = select_guarded_action(
                logits,
                eligible=eligible,
                needs_review=needs_review,
                depth=depth,
                retention=retention,
                code_score=code_score,
            )

            for u in range(n_nodes):
                if u != sel_v and depth[u] >= EbbinghausMemoryModel.MIN_DEPTH_FOR_RETENTION:
                    dt_days[u] += step_elapsed_days

            if feats[sel_v, NodeFeatureIdx.IS_ELIGIBLE] < 0.5:
                masked_invalid += 1
                ep_rew += MultiObjectiveRewardCalculator.PREREQ_VIOLATION_PENALTY
                continue

            if not bool(valid_mask[sel_v, sel_m]):
                masked_invalid += 1
                ep_rew += MultiObjectiveRewardCalculator.REDUNDANT_ACTION_PENALTY
                continue

            depth_old = float(depth[sel_v])
            code_old = float(code_score[sel_v])
            ret_old = float(retention[sel_v])
            tier_diff = float(tiers[sel_v]) / 4.0
            prereq_mean = (
                float(np.mean([depth[p] for p in prereq_indices[sel_v]]))
                if prereq_indices[sel_v]
                else 1.0
            )
            n_unfinished = int(
                np.sum((depth > 0.0) & (depth < 0.75) & (np.arange(n_nodes) != sel_v))
            )
            cognitive_load_pen = min(0.20, 0.06 * n_unfinished)

            if sel_m == LearningMode.CODE_PRACTICE:
                zpd_pen = 0.35 if depth_old < 0.25 else (0.10 if depth_old < 0.50 else 0.0)
                p_pass = min(
                    0.95,
                    max(0.15, 0.48 + 0.45 * beta_code - 0.15 * tier_diff - zpd_pen - cognitive_load_pen),
                )
            elif sel_m == LearningMode.DEEP_PROBE:
                zpd_pen = 0.40 if depth_old < 0.25 else (0.12 if depth_old < 0.50 else 0.0)
                p_pass = min(
                    0.96,
                    max(
                        0.15,
                        0.46
                        + 0.40 * alpha * (1.0 - 0.4 * tier_diff)
                        + 0.12 * prereq_mean
                        - zpd_pen
                        - cognitive_load_pen,
                    ),
                )
            else:
                p_pass = min(
                    0.96,
                    max(
                        0.40,
                        0.48
                        + 0.40 * alpha * (1.0 - 0.4 * tier_diff)
                        + 0.12 * prereq_mean
                        - cognitive_load_pen,
                    ),
                )

            passed = bool(rng.random() < p_pass)
            score = float(rng.uniform(0.75, 1.0)) if passed else float(rng.uniform(0.25, 0.60))

            if passed:
                dt_days[sel_v] = 0.0
                if sel_m == LearningMode.LEARN_NEW:
                    target = 0.50 if (depth_old >= 0.25 or score >= 0.80) else 0.25
                    depth[sel_v] = max(float(depth[sel_v]), target)
                    confidence[sel_v] = max(float(confidence[sel_v]), 0.75 if target >= 0.50 else 0.65)
                elif sel_m == LearningMode.DEEP_PROBE:
                    target = 1.0 if code_score[sel_v] >= 1.0 else 0.75
                    depth[sel_v] = max(float(depth[sel_v]), target)
                    confidence[sel_v] = max(float(confidence[sel_v]), 0.95 if target >= 1.0 else 0.85)
                    stability[sel_v] = EbbinghausMemoryModel.update_stability(
                        float(stability[sel_v]), score, passed=True
                    )
                elif sel_m == LearningMode.CODE_PRACTICE:
                    code_score[sel_v] = 1.0
                    target = 1.0 if depth[sel_v] >= 0.75 else max(float(depth[sel_v]), 0.50)
                    depth[sel_v] = max(float(depth[sel_v]), target)
                    confidence[sel_v] = max(float(confidence[sel_v]), 0.95 if target >= 1.0 else 0.75)
                    stability[sel_v] = EbbinghausMemoryModel.update_stability(
                        float(stability[sel_v]), score, passed=True
                    )
                else:  # SPACED_REVIEW
                    stability[sel_v] = EbbinghausMemoryModel.update_stability(
                        float(stability[sel_v]), score, passed=True
                    )
            else:
                if sel_m == LearningMode.LEARN_NEW and depth_old == 0.0 and score >= 0.45:
                    depth[sel_v] = 0.25
                    confidence[sel_v] = max(float(confidence[sel_v]), 0.65)
                elif depth[sel_v] >= EbbinghausMemoryModel.MIN_DEPTH_FOR_RETENTION:
                    stability[sel_v] = EbbinghausMemoryModel.update_stability(
                        float(stability[sel_v]), score, passed=False
                    )

            ret_after_vec = np.ones(n_nodes, dtype=np.float32)
            for u in range(n_nodes):
                if depth[u] >= EbbinghausMemoryModel.MIN_DEPTH_FOR_RETENTION:
                    s_eff = max(
                        EbbinghausMemoryModel.MIN_STABILITY_DAYS,
                        float(stability[u]) / lambda_forget,
                    )
                    ret_after_vec[u] = float(
                        EbbinghausMemoryModel.compute_retention(float(dt_days[u]), s_eff)
                    )
            ret_after = float(ret_after_vec[sel_v])
            goal_mastered = bool(np.all(depth >= 0.75) and np.all(ret_after_vec >= 0.60))

            rb = MultiObjectiveRewardCalculator.compute(
                depth_before=depth_old,
                depth_after=float(depth[sel_v]),
                retention_before=ret_old,
                retention_after=ret_after,
                code_before=code_old,
                code_after=float(code_score[sel_v]),
                mode=sel_m,
                step_passed=passed,
                goal_mastered=goal_mastered,
            )
            ep_rew += rb.total_reward
            if goal_mastered:
                break

        ep_rewards.append(ep_rew)

    mean_rew = float(np.mean(ep_rewards)) if ep_rewards else 0.0
    unmasked_rate = round(unmasked_invalid / max(1, total_steps), 4)
    masked_rate = round(masked_invalid / max(1, total_steps), 4)
    return mean_rew, unmasked_rate, masked_rate, domains_evaluated


def _load_ckpt_weights(ckpt_path: Path) -> NumpyGnnPredictor:
    return NumpyGnnPredictor.from_checkpoint_zip(ckpt_path)


def _evaluate_candidate_against_active(
    db: Session,
    *,
    candidate_checkpoint_path: Path,
    active_checkpoint_path: Path,
    eval_episodes: int = 200,
    seed: int = 2026,
    kl_override: float | None = None,
) -> dict[str, Any]:
    """Compare candidate vs active checkpoint over 200 scenarios across real domain DAG topologies."""
    cand_model = _load_ckpt_weights(candidate_checkpoint_path)
    active_model = _load_ckpt_weights(active_checkpoint_path)

    topologies: list[tuple[str, list[str], np.ndarray, np.ndarray, list[int], list[list[int]]]] = []
    for dslug in ("backend", "frontend", "devops"):
        try:
            node_order, adj_in, adj_out, _edge_index, tiers, prereq_indices = (
                _load_domain_topology_for_rl(db, dslug)
            )
            topologies.append((dslug, node_order, adj_in, adj_out, tiers, prereq_indices))
        except ValueError:
            continue
    if not topologies:
        raise ValueError("No domain topologies available for Safety Evaluation Gate")

    active_mean_rew, _, _, domains_evaluated = _rollout_policy_eval_on_topologies(
        active_model, topologies, episodes=eval_episodes, seed=seed
    )
    cand_mean_rew, unmasked_invalid_rate, masked_violation_rate, _ = (
        _rollout_policy_eval_on_topologies(
            cand_model, topologies, episodes=eval_episodes, seed=seed
        )
    )

    if kl_override is not None:
        measured_kl = round(float(kl_override), 6)
    else:
        rng = np.random.default_rng(42)
        kl_values: list[float] = []
        for idx in range(40):
            _dslug, node_order, adj_in, adj_out, tiers, prereq_indices = topologies[
                idx % len(topologies)
            ]
            n_nodes = len(node_order)
            feats = np.zeros((n_nodes, 8), dtype=np.float32)
            mastered_k = int(rng.integers(0, max(1, n_nodes - 1)))
            for i in range(n_nodes):
                prereq_ok = all(p < mastered_k for p in prereq_indices[i])
                feats[i, NodeFeatureIdx.DEPTH_NORM] = 0.75 if i < mastered_k else 0.0
                feats[i, NodeFeatureIdx.CONFIDENCE] = 0.85 if i < mastered_k else 0.0
                feats[i, NodeFeatureIdx.RETENTION] = 1.0
                feats[i, NodeFeatureIdx.IS_ELIGIBLE] = 1.0 if prereq_ok else 0.0
                feats[i, NodeFeatureIdx.TIER_DIFFICULTY] = float(tiers[i]) / 4.0
                feats[i, NodeFeatureIdx.IS_GOAL_PATH] = 1.0
            p_logits = active_model.predict_logits(feats, adj_in, adj_out)
            q_logits = cand_model.predict_logits(feats, adj_in, adj_out)
            kl_values.append(NumpyGnnPredictor.compute_kl_divergence(p_logits, q_logits))
        measured_kl = round(float(np.mean(kl_values)), 6) if kl_values else 0.0

    reward_delta = round(cand_mean_rew - active_mean_rew, 4)
    if active_mean_rew > 1e-6:
        reward_ratio = round(cand_mean_rew / active_mean_rew, 4)
    else:
        reward_ratio = round(1.0 + reward_delta / max(1.0, abs(active_mean_rew)), 4)

    return {
        "eval_episodes": eval_episodes,
        "domains_evaluated": domains_evaluated,
        "candidate_mean_reward": round(cand_mean_rew, 4),
        "active_mean_reward": round(active_mean_rew, 4),
        "reward_delta": reward_delta,
        "reward_ratio": reward_ratio,
        "kl_divergence": measured_kl,
        "unmasked_invalid_rate": unmasked_invalid_rate,
        "guardrail_violations": masked_violation_rate,
    }


