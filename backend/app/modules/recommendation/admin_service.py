"""Service layer for Safe Micro-batch Online RL, Safety Evaluation Gate, Policy Inspector & System Ops."""

from __future__ import annotations

import hashlib
import io
import json
import logging
import math
import os
import time
import urllib.error
import urllib.request
import uuid
import zipfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import redis
from fastapi import HTTPException, status
from plumora_rl.domain import (
    MODE_NAME_TO_ENUM,
    MODE_NAMES,
    EbbinghausMemoryModel,
    GraphObservationBuilder,
    LearningMode,
    MultiObjectiveRewardCalculator,
    NodeFeatureIdx,
    PolicyGuardrailStrategy,
)
from plumora_rl.inference import ActorTransition, NumpyGnnPredictor
from sqlalchemy import func, select, text, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import REPO_ROOT, settings
from app.db.models import (
    ModelRegistryModel,
    OnlineEvalRunModel,
    OutboxEventModel,
    RecommendationLogModel,
    RlExperienceBufferModel,
)
from app.db.redis_pool import get_redis_client
from app.modules.contracts.adapters import (
    get_competency_reader_port,
    get_content_catalog_port,
)
from app.modules.events.internal_client import (
    assessment_service_url,
    content_service_url,
    fetch_all_outbox_pending_internal,
    trigger_remote_outbox_relays_internal,
)
from app.modules.events.outbox import (
    consume_competency_stream_once,
    consume_domain_events_stream_once,
    run_outbox_relay_and_consume_once,
)
from app.modules.recommendation.admin_schemas import (
    MicroBatchTrainRequest,
    ModelRegistryItemOut,
    OnlineRlStatusResponse,
    PolicyInspectRequest,
)
from app.modules.recommendation.gnn_loader import load_verified_gnn_checkpoint
from app.modules.recommendation.guardrail import select_guarded_action
from app.modules.recommendation.service_v2 import (
    build_domain_graph_observation,
    invalidate_active_model_cache,
    publish_active_model_pointer,
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


def _ensure_prod_model_seeded(db: Session) -> ModelRegistryModel | None:
    sha = (
        hashlib.sha256(BASE_CKPT_PATH.read_bytes()).hexdigest()
        if BASE_CKPT_PATH.exists()
        else "0" * 64
    )
    base_row = db.scalars(
        select(ModelRegistryModel).where(ModelRegistryModel.version_tag == "gnn_ppo_v2_base")
    ).first()
    if base_row is not None:
        if BASE_CKPT_PATH.exists() and base_row.checkpoint_sha256 != sha:
            base_row.checkpoint_sha256 = sha
            db.commit()
            if base_row.is_active:
                publish_active_model_pointer(str(base_row.checkpoint_path), sha)
        return base_row

    any_active = db.scalars(
        select(ModelRegistryModel.id).where(ModelRegistryModel.is_active.is_(True)).limit(1)
    ).first()
    prod = ModelRegistryModel(
        id=uuid.uuid4(),
        version_tag="gnn_ppo_v2_base",
        checkpoint_path="rl/artifacts/gnn_ppo_v2_base.zip",
        checkpoint_sha256=sha,
        kl_divergence=0.0,
        gate_verdict="PASSED",
        is_active=any_active is None,
        eval_metrics_json={
            "invalid_action_rate_unmasked": 0.0,
            "masked_violation_rate": 0.0,
            "mean_reward_ratio_vs_prod": 1.0,
            "block_reasons": [],
        },
        activated_at=datetime.now(UTC),
    )
    db.add(prod)
    db.commit()
    db.refresh(prod)
    return prod


def _serialize_model(m: ModelRegistryModel) -> ModelRegistryItemOut:
    return ModelRegistryItemOut(
        model_id=m.id,
        version_tag=m.version_tag,
        checkpoint_sha256=m.checkpoint_sha256,
        kl_divergence=m.kl_divergence,
        gate_verdict=m.gate_verdict,
        is_active=m.is_active,
        created_at=m.created_at.isoformat(),
        activated_at=m.activated_at.isoformat() if m.activated_at else None,
        eval_metrics=dict(m.eval_metrics_json or {}),
    )


def get_online_rl_status(db: Session, *, limit: int = 50) -> OnlineRlStatusResponse:
    """Return Experience Buffer count and bounded Model Registry status with full eval_metrics."""
    _ensure_prod_model_seeded(db)
    buf_count = int(db.scalar(select(func.count()).select_from(RlExperienceBufferModel)) or 0)
    models = db.scalars(
        select(ModelRegistryModel)
        .order_by(ModelRegistryModel.created_at.desc())
        .limit(max(1, min(limit, 200)))
    ).all()
    active = db.scalars(
        select(ModelRegistryModel)
        .where(ModelRegistryModel.is_active.is_(True))
        .order_by(ModelRegistryModel.activated_at.desc(), ModelRegistryModel.created_at.desc())
        .limit(1)
    ).first()
    report_path = REPO_ROOT / "rl" / "artifacts" / "evaluation_phase3_report.json"
    benchmark_report: dict[str, Any] | None = None
    if report_path.exists():
        try:
            benchmark_report = json.loads(report_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            benchmark_report = None

    return OnlineRlStatusResponse(
        buffer_count=buf_count,
        kl_target_max=0.02,
        active_model=_serialize_model(active) if active else None,
        models=[_serialize_model(m) for m in models],
        benchmark_report=benchmark_report,
    )


def get_online_rl_buffer_summary(
    db: Session,
    *,
    recent_limit: int = 20,
) -> dict[str, Any]:
    """Return Experience Buffer distribution by domain/mode/reward + latest verified transitions."""
    total_count = int(db.scalar(select(func.count()).select_from(RlExperienceBufferModel)) or 0)

    domain_rows = db.execute(
        select(RlExperienceBufferModel.domain_slug, func.count())
        .group_by(RlExperienceBufferModel.domain_slug)
    ).all()
    by_domain = {str(slug): int(cnt) for slug, cnt in domain_rows}

    mode_rows = db.execute(
        select(RlExperienceBufferModel.action_mode, func.count())
        .group_by(RlExperienceBufferModel.action_mode)
    ).all()
    by_mode = {str(mode): int(cnt) for mode, cnt in mode_rows}

    rew_stats = db.execute(
        select(
            func.avg(RlExperienceBufferModel.reward),
            func.min(RlExperienceBufferModel.reward),
            func.max(RlExperienceBufferModel.reward),
        )
    ).first()
    mean_rew = round(float(rew_stats[0]), 4) if (rew_stats and rew_stats[0] is not None) else 0.0
    min_rew = round(float(rew_stats[1]), 4) if (rew_stats and rew_stats[1] is not None) else 0.0
    max_rew = round(float(rew_stats[2]), 4) if (rew_stats and rew_stats[2] is not None) else 0.0

    recent_rows = db.scalars(
        select(RlExperienceBufferModel)
        .order_by(RlExperienceBufferModel.created_at.desc())
        .limit(max(1, min(recent_limit, 100)))
    ).all()

    recent_items: list[dict[str, Any]] = []
    for r in recent_rows:
        depth_before: float | None = None
        depth_after: float | None = None
        if isinstance(r.obs_before_json, dict) and isinstance(r.obs_after_json, dict):
            idx = r.obs_before_json.get("action_node_idx")
            b_nodes = r.obs_before_json.get("nodes")
            a_nodes = r.obs_after_json.get("nodes")
            if (
                isinstance(idx, int)
                and isinstance(b_nodes, list)
                and isinstance(a_nodes, list)
                and 0 <= idx < len(b_nodes)
                and 0 <= idx < len(a_nodes)
            ):
                b_entry = b_nodes[idx]
                a_entry = a_nodes[idx]
                if isinstance(b_entry, dict):
                    depth_before = float(b_entry.get("mastery", 0.0))
                if isinstance(a_entry, dict):
                    depth_after = float(a_entry.get("mastery", 0.0))

        recent_items.append(
            {
                "id": str(r.id),
                "event_id": str(r.event_id),
                "user_id": str(r.user_id),
                "domain_slug": r.domain_slug,
                "concept_slug": r.concept_slug,
                "action_mode": r.action_mode,
                "reward": round(float(r.reward), 4),
                "depth_before": depth_before,
                "depth_after": depth_after,
                "created_at": r.created_at.isoformat(),
            }
        )

    return {
        "total_transitions": total_count,
        "by_domain": by_domain,
        "by_mode": by_mode,
        "reward_stats": {
            "mean": mean_rew,
            "min": min_rew,
            "max": max_rew,
        },
        "recent_transitions": recent_items,
    }


def inspect_policy_for_admin(
    db: Session,
    payload: PolicyInspectRequest,
    *,
    default_user_id: uuid.UUID,
) -> dict[str, Any]:
    """Admin-only Policy Inspector with N x 8 features, raw & guarded action probabilities, and What-If clock."""
    c_port = get_content_catalog_port(db)
    u_port = get_competency_reader_port(db)

    topology = c_port.get_domain_topology(payload.domain_slug)
    if topology is None or not topology.nodes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "DOMAIN_NOT_FOUND",
                "message": f"Domain '{payload.domain_slug}' not found.",
            },
        )

    target_user_id = payload.user_id if payload.user_id is not None else default_user_id
    comp_snap = u_port.get_user_competency_snapshot(target_user_id)
    comp_map = comp_snap.by_slug()
    ordered_nodes = sorted(topology.nodes, key=lambda n: n.node_idx)

    obs = build_domain_graph_observation(
        topology,
        comp_map,
        simulated_time_offset_days=payload.simulated_time_offset_days,
    )

    _ensure_prod_model_seeded(db)
    ckpt: NumpyGnnPredictor | None = None
    version_tag = "gnn_ppo_v2_base"
    if payload.checkpoint_model_id is not None:
        m_row = db.get(ModelRegistryModel, payload.checkpoint_model_id)
        if m_row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "MODEL_NOT_FOUND", "message": "Checkpoint model not found."},
            )
        version_tag = m_row.version_tag
        ckpt = load_verified_gnn_checkpoint(
            checkpoint_path_override=m_row.checkpoint_path,
            expected_sha256_override=m_row.checkpoint_sha256,
        )
    else:
        active_row = db.scalars(
            select(ModelRegistryModel)
            .where(ModelRegistryModel.is_active.is_(True))
            .order_by(ModelRegistryModel.activated_at.desc(), ModelRegistryModel.created_at.desc())
            .limit(1)
        ).first()
        if active_row is not None:
            ckpt = load_verified_gnn_checkpoint(
                checkpoint_path_override=active_row.checkpoint_path,
                expected_sha256_override=active_row.checkpoint_sha256,
            )
            if ckpt is not None:
                version_tag = active_row.version_tag
        if ckpt is None:
            ckpt = load_verified_gnn_checkpoint()
            if ckpt is not None:
                matched_row = db.scalars(
                    select(ModelRegistryModel)
                    .where(ModelRegistryModel.checkpoint_sha256 == ckpt.sha256)
                    .order_by(ModelRegistryModel.version_tag != "gnn_ppo_v2_base")
                    .limit(1)
                ).first()
                version_tag = matched_row.version_tag if matched_row is not None else "gnn_ppo_v2_base"

    if ckpt is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error_code": "CHECKPOINT_UNAVAILABLE",
                "message": "Verified GNN-PPO checkpoint not found on disk.",
            },
        )

    raw_logits = ckpt.predict_logits(obs.node_features, obs.adj_in, obs.adj_out)
    raw_probs = ckpt.predict_action_probs(obs.node_features, obs.adj_in, obs.adj_out)
    valid_mask = PolicyGuardrailStrategy.compute_valid_action_mask(obs)
    decision = PolicyGuardrailStrategy.select_action(raw_logits, obs)

    masked_logits = np.where(valid_mask, raw_logits, -1e9)
    flat_m = masked_logits.reshape(-1)
    m_exp = np.exp(flat_m.astype(np.float64) - float(np.max(flat_m)))
    guarded_probs = (m_exp / np.sum(m_exp)).reshape(raw_logits.shape)

    rows_out: list[dict[str, Any]] = []
    for i, node in enumerate(ordered_nodes):
        rows_out.append(
            {
                "node_idx": i,
                "concept_slug": node.concept_slug,
                "title": node.title,
                "tier": node.tier,
                "has_code_challenge": node.has_code_challenge,
                "features": [round(float(v), 4) for v in obs.node_features[i].tolist()],
                "valid_modes": {
                    MODE_NAMES[m]: bool(valid_mask[i, m]) for m in range(len(MODE_NAMES))
                },
                "raw_probs": {
                    MODE_NAMES[m]: round(float(raw_probs[i, m]), 4) for m in range(len(MODE_NAMES))
                },
                "guarded_probs": {
                    MODE_NAMES[m]: round(float(guarded_probs[i, m]), 4)
                    for m in range(len(MODE_NAMES))
                },
            }
        )

    sel_node = ordered_nodes[decision.node_idx]
    return {
        "domain_slug": payload.domain_slug,
        "user_id": str(target_user_id),
        "simulated_time_offset_days": payload.simulated_time_offset_days,
        "model_version": version_tag,
        "checkpoint_sha256": ckpt.sha256,
        "selected_action": {
            "concept_slug": sel_node.concept_slug,
            "node_idx": decision.node_idx,
            "learning_mode": MODE_NAMES[decision.mode],
            "policy_source": decision.policy_source,
            "guardrail_applied": decision.guardrail_applied,
        },
        "nodes": rows_out,
    }


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


def _extract_feature_matrix(obs_raw: Any, expected_node_order: list[str]) -> np.ndarray | None:
    """Extract (N, 8) finite float32 feature matrix strictly validating node_order and bounds (C04)."""
    n_nodes = len(expected_node_order)
    if not isinstance(obs_raw, dict):
        return None
    node_order = obs_raw.get("node_order")
    nodes = obs_raw.get("nodes")
    if not isinstance(node_order, list) or node_order != expected_node_order:
        return None
    if not isinstance(nodes, list) or len(nodes) != n_nodes:
        return None

    rows: list[list[float]] = []
    for entry in nodes:
        if isinstance(entry, dict) and isinstance(entry.get("features"), list) and len(entry["features"]) == 8:
            vec = [float(x) for x in entry["features"]]
        elif isinstance(entry, dict):
            vec = [
                float(entry.get("mastery", 0.0)),
                float(entry.get("confidence", 0.0)),
                float(entry.get("retention", 1.0)),
                float(entry.get("eligible", 0.0)),
                1.0 if entry.get("needs_review") else 0.0,
                float(entry.get("tier_norm", 0.25)),
                float(entry.get("code_score", 0.0)),
                1.0,
            ]
        else:
            return None
        if not all(math.isfinite(v) for v in vec):
            return None
        rows.append(vec)
    arr = np.array(rows, dtype=np.float32)
    return arr if bool(np.all(np.isfinite(arr))) else None


def _build_transition_tensors(
    db: Session,
    samples: list[Any],
    *,
    domain_slug: str | None = None,
) -> dict[str, Any]:
    """Validate real transitions (order, index/concept match, known mode, finite values) and build tensors."""
    topo_cache: dict[
        str, tuple[list[str], np.ndarray, np.ndarray, np.ndarray, list[int], list[list[int]]]
    ] = {}
    transitions: list[ActorTransition] = []
    last_edge_index = np.zeros((2, 0), dtype=np.int64)
    last_node_order: list[str] = []

    for s in samples:
        is_dict = isinstance(s, dict)
        s_domain = str(
            s.get("domain_slug") if is_dict else getattr(s, "domain_slug", "") or domain_slug or ""
        )
        if not s_domain:
            continue
        if s_domain not in topo_cache:
            topo_cache[s_domain] = _load_domain_topology_for_rl(db, s_domain)
        node_order, adj_in, adj_out, edge_index, _tiers, _prereqs = topo_cache[s_domain]
        last_edge_index = edge_index
        last_node_order = node_order

        obs_before_raw = (
            s.get("obs_before_json") if is_dict else getattr(s, "obs_before_json", None)
        )
        obs_after_raw = (
            s.get("obs_after_json") if is_dict else getattr(s, "obs_after_json", None)
        )
        feats_before = _extract_feature_matrix(obs_before_raw, node_order)
        feats_after = _extract_feature_matrix(obs_after_raw, node_order)
        if feats_before is None or feats_after is None:
            continue

        c_slug = str(s.get("concept_slug") if is_dict else getattr(s, "concept_slug", ""))
        if c_slug not in node_order:
            continue
        expected_idx = node_order.index(c_slug)

        raw_node_idx = (
            s.get("action_node_idx")
            if is_dict and "action_node_idx" in s
            else (
                obs_before_raw.get("action_node_idx") if isinstance(obs_before_raw, dict) else None
            )
        )
        if raw_node_idx is not None and int(raw_node_idx) != expected_idx:
            continue
        node_idx = expected_idx

        action_mode = str(s.get("action_mode") if is_dict else getattr(s, "action_mode", ""))
        if action_mode not in MODE_NAME_TO_ENUM:
            continue
        mode_idx = int(MODE_NAME_TO_ENUM[action_mode])

        reward = float(s.get("reward") if is_dict else getattr(s, "reward", float("nan")))
        if not math.isfinite(reward):
            continue
        valid_mask = PolicyGuardrailStrategy.compute_valid_action_mask(feats_before)
        done = bool(
            np.all(feats_after[:, NodeFeatureIdx.DEPTH_NORM] >= 0.75)
            and not np.any(feats_after[:, NodeFeatureIdx.NEEDS_REVIEW] > 0.5)
        )
        transitions.append(
            ActorTransition(
                node_features=feats_before,
                adj_in=adj_in,
                adj_out=adj_out,
                action_idx=node_idx * 4 + mode_idx,
                reward=reward,
                next_node_features=feats_after,
                done=done,
                valid_mask=valid_mask,
                gamma=0.995,
            )
        )

    if not transitions:
        raise ValueError(
            "No valid transitions found: malformed or missing obs_before/obs_after/node_order"
        )
    return {
        "transitions": transitions,
        "edge_index": last_edge_index,
        "node_order": last_node_order,
    }


def _derive_candidate_checkpoint(
    db: Session,
    base_ckpt_path: Path,
    version_tag: str,
    mean_buf_reward: float,
    samples: list[RlExperienceBufferModel] | None = None,
) -> tuple[str, str, dict[str, Any]]:
    """Derive a candidate checkpoint via KL-regularized NumpyGnnPredictor.micro_batch_ppo_update & 200-scenario eval."""
    env_cand_dir = os.environ.get("PLUMORA_CANDIDATES_DIR", "").strip()
    candidates_dir = Path(env_cand_dir) if env_cand_dir else (base_ckpt_path.parent / "candidates")
    candidates_dir.mkdir(parents=True, exist_ok=True)
    cand_file = candidates_dir / f"{version_tag}.zip"

    base_model = NumpyGnnPredictor.from_checkpoint_zip(base_ckpt_path)
    cand_weights = {k: v.copy() for k, v in base_model.w.items()}

    valid_transition_count = 0
    measured_buffer_kl: float | None = None
    if samples:
        built = _build_transition_tensors(db, list(samples))
        transitions: list[ActorTransition] = built["transitions"]
        valid_transition_count = len(transitions)
        update_res = base_model.micro_batch_ppo_update(
            transitions,
            epochs=4,
            lr=0.005,
            clip_eps=0.2,
            beta_kl=0.5,
            max_param_step=0.02,
        )
        cand_weights = update_res.updated_weights
        measured_buffer_kl = update_res.mean_kl_divergence

    buf = io.BytesIO()
    np.savez(buf, **cand_weights)  # type: ignore[arg-type]
    meta = {
        "version_tag": version_tag,
        "parent_checkpoint": base_ckpt_path.name,
        "mean_buffer_reward": round(mean_buf_reward, 4),
        "buffer_samples": valid_transition_count,
        "ppo_epochs": 4,
        "clip_eps": 0.2,
        "beta_kl": 0.5,
        "created_at": datetime.now(UTC).isoformat(),
    }
    with zipfile.ZipFile(cand_file, "w", compression=zipfile.ZIP_DEFLATED) as zout:
        zout.writestr("weights.npz", buf.getvalue())
        zout.writestr("metadata.json", json.dumps(meta))

    cand_sha = hashlib.sha256(cand_file.read_bytes()).hexdigest()
    eval_report = _evaluate_candidate_against_active(
        db,
        candidate_checkpoint_path=cand_file,
        active_checkpoint_path=base_ckpt_path,
        eval_episodes=200,
        seed=2026,
        kl_override=measured_buffer_kl,
    )

    rel_path = (
        str(cand_file.relative_to(REPO_ROOT))
        if cand_file.is_relative_to(REPO_ROOT)
        else str(cand_file)
    )
    return rel_path, cand_sha, eval_report


def run_micro_batch_online_rl(
    db: Session,
    payload: MicroBatchTrainRequest,
) -> dict[str, Any]:
    """Run KL-constrained micro-batch update, write real checkpoint zip, and run 200-scenario Safety Gate."""
    _ensure_prod_model_seeded(db)
    buf_count = int(db.scalar(select(func.count()).select_from(RlExperienceBufferModel)) or 0)
    if buf_count < payload.batch_size:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "INSUFFICIENT_BUFFER_SAMPLES",
                "message": f"Buffer has {buf_count} samples, requires >= {payload.batch_size}.",
            },
        )

    samples = db.scalars(
        select(RlExperienceBufferModel)
        .order_by(RlExperienceBufferModel.created_at.desc())
        .limit(payload.batch_size)
    ).all()

    mean_buf_reward = sum(s.reward for s in samples) / max(1, len(samples))
    cand_id = uuid.uuid4()
    version_tag = f"gnn_ppo_online_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}_{cand_id.hex[:4]}"

    active_row = db.scalars(
        select(ModelRegistryModel)
        .where(ModelRegistryModel.is_active.is_(True))
        .order_by(ModelRegistryModel.activated_at.desc(), ModelRegistryModel.created_at.desc())
        .limit(1)
    ).first()
    baseline_path = BASE_CKPT_PATH
    if active_row is not None and active_row.checkpoint_path:
        raw_p = Path(active_row.checkpoint_path)
        resolved_p = raw_p if raw_p.is_absolute() else (REPO_ROOT / raw_p)
        if resolved_p.exists():
            baseline_path = resolved_p

    if baseline_path.exists():
        try:
            cand_path, cand_sha, eval_report = _derive_candidate_checkpoint(
                db,
                baseline_path,
                version_tag,
                mean_buf_reward,
                samples=list(samples),
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail={
                    "error_code": "INVALID_RL_TRANSITIONS",
                    "message": str(exc),
                },
            ) from exc
    else:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error_code": "BASE_CHECKPOINT_MISSING",
                "message": "Active GNN-PPO checkpoint file not found on disk.",
            },
        )

    kl_div = float(eval_report["kl_divergence"])
    invalid_unmasked = float(eval_report["unmasked_invalid_rate"])
    masked_violation = float(eval_report["guardrail_violations"])
    reward_ratio = float(eval_report["reward_ratio"])

    block_reasons: list[str] = []
    if kl_div > payload.kl_target_max:
        block_reasons.append(f"KL_EXCEEDED_TARGET ({kl_div:.4f} > {payload.kl_target_max:.4f})")
    if invalid_unmasked >= 0.05:
        block_reasons.append(f"UNMASKED_INVALID_RATE_HIGH ({invalid_unmasked:.4f} >= 0.05)")
    if masked_violation > 0.0:
        block_reasons.append(f"GUARDRAIL_VIOLATION_NONZERO ({masked_violation:.4f})")
    if reward_ratio < 0.98:
        block_reasons.append(f"REWARD_REGRESSION_BELOW_98_PCT ({reward_ratio:.4f} < 0.98)")

    passed_gate = len(block_reasons) == 0
    verdict = "PASSED" if passed_gate else "BLOCKED"

    eval_metrics_payload = {
        "eval_episodes": eval_report["eval_episodes"],
        "domains_evaluated": eval_report["domains_evaluated"],
        "candidate_mean_reward": eval_report["candidate_mean_reward"],
        "active_mean_reward": eval_report["active_mean_reward"],
        "reward_delta": eval_report["reward_delta"],
        "invalid_action_rate_unmasked": invalid_unmasked,
        "masked_violation_rate": masked_violation,
        "mean_reward_ratio_vs_prod": reward_ratio,
        "block_reasons": block_reasons,
        "eval_source": "checkpoint_disk_eval_200",
    }

    cand = ModelRegistryModel(
        id=cand_id,
        version_tag=version_tag,
        checkpoint_path=cand_path,
        checkpoint_sha256=cand_sha,
        kl_divergence=kl_div,
        gate_verdict=verdict,
        is_active=False,
        eval_metrics_json=eval_metrics_payload,
    )
    db.add(cand)
    db.flush()

    db.add(
        OnlineEvalRunModel(
            id=uuid.uuid4(),
            candidate_model_id=cand.id,
            gate_verdict=verdict,
            invalid_action_rate_unmasked=invalid_unmasked,
            masked_violation_rate=masked_violation,
            mean_reward_ratio_vs_prod=reward_ratio,
        )
    )
    db.commit()

    return {
        "candidate_model_id": str(cand.id),
        "version_tag": cand.version_tag,
        "checkpoint_sha256": cand.checkpoint_sha256,
        "kl_divergence": kl_div,
        "safety_eval": {
            "gate_verdict": verdict,
            "invalid_action_rate_unmasked": invalid_unmasked,
            "masked_violation_rate": masked_violation,
            "mean_reward_ratio_vs_prod": reward_ratio,
            "candidate_mean_reward": eval_report["candidate_mean_reward"],
            "active_mean_reward": eval_report["active_mean_reward"],
            "reward_delta": eval_report["reward_delta"],
            "block_reasons": block_reasons,
        },
    }


def _verify_checkpoint_artifact(checkpoint_path_str: str, expected_sha256: str) -> Path:
    """Verify checkpoint file exists on disk, SHA-256 matches registry, and weights.npz is readable."""
    raw_p = Path(checkpoint_path_str)
    resolved = raw_p if raw_p.is_absolute() else (REPO_ROOT / raw_p)
    if not resolved.exists() or not resolved.is_file():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "error_code": "MODEL_ARTIFACT_INVALID",
                "message": f"Checkpoint file not found on disk: {checkpoint_path_str}",
            },
        )
    actual_sha = hashlib.sha256(resolved.read_bytes()).hexdigest()
    if actual_sha != expected_sha256:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "error_code": "MODEL_ARTIFACT_INVALID",
                "message": "Checkpoint SHA-256 mismatch against model_registry record.",
            },
        )
    try:
        with zipfile.ZipFile(resolved, "r") as zf:
            if "weights.npz" not in zf.namelist():
                raise ValueError("Missing weights.npz")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "error_code": "MODEL_ARTIFACT_INVALID",
                "message": f"Checkpoint archive invalid: {exc}",
            },
        ) from exc
    return resolved


MODEL_REGISTRY_ADVISORY_LOCK_ID = 7_586_672_001


def _acquire_model_registry_lock(db: Session) -> None:
    """Serialize multi-worker model activation and rollback mutations via PostgreSQL advisory lock."""
    bind = db.get_bind()
    if bind is not None and bind.dialect.name == "postgresql":
        db.execute(
            text("SELECT pg_advisory_xact_lock(:lock_id)"),
            {"lock_id": MODEL_REGISTRY_ADVISORY_LOCK_ID},
        )


def activate_candidate_model(
    db: Session,
    model_id: uuid.UUID,
    *,
    reason: str = "Admin activation",
) -> dict[str, Any]:
    """Activate a PASSED candidate model, verify SHA-256, and sync Redis active pointer."""
    t0 = time.monotonic()
    _ensure_prod_model_seeded(db)
    _acquire_model_registry_lock(db)
    cand = db.get(ModelRegistryModel, model_id)
    if cand is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "MODEL_NOT_FOUND", "message": "Candidate model not found."},
        )
    if cand.gate_verdict != "PASSED":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "error_code": "SAFETY_GATE_NOT_PASSED",
                "message": "Cannot activate a model whose Safety Evaluation Gate verdict is not PASSED.",
            },
        )
    _verify_checkpoint_artifact(cand.checkpoint_path, cand.checkpoint_sha256)

    prev = db.scalars(
        select(ModelRegistryModel).where(ModelRegistryModel.is_active.is_(True)).with_for_update()
    ).first()
    prev_id = str(prev.id) if (prev and prev.id != cand.id) else None
    db.execute(
        update(ModelRegistryModel)
        .where(ModelRegistryModel.is_active.is_(True), ModelRegistryModel.id != cand.id)
        .values(is_active=False)
    )
    db.flush()

    cand.is_active = True
    cand.activated_at = datetime.now(UTC)
    cand.eval_metrics_json = {
        **dict(cand.eval_metrics_json or {}),
        **({"previous_active_model_id": prev_id} if prev_id else {}),
        "last_activation_reason": reason,
    }
    db.commit()
    publish_active_model_pointer(str(cand.checkpoint_path), str(cand.checkpoint_sha256))

    latency_ms = max(1, int((time.monotonic() - t0) * 1000))
    return {
        "active_model_id": str(cand.id),
        "previous_model_id": prev_id,
        "active_checkpoint_sha256": cand.checkpoint_sha256,
        "switched_at": cand.activated_at.isoformat(),
        "switch_latency_ms": latency_ms,
        "reason": reason,
    }


def rollback_active_model(
    db: Session,
    *,
    reason: str = "1-Click Rollback",
) -> dict[str, Any]:
    """1-Click Rollback (< 2000ms) to the actual previously active PASSED checkpoint."""
    t0 = time.monotonic()
    _ensure_prod_model_seeded(db)
    _acquire_model_registry_lock(db)
    curr = db.scalars(
        select(ModelRegistryModel).where(ModelRegistryModel.is_active.is_(True)).with_for_update()
    ).first()

    target: ModelRegistryModel | None = None
    if curr is not None and isinstance(curr.eval_metrics_json, dict):
        prev_ptr = curr.eval_metrics_json.get("previous_active_model_id")
        if prev_ptr:
            try:
                candidate_prev = db.get(ModelRegistryModel, uuid.UUID(str(prev_ptr)))
                if (
                    candidate_prev is not None
                    and candidate_prev.gate_verdict == "PASSED"
                    and candidate_prev.id != curr.id
                ):
                    try:
                        _verify_checkpoint_artifact(
                            candidate_prev.checkpoint_path,
                            candidate_prev.checkpoint_sha256,
                        )
                        target = candidate_prev
                    except HTTPException:
                        target = None
            except ValueError:
                target = None

    if target is None:
        stmt = (
            select(ModelRegistryModel)
            .where(ModelRegistryModel.gate_verdict == "PASSED")
            .order_by(
                ModelRegistryModel.activated_at.is_(None),
                ModelRegistryModel.activated_at.desc(),
                ModelRegistryModel.created_at.asc(),
            )
        )
        for m in db.scalars(stmt).all():
            if curr is None or m.id != curr.id:
                try:
                    _verify_checkpoint_artifact(m.checkpoint_path, m.checkpoint_sha256)
                    target = m
                    break
                except HTTPException:
                    continue

    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "NO_ROLLBACK_TARGET",
                "message": "No previously active safe rollback target found.",
            },
        )

    prev_id = str(curr.id) if curr else None
    db.execute(
        update(ModelRegistryModel)
        .where(ModelRegistryModel.is_active.is_(True), ModelRegistryModel.id != target.id)
        .values(is_active=False)
    )
    db.flush()
    target.is_active = True
    target.activated_at = datetime.now(UTC)
    target.eval_metrics_json = {
        **dict(target.eval_metrics_json or {}),
        "last_rollback_reason": reason,
    }
    db.commit()
    invalidate_active_model_cache()
    publish_active_model_pointer(str(target.checkpoint_path), str(target.checkpoint_sha256))

    latency_ms = max(1, int((time.monotonic() - t0) * 1000))
    return {
        "active_model_id": str(target.id),
        "previous_model_id": prev_id,
        "active_checkpoint_sha256": target.checkpoint_sha256,
        "switched_at": target.activated_at.isoformat(),
        "switch_latency_ms": latency_ms,
        "reason": reason,
    }


def trigger_manual_outbox_relay(db: Session) -> dict[str, Any]:
    """Admin-triggered immediate outbox relay across assessment+content & Redis Streams consume."""
    if assessment_service_url() or content_service_url():
        remote_relayed = trigger_remote_outbox_relays_internal()
        comp_stats = consume_competency_stream_once(db)
        dom_stats = consume_domain_events_stream_once(db, consumer_group="rec_ai_domain_cg")
        return {
            "status": "ok",
            "relayed": remote_relayed,
            **comp_stats,
            "domain_events_consumed": dom_stats["consumed"],
        }
    stats = run_outbox_relay_and_consume_once(db)
    return {
        "status": "ok",
        **stats,
    }


def get_streams_dlq_entries(*, limit: int = 50) -> dict[str, Any]:
    """Read Dead-Letter Queue entries from Redis Streams."""
    dlq_streams = [f"{COMPETENCY_STREAM_NAME}:dlq", f"{DOMAIN_STREAM_NAME}:dlq"]
    entries: list[dict[str, Any]] = []
    try:
        client = get_redis_client(decode_responses=True, socket_timeout=0.5)
        for s_name in dlq_streams:
            try:
                raw_msgs = client.xrevrange(s_name, max="+", min="-", count=limit)
                if isinstance(raw_msgs, list):
                    for msg_id, fields in raw_msgs:
                        entries.append(
                            {
                                "stream": s_name,
                                "msg_id": str(msg_id),
                                "fields": dict(fields) if isinstance(fields, dict) else {},
                            }
                        )
            except redis.ResponseError:
                continue
    except (redis.RedisError, OSError) as exc:
        logger.warning("Failed to read DLQ streams from Redis: %s", exc)
        return {"redis_connected": False, "dlq_count": 0, "entries": []}

    return {
        "redis_connected": True,
        "dlq_count": len(entries),
        "entries": entries[:limit],
    }


def _probe_http_health(url: str) -> str:
    try:
        with urllib.request.urlopen(url, timeout=0.5) as resp:
            return "up" if 200 <= resp.status < 300 else "degraded"
    except (urllib.error.URLError, OSError, ValueError):
        return "down"


def get_system_health_status(db: Session) -> dict[str, Any]:
    """Return honest probed status of PostgreSQL/SQLite, Redis, RL Checkpoint, Outbox, DLQ & 4 services."""
    pg_ok = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        pg_ok = False

    pending_outbox = -1
    outbox_by_event_type: dict[str, int] = {
        "CompetencyUpdatedEvent": 0,
        "DomainGraphUpdatedEvent": 0,
    }
    if assessment_service_url() or content_service_url():
        ext_outbox = fetch_all_outbox_pending_internal()
        if ext_outbox is not None:
            pending_outbox, outbox_by_event_type = ext_outbox
        else:
            pending_outbox = -1
    else:
        try:
            pending_outbox = int(
                db.scalar(
                    select(func.count())
                    .select_from(OutboxEventModel)
                    .where(OutboxEventModel.published_at.is_(None))
                )
                or 0
            )
            ev_rows = db.execute(
                select(OutboxEventModel.event_type, func.count())
                .where(OutboxEventModel.published_at.is_(None))
                .group_by(OutboxEventModel.event_type)
            ).all()
            for ev_type, cnt in ev_rows:
                outbox_by_event_type[str(ev_type)] = int(cnt)
        except SQLAlchemyError:
            db.rollback()
            ext_outbox = fetch_all_outbox_pending_internal()
            if ext_outbox is not None:
                pending_outbox, outbox_by_event_type = ext_outbox
            else:
                pending_outbox = -1

    bind = db.get_bind()
    db_dialect = str(bind.dialect.name) if bind is not None else "unknown"
    schemas_isolated = False
    if db_dialect == "postgresql":
        rows = db.execute(
            text(
                "SELECT nspname FROM pg_catalog.pg_namespace "
                "WHERE nspname IN ('auth_svc', 'content_svc', 'assess_svc', 'rec_ai_svc')"
            )
        ).scalars().all()
        public_app_tables = db.execute(
            text(
                "SELECT count(*) FROM pg_catalog.pg_class c "
                "JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace "
                "WHERE n.nspname = 'public' AND c.relkind = 'r' "
                "AND c.relname IN ('users', 'domains', 'concepts', 'assessment_sessions', 'model_registry')"
            )
        ).scalar()
        svc_roles = db.execute(
            text(
                "SELECT count(*) FROM pg_catalog.pg_roles "
                "WHERE rolname IN ('auth_svc_user', 'content_svc_user', 'assess_svc_user', 'rec_ai_svc_user')"
            )
        ).scalar()
        priv_ok = db.execute(
            text(
                "SELECT NOT has_schema_privilege('assess_svc_user', 'content_svc', 'USAGE') "
                "AND NOT has_schema_privilege('rec_ai_svc_user', 'assess_svc', 'USAGE') "
                "AND NOT has_schema_privilege('content_svc_user', 'auth_svc', 'USAGE')"
            )
        ).scalar()
        schemas_isolated = (
            len(set(rows)) == 4
            and int(public_app_tables or 0) == 0
            and int(svc_roles or 0) == 4
            and bool(priv_ok)
        )

    redis_ok = False
    cache_hit_rate = 0.0
    consumer_group_active = False
    redis_stream_pending = -1
    redis_lag_ms: float | None = None
    c2c_last_ms: float | None = None
    c2c_p95_ms: float | None = None
    c2c_samples = 0
    pending_age_ms: float | None = None
    dlq_count = 0
    stream_lengths: dict[str, int] = {
        "CompetencyUpdatedEvent": 0,
        "DomainGraphUpdatedEvent": 0,
    }
    try:
        client = get_redis_client(decode_responses=True, socket_timeout=0.5)
        redis_ok = bool(client.ping())
        if redis_ok:
            hits = int(client.get("plumora:metrics:kg_cache_hits") or 0)
            misses = int(client.get("plumora:metrics:kg_cache_misses") or 0)
            if hits + misses > 0:
                cache_hit_rate = round(hits / (hits + misses), 4)
            last_c2c = client.get("plumora:metrics:last_commit_to_consume_ms")
            if last_c2c is not None:
                c2c_last_ms = round(float(last_c2c), 2)
                redis_lag_ms = c2c_last_ms
            raw_samples = client.lrange("plumora:metrics:commit_to_consume_samples", 0, 199)
            if raw_samples:
                vals = sorted(float(x) for x in raw_samples)
                c2c_samples = len(vals)
                p95_idx = min(c2c_samples - 1, max(0, int(0.95 * (c2c_samples - 1))))
                c2c_p95_ms = round(vals[p95_idx], 2)

            try:
                stream_lengths["CompetencyUpdatedEvent"] = int(client.xlen(COMPETENCY_STREAM_NAME))
            except redis.ResponseError:
                stream_lengths["CompetencyUpdatedEvent"] = 0
            try:
                stream_lengths["DomainGraphUpdatedEvent"] = int(client.xlen(DOMAIN_STREAM_NAME))
            except redis.ResponseError:
                stream_lengths["DomainGraphUpdatedEvent"] = 0
            for dlq_s in (f"{COMPETENCY_STREAM_NAME}:dlq", f"{DOMAIN_STREAM_NAME}:dlq"):
                try:
                    dlq_count += int(client.xlen(dlq_s))
                except redis.ResponseError:
                    continue

            try:
                groups = client.xinfo_groups(COMPETENCY_STREAM_NAME)
                worker_alive = bool(client.exists(WORKER_HEARTBEAT_KEY))
                if groups and worker_alive:
                    consumer_group_active = True
                    redis_stream_pending = sum(
                        int(g.get("pending", 0) or 0) + int(g.get("lag", 0) or 0)
                        for g in groups
                    )
                    pending_summary = client.xpending(COMPETENCY_STREAM_NAME, "rec_ai_cg")
                    oldest_id = (
                        pending_summary.get("min")
                        if isinstance(pending_summary, dict)
                        else None
                    )
                    if oldest_id and "-" in str(oldest_id):
                        msg_ts_ms = int(str(oldest_id).split("-", 1)[0])
                        pending_age_ms = round(max(0.0, time.time() * 1000.0 - msg_ts_ms), 2)
                        redis_lag_ms = pending_age_ms
                    elif redis_lag_ms is None:
                        redis_lag_ms = 0.0
                else:
                    redis_stream_pending = -1
            except redis.ResponseError:
                consumer_group_active = False
                redis_stream_pending = -1
    except (redis.RedisError, OSError):
        redis_ok = False
        redis_stream_pending = -1
        redis_lag_ms = -1.0

    if redis_lag_ms is None:
        redis_lag_ms = -1.0 if not redis_ok else 0.0

    ckpt_ok = load_verified_gnn_checkpoint() is not None

    svc_urls = {
        "auth": os.getenv("AUTH_SERVICE_URL", "").strip(),
        "content_kg": os.getenv("CONTENT_SERVICE_URL", "").strip(),
        "assessment_grader": (
            os.getenv("ASSESSMENT_SERVICE_URL", "").strip()
            or os.getenv("ASSESS_SERVICE_URL", "").strip()
        ),
        "recommendation_ai": (
            os.getenv("RECOMMENDATION_SERVICE_URL", "").strip()
            or os.getenv("REC_AI_SERVICE_URL", "").strip()
        ),
    }
    has_external_services = any(svc_urls.values())
    deployment_mode = "microservices" if has_external_services else "monolith"

    if has_external_services:
        services_status = {
            name: (_probe_http_health(f"{url.rstrip('/')}/health") if url else "down")
            for name, url in svc_urls.items()
        }
    else:
        services_status = {
            "auth": "in_process" if pg_ok else "down",
            "content_kg": "in_process" if pg_ok else "down",
            "assessment_grader": "in_process" if pg_ok else "down",
            "recommendation_ai": "in_process" if (pg_ok and ckpt_ok) else "degraded",
        }

    return {
        "mode": deployment_mode,
        "db_dialect": db_dialect,
        "services": services_status,
        "postgres_connected": pg_ok,
        "rl_checkpoint_verified": ckpt_ok,
        "schemas_isolated": schemas_isolated,
        "outbox_pending_count": pending_outbox,
        "outbox_pending_by_event_type": outbox_by_event_type,
        "stream_lengths_by_event_type": stream_lengths,
        "dlq_count": dlq_count,
        "redis_connected": redis_ok,
        "redis_stream_lag_ms": redis_lag_ms,
        "redis_stream_pending_age_ms": pending_age_ms,
        "outbox_commit_to_consume_last_ms": c2c_last_ms,
        "outbox_commit_to_consume_p95_ms": c2c_p95_ms,
        "outbox_commit_to_consume_samples": c2c_samples,
        "consumer_group_active": consumer_group_active,
        "redis_stream_pending": redis_stream_pending,
        "graph_cache_hit_rate": cache_hit_rate,
    }


def get_admin_rl_analytics(
    db: Session,
    *,
    domain_slug: str | None = None,
    user_id: uuid.UUID | None = None,
    limit: int = 30,
) -> dict[str, Any]:
    """Aggregate live production RL recommendation logs for Admin RL Observability Dashboard (D-40)."""
    stmt = select(RecommendationLogModel)
    if domain_slug:
        stmt = stmt.where(RecommendationLogModel.domain_slug == domain_slug)
    if user_id is not None:
        stmt = stmt.where(RecommendationLogModel.user_id == user_id)

    rows = list(db.scalars(stmt.order_by(RecommendationLogModel.created_at.desc()).limit(1000)).all())
    total = len(rows)

    guardrail_cnt = sum(1 for r in rows if r.guardrail_applied)
    fallback_cnt = sum(1 for r in rows if "fallback" in (r.policy_source or "").lower())
    redis_hit_cnt = sum(1 for r in rows if (r.state_source or "").startswith("redis"))

    mode_counts: dict[str, int] = {}
    domain_counts: dict[str, int] = {}
    concept_counts: dict[str, int] = {}
    policy_counts: dict[str, int] = {}

    for r in rows:
        mode = r.recommended_mode or "completed"
        mode_counts[mode] = mode_counts.get(mode, 0) + 1
        dom = r.domain_slug or "unknown"
        domain_counts[dom] = domain_counts.get(dom, 0) + 1
        if r.recommended_concept_slug:
            concept_counts[r.recommended_concept_slug] = (
                concept_counts.get(r.recommended_concept_slug, 0) + 1
            )
        ps = r.policy_source or "unknown"
        policy_counts[ps] = policy_counts.get(ps, 0) + 1

    by_mode = [
        {"mode": k, "count": v, "share_pct": round((v / total) * 100.0, 1) if total else 0.0}
        for k, v in sorted(mode_counts.items(), key=lambda kv: (-kv[1], kv[0]))
    ]
    by_domain = [
        {"domain_slug": k, "count": v, "share_pct": round((v / total) * 100.0, 1) if total else 0.0}
        for k, v in sorted(domain_counts.items(), key=lambda kv: (-kv[1], kv[0]))
    ]
    top_concepts = [
        {"concept_slug": k, "count": v, "share_pct": round((v / total) * 100.0, 1) if total else 0.0}
        for k, v in sorted(concept_counts.items(), key=lambda kv: (-kv[1], kv[0]))[:10]
    ]
    recent_decisions = [
        {
            "id": str(r.id),
            "user_id": str(r.user_id),
            "domain_slug": r.domain_slug,
            "recommended_concept_slug": r.recommended_concept_slug,
            "recommended_mode": r.recommended_mode,
            "policy_source": r.policy_source,
            "state_source": r.state_source,
            "guardrail_applied": bool(r.guardrail_applied),
            "checkpoint_sha256": r.checkpoint_sha256 or "",
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows[: max(1, min(limit, 100))]
    ]

    return {
        "total_recommendations": total,
        "guardrail_intervention_rate": round(guardrail_cnt / total, 4) if total else 0.0,
        "fallback_rate": round(fallback_cnt / total, 4) if total else 0.0,
        "redis_cache_hit_rate": round(redis_hit_cnt / total, 4) if total else 0.0,
        "policy_source_counts": policy_counts,
        "by_mode": by_mode,
        "by_domain": by_domain,
        "top_concepts": top_concepts,
        "recent_decisions": recent_decisions,
    }
