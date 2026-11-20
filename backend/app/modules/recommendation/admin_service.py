"""Service layer for Safe Micro-batch Online RL, Safety Evaluation Gate & 1-Click Rollback."""

from __future__ import annotations

import hashlib
import io
import json
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
from sqlalchemy import func, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import REPO_ROOT, settings
from app.db.models import (
    DomainConceptMapModel,
    ModelRegistryModel,
    OnlineEvalRunModel,
    OutboxEventModel,
    RlExperienceBufferModel,
)
from app.modules.assessment.ebbinghaus import is_review_needed
from app.modules.events.internal_client import (
    assessment_service_url,
    content_service_url,
    fetch_domain_bundle_internal,
    fetch_outbox_pending_count_internal,
)
from app.modules.recommendation.admin_schemas import (
    MicroBatchTrainRequest,
    ModelRegistryItemOut,
    OnlineRlStatusResponse,
)
from app.modules.recommendation.gnn_loader import (
    VerifiedGnnPpoCheckpoint,
    load_verified_gnn_checkpoint,
)
from app.modules.recommendation.guardrail import select_guarded_action

_CFG_CKPT_PATH = Path(settings.rl_checkpoint_path)
BASE_CKPT_PATH = (
    _CFG_CKPT_PATH
    if _CFG_CKPT_PATH.exists()
    else REPO_ROOT / "rl" / "artifacts" / "gnn_ppo_v2_base.zip"
)
WORKER_HEARTBEAT_KEY = "plumora:worker:rec_ai_cg"


def _ensure_prod_model_seeded(db: Session) -> ModelRegistryModel | None:
    existing = db.scalars(
        select(ModelRegistryModel).order_by(ModelRegistryModel.created_at)
    ).first()
    if existing is not None:
        return existing

    sha = (
        hashlib.sha256(BASE_CKPT_PATH.read_bytes()).hexdigest()
        if BASE_CKPT_PATH.exists()
        else "0" * 64
    )
    prod = ModelRegistryModel(
        id=uuid.uuid4(),
        version_tag="gnn_ppo_v2_base",
        checkpoint_path="rl/artifacts/gnn_ppo_v2_base.zip",
        checkpoint_sha256=sha,
        kl_divergence=0.0,
        gate_verdict="PASSED",
        is_active=True,
        eval_metrics_json={
            "invalid_action_rate_unmasked": 0.0,
            "masked_violation_rate": 0.0,
            "mean_reward_ratio_vs_prod": 1.0,
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
    )


def get_online_rl_status(db: Session, *, limit: int = 50) -> OnlineRlStatusResponse:
    """Return Experience Buffer count and bounded Model Registry status."""
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


def _load_domain_topology_for_rl(
    db: Session,
    domain_slug: str,
) -> tuple[list[str], np.ndarray, np.ndarray, np.ndarray, list[int], list[list[int]]]:
    """Load real domain DAG topology (node_order, adj_in, adj_out, edge_index, tiers, prereq_indices)."""
    node_order: list[str] = []
    tiers: list[int] = []
    prereq_slugs: list[list[str]] = []

    if content_service_url():
        bundle = fetch_domain_bundle_internal(domain_slug)
        if bundle is None:
            raise ValueError(f"Domain '{domain_slug}' bundle unavailable")
        raw_nodes = sorted(bundle.get("nodes", []), key=lambda x: int(x.get("node_idx", 0)))
        for n in raw_nodes:
            node_order.append(str(n["concept_slug"]))
            tiers.append(int(n.get("tier", 1)))
            prereq_slugs.append(list(n.get("prerequisites_json") or []))
    else:
        db_nodes = db.scalars(
            select(DomainConceptMapModel)
            .where(DomainConceptMapModel.domain_slug == domain_slug)
            .order_by(DomainConceptMapModel.node_idx)
        ).all()
        for n in db_nodes:
            node_order.append(str(n.concept_slug))
            tiers.append(int(n.tier))
            prereq_slugs.append(list(n.prerequisites_json or []))

    n_nodes = len(node_order)
    if n_nodes == 0:
        raise ValueError(f"Domain '{domain_slug}' has no nodes in topology")

    slug_to_idx = {s: i for i, s in enumerate(node_order)}
    adj_in = np.zeros((n_nodes, n_nodes), dtype=np.float32)
    adj_out = np.zeros((n_nodes, n_nodes), dtype=np.float32)
    src_edges: list[int] = []
    dst_edges: list[int] = []
    prereq_indices: list[list[int]] = [[] for _ in range(n_nodes)]

    for i, p_list in enumerate(prereq_slugs):
        for p_slug in p_list:
            p_idx = slug_to_idx.get(p_slug)
            if p_idx is not None:
                adj_in[i, p_idx] = 1.0
                adj_out[p_idx, i] = 1.0
                src_edges.append(p_idx)
                dst_edges.append(i)
                prereq_indices[i].append(p_idx)

    edge_index = (
        np.array([src_edges, dst_edges], dtype=np.int64)
        if src_edges
        else np.zeros((2, 0), dtype=np.int64)
    )
    return node_order, adj_in, adj_out, edge_index, tiers, prereq_indices


def _rollout_policy_eval_on_topologies(
    model: VerifiedGnnPpoCheckpoint,
    topologies: list[tuple[str, list[str], np.ndarray, np.ndarray, list[int], list[list[int]]]],
    *,
    episodes: int = 200,
    seed: int = 2026,
) -> tuple[float, float, float, list[str]]:
    """Evaluate a checkpoint across real domain DAG topologies with shared Policy Guardrail."""
    rng = np.random.default_rng(seed)
    ep_rewards: list[float] = []
    unmasked_invalid = 0
    masked_invalid = 0
    total_steps = 0
    domains_evaluated = sorted({t[0] for t in topologies})

    for ep in range(episodes):
        _dslug, node_order, adj_in, adj_out, tiers, prereq_indices = topologies[ep % len(topologies)]
        n_nodes = len(node_order)
        depth = np.zeros(n_nodes, dtype=np.float32)
        code_score = np.zeros(n_nodes, dtype=np.float32)
        retention = np.ones(n_nodes, dtype=np.float32)
        ep_rew = 0.0
        for step in range(min(12, n_nodes)):
            total_steps += 1
            if step > 0:
                retention = np.where(depth >= 0.5, np.maximum(0.3, retention - 0.12), retention)

            feats = np.zeros((n_nodes, 8), dtype=np.float32)
            eligible = np.zeros(n_nodes, dtype=bool)
            needs_review = np.zeros(n_nodes, dtype=bool)
            for i in range(n_nodes):
                prereq_ok = all(depth[p] >= 0.75 for p in prereq_indices[i])
                needs_rev_i = is_review_needed(float(depth[i]), float(retention[i]))
                needs_review[i] = needs_rev_i
                eligible[i] = prereq_ok and (depth[i] < 1.0 or needs_rev_i)
                feats[i, 0] = depth[i]
                feats[i, 1] = 0.85 if depth[i] >= 0.5 else 0.0
                feats[i, 2] = retention[i]
                feats[i, 3] = 1.0 if prereq_ok else 0.0
                feats[i, 4] = 1.0 if needs_rev_i else 0.0
                feats[i, 5] = float(tiers[i]) / 4.0
                feats[i, 6] = code_score[i]
                feats[i, 7] = 1.0

            logits = model.predict_logits(feats, adj_in, adj_out)
            raw_v = int(np.argmax(logits.reshape(-1))) // 4
            if feats[raw_v, 3] < 0.5:
                unmasked_invalid += 1

            if not (np.any(eligible) or np.any(needs_review)):
                break
            sel_v, sel_m, _pol_src, _applied = select_guarded_action(
                logits,
                eligible=eligible,
                needs_review=needs_review,
                depth=depth,
                retention=retention,
            )

            if feats[sel_v, 3] < 0.5:
                masked_invalid += 1
                ep_rew -= 1.0
                continue

            if sel_m == 0:  # Learn_New
                if depth[sel_v] < 0.50:
                    if float(rng.random()) < 0.90:
                        depth[sel_v] = 0.50
                        retention[sel_v] = 1.0
                        ep_rew += 1.0
                    else:
                        ep_rew -= 0.1
                else:
                    ep_rew -= 0.35
            elif sel_m == 1:  # Deep_Probe
                if 0.50 <= depth[sel_v] < 1.0:
                    if float(rng.random()) < 0.85:
                        depth[sel_v] = min(1.0, float(depth[sel_v]) + 0.25)
                        retention[sel_v] = 1.0
                        ep_rew += 1.5
                    else:
                        ep_rew -= 0.15
                else:
                    ep_rew -= 0.4
            elif sel_m == 2:  # Code_Practice
                if 0.25 <= depth[sel_v] < 1.0 and code_score[sel_v] < 1.0:
                    if float(rng.random()) < 0.85:
                        code_score[sel_v] = 1.0
                        depth[sel_v] = max(float(depth[sel_v]), 0.75)
                        retention[sel_v] = 1.0
                        ep_rew += 1.8
                    else:
                        ep_rew -= 0.15
                else:
                    ep_rew -= 0.3
            else:  # Spaced_Review (sel_m == 3)
                if feats[sel_v, 4] > 0.5:
                    retention[sel_v] = 1.0
                    ep_rew += 1.5
                else:
                    ep_rew -= 0.3
        ep_rewards.append(ep_rew)

    mean_rew = float(np.mean(ep_rewards)) if ep_rewards else 0.0
    unmasked_rate = round(unmasked_invalid / max(1, total_steps), 4)
    masked_rate = round(masked_invalid / max(1, total_steps), 4)
    return mean_rew, unmasked_rate, masked_rate, domains_evaluated


def _load_ckpt_weights(ckpt_path: Path) -> VerifiedGnnPpoCheckpoint:
    with zipfile.ZipFile(ckpt_path, "r") as zf:
        raw_npz = zf.read("weights.npz")
    npz = np.load(io.BytesIO(raw_npz))
    weights = {k: npz[k].astype(np.float32).copy() for k in npz.files}
    return VerifiedGnnPpoCheckpoint(ckpt_path.name, weights)


def _evaluate_candidate_against_active(
    db: Session,
    *,
    candidate_checkpoint_path: Path,
    active_checkpoint_path: Path,
    eval_episodes: int = 200,
    seed: int = 2026,
) -> dict[str, Any]:
    """Compare candidate vs active checkpoint over 200 scenarios across real domain DAG topologies."""
    cand_model = _load_ckpt_weights(candidate_checkpoint_path)
    active_model = _load_ckpt_weights(active_checkpoint_path)

    topologies: list[tuple[str, list[str], np.ndarray, np.ndarray, list[int], list[list[int]]]] = []
    for dslug in ("backend", "frontend", "devops"):
        try:
            node_order, adj_in, adj_out, _edge_index, tiers, prereq_indices = _load_domain_topology_for_rl(db, dslug)
            topologies.append((dslug, node_order, adj_in, adj_out, tiers, prereq_indices))
        except ValueError:
            continue
    if not topologies:
        raise ValueError("No domain topologies available for Safety Evaluation Gate")

    active_mean_rew, _, _, domains_evaluated = _rollout_policy_eval_on_topologies(
        active_model, topologies, episodes=eval_episodes, seed=seed
    )
    cand_mean_rew, unmasked_invalid_rate, masked_violation_rate, _ = _rollout_policy_eval_on_topologies(
        cand_model, topologies, episodes=eval_episodes, seed=seed
    )

    # Measure KL divergence across real domain graph states
    rng = np.random.default_rng(42)
    kl_values: list[float] = []
    for idx in range(40):
        _dslug, node_order, adj_in, adj_out, tiers, prereq_indices = topologies[idx % len(topologies)]
        n_nodes = len(node_order)
        feats = np.zeros((n_nodes, 8), dtype=np.float32)
        mastered_k = int(rng.integers(0, max(1, n_nodes - 1)))
        for i in range(n_nodes):
            prereq_ok = all(p < mastered_k for p in prereq_indices[i])
            feats[i, 0] = 0.75 if i < mastered_k else 0.0
            feats[i, 1] = 0.85 if i < mastered_k else 0.0
            feats[i, 2] = 1.0
            feats[i, 3] = 1.0 if prereq_ok else 0.0
            feats[i, 5] = float(tiers[i]) / 4.0
            feats[i, 7] = 1.0
        p_logits = active_model.predict_logits(feats, adj_in, adj_out).reshape(-1)
        q_logits = cand_model.predict_logits(feats, adj_in, adj_out).reshape(-1)
        p_exp = np.exp(p_logits - np.max(p_logits))
        q_exp = np.exp(q_logits - np.max(q_logits))
        p_prob = p_exp / np.sum(p_exp)
        q_prob = q_exp / np.sum(q_exp)
        kl = float(np.sum(p_prob * np.log((p_prob + 1e-8) / (q_prob + 1e-8))))
        kl_values.append(max(0.0, kl))

    measured_kl = round(float(np.mean(kl_values)), 6)
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


def _gelu_grad(x: np.ndarray) -> np.ndarray:
    """Derivative of tanh-approximated GELU used in VerifiedGnnPpoCheckpoint."""
    c = float(np.sqrt(2.0 / np.pi))
    u = c * (x + 0.044715 * (x**3))
    th = np.tanh(u)
    du = c * (1.0 + 3.0 * 0.044715 * (x**2))
    return (0.5 * (1.0 + th) + 0.5 * x * (1.0 - th**2) * du).astype(np.float32)


def _forward_with_cache(
    weights: dict[str, np.ndarray],
    node_features: np.ndarray,
    adj_in: np.ndarray,
    adj_out: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Run VerifiedGnnPpoCheckpoint forward pass returning (logits, actor_in, a1_pre, a1)."""
    ckpt = VerifiedGnnPpoCheckpoint("train", weights)
    h = ckpt._linear(node_features.astype(np.float32), "input_proj")
    h = 0.5 * h * (1.0 + np.tanh(np.sqrt(2.0 / np.pi) * (h + 0.044715 * (h**3))))
    for idx in range(3):
        p = f"layers__{idx}"
        msg = (
            ckpt._linear(h, f"{p}__w_self", has_bias=True)
            + ckpt._linear(adj_in @ h, f"{p}__w_prereq", has_bias=False)
            + ckpt._linear(adj_out @ h, f"{p}__w_dep", has_bias=False)
        )
        gelu_msg = 0.5 * msg * (1.0 + np.tanh(np.sqrt(2.0 / np.pi) * (msg + 0.044715 * (msg**3))))
        x_in = h + gelu_msg
        mean = x_in.mean(axis=-1, keepdims=True)
        var = x_in.var(axis=-1, keepdims=True)
        h = ((x_in - mean) / np.sqrt(var + 1e-5)) * weights[f"{p}__norm__weight"] + weights[f"{p}__norm__bias"]

    g = h.mean(axis=0, keepdims=True)
    g_exp = np.repeat(g, h.shape[0], axis=0)
    actor_in = np.concatenate([h, g_exp], axis=-1)
    a1_pre = actor_in @ weights["actor_head__0__weight"].T + weights["actor_head__0__bias"]
    a1 = (0.5 * a1_pre * (1.0 + np.tanh(np.sqrt(2.0 / np.pi) * (a1_pre + 0.044715 * (a1_pre**3))))).astype(np.float32)
    logits = a1 @ weights["actor_head__2__weight"].T + weights["actor_head__2__bias"]
    return logits.astype(np.float32), actor_in.astype(np.float32), a1_pre.astype(np.float32), a1


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
    mode_to_idx = {"Learn_New": 0, "Deep_Probe": 1, "Code_Practice": 2, "Spaced_Review": 3}
    topo_cache: dict[str, tuple[list[str], np.ndarray, np.ndarray, np.ndarray, list[int], list[list[int]]]] = {}
    transitions: list[tuple[np.ndarray, np.ndarray, np.ndarray, int, float]] = []
    last_edge_index = np.zeros((2, 0), dtype=np.int64)
    last_node_order: list[str] = []

    for s in samples:
        is_dict = isinstance(s, dict)
        s_domain = str(s.get("domain_slug") if is_dict else getattr(s, "domain_slug", "") or domain_slug or "")
        if not s_domain:
            continue
        if s_domain not in topo_cache:
            topo_cache[s_domain] = _load_domain_topology_for_rl(db, s_domain)
        node_order, adj_in, adj_out, edge_index, _tiers, _prereqs = topo_cache[s_domain]
        last_edge_index = edge_index
        last_node_order = node_order

        obs_before_raw = s.get("obs_before_json") if is_dict else getattr(s, "obs_before_json", None)
        obs_after_raw = s.get("obs_after_json") if is_dict else getattr(s, "obs_after_json", None)
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
            else (obs_before_raw.get("action_node_idx") if isinstance(obs_before_raw, dict) else None)
        )
        if raw_node_idx is not None and int(raw_node_idx) != expected_idx:
            continue
        node_idx = expected_idx

        action_mode = str(s.get("action_mode") if is_dict else getattr(s, "action_mode", ""))
        if action_mode not in mode_to_idx:
            continue
        mode_idx = mode_to_idx[action_mode]

        reward = float(s.get("reward") if is_dict else getattr(s, "reward", float("nan")))
        if not math.isfinite(reward):
            continue
        transitions.append((feats_before, adj_in, adj_out, node_idx * 4 + mode_idx, reward))

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
    """Derive a candidate checkpoint via PPO clipped objective on valid transitions and 200-scenario eval."""
    env_cand_dir = os.environ.get("PLUMORA_CANDIDATES_DIR", "").strip()
    candidates_dir = Path(env_cand_dir) if env_cand_dir else (base_ckpt_path.parent / "candidates")
    candidates_dir.mkdir(parents=True, exist_ok=True)
    cand_file = candidates_dir / f"{version_tag}.zip"

    with zipfile.ZipFile(base_ckpt_path, "r") as zf:
        raw_npz = zf.read("weights.npz")
    npz = np.load(io.BytesIO(raw_npz))
    base_weights: dict[str, np.ndarray] = {k: npz[k].copy() for k in npz.files}
    cand_weights: dict[str, np.ndarray] = {k: v.astype(np.float32).copy() for k, v in base_weights.items()}

    base_model = VerifiedGnnPpoCheckpoint("base", base_weights)

    valid_transition_count = 0
    if samples:
        built = _build_transition_tensors(db, list(samples))
        raw_transitions: list[tuple[np.ndarray, np.ndarray, np.ndarray, int, float]] = built["transitions"]
        valid_transition_count = len(raw_transitions)
        rewards = np.array([t[4] for t in raw_transitions], dtype=np.float32)
        advs = (rewards - float(np.mean(rewards))) / (float(np.std(rewards)) + 1e-6)
        advs = np.clip(advs, -2.0, 2.0)

        transitions: list[tuple[np.ndarray, np.ndarray, np.ndarray, int, float, float]] = []
        for (feats, a_in, a_out, act_idx, _rew), adv in zip(raw_transitions, advs, strict=True):
            old_logits = base_model.predict_logits(feats, a_in, a_out).reshape(-1)
            old_exp = np.exp(old_logits - np.max(old_logits))
            old_probs = old_exp / np.sum(old_exp)
            transitions.append((feats, a_in, a_out, act_idx, float(old_probs[act_idx]), float(adv)))

        clip_eps = 0.2
        lr = 0.005
        for _epoch in range(4):
            g_w2 = np.zeros_like(cand_weights["actor_head__2__weight"])
            g_b2 = np.zeros_like(cand_weights["actor_head__2__bias"])
            g_w0 = np.zeros_like(cand_weights["actor_head__0__weight"])
            g_b0 = np.zeros_like(cand_weights["actor_head__0__bias"])

            for feats, a_in, a_out, act_idx, old_p, adv in transitions:
                logits, actor_in, a1_pre, a1 = _forward_with_cache(cand_weights, feats, a_in, a_out)
                flat_logits = logits.reshape(-1)
                exp_l = np.exp(flat_logits - np.max(flat_logits))
                probs = exp_l / np.sum(exp_l)
                new_p = float(probs[act_idx])
                ratio = new_p / (old_p + 1e-8)

                if (adv >= 0.0 and ratio > 1.0 + clip_eps) or (adv < 0.0 and ratio < 1.0 - clip_eps):
                    continue

                one_hot = np.zeros_like(probs)
                one_hot[act_idx] = 1.0
                d_flat = (ratio * adv) * (one_hot - probs)
                d_logits = d_flat.reshape(logits.shape)

                g_w2 += d_logits.T @ a1
                g_b2 += d_logits.sum(axis=0)
                d_a1 = d_logits @ cand_weights["actor_head__2__weight"]
                d_a1_pre = d_a1 * _gelu_grad(a1_pre)
                g_w0 += d_a1_pre.T @ actor_in
                g_b0 += d_a1_pre.sum(axis=0)

            scale = lr / max(1, len(transitions))
            cand_weights["actor_head__2__weight"] += np.clip(scale * g_w2, -0.02, 0.02)
            cand_weights["actor_head__2__bias"] += np.clip(scale * g_b2, -0.02, 0.02)
            cand_weights["actor_head__0__weight"] += np.clip(scale * g_w0, -0.02, 0.02)
            cand_weights["actor_head__0__bias"] += np.clip(scale * g_b0, -0.02, 0.02)

    buf = io.BytesIO()
    np.savez(buf, **cand_weights)  # type: ignore[arg-type]
    meta = {
        "version_tag": version_tag,
        "parent_checkpoint": base_ckpt_path.name,
        "mean_buffer_reward": round(mean_buf_reward, 4),
        "buffer_samples": valid_transition_count,
        "ppo_epochs": 4,
        "clip_eps": 0.2,
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

    passed_gate = (
        kl_div <= payload.kl_target_max
        and invalid_unmasked < 0.05
        and masked_violation == 0.0
        and reward_ratio >= 0.98
    )
    verdict = "PASSED" if passed_gate else "BLOCKED"

    cand = ModelRegistryModel(
        id=cand_id,
        version_tag=version_tag,
        checkpoint_path=cand_path,
        checkpoint_sha256=cand_sha,
        kl_divergence=kl_div,
        gate_verdict=verdict,
        is_active=False,
        eval_metrics_json={
            "eval_episodes": eval_report["eval_episodes"],
            "domains_evaluated": eval_report["domains_evaluated"],
            "candidate_mean_reward": eval_report["candidate_mean_reward"],
            "active_mean_reward": eval_report["active_mean_reward"],
            "reward_delta": eval_report["reward_delta"],
            "invalid_action_rate_unmasked": invalid_unmasked,
            "masked_violation_rate": masked_violation,
            "mean_reward_ratio_vs_prod": reward_ratio,
            "eval_source": "checkpoint_disk_eval_200",
        },
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


def activate_candidate_model(db: Session, model_id: uuid.UUID) -> dict[str, Any]:
    """Activate a PASSED candidate model after verifying its checkpoint artifact & SHA-256."""
    t0 = time.monotonic()
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
    prev_id = str(prev.id) if prev else None
    if prev is not None:
        prev.is_active = False
        db.flush()

    cand.is_active = True
    cand.activated_at = datetime.now(UTC)
    if prev_id:
        cand.eval_metrics_json = {
            **dict(cand.eval_metrics_json or {}),
            "previous_active_model_id": prev_id,
        }
    db.commit()
    from app.modules.recommendation.service_v2 import invalidate_active_model_cache

    invalidate_active_model_cache()

    latency_ms = max(1, int((time.monotonic() - t0) * 1000))
    return {
        "active_model_id": str(cand.id),
        "previous_model_id": prev_id,
        "active_checkpoint_sha256": cand.checkpoint_sha256,
        "switched_at": cand.activated_at.isoformat(),
        "switch_latency_ms": latency_ms,
    }


def rollback_active_model(db: Session) -> dict[str, Any]:
    """1-Click Rollback (< 2000ms) to the actual previously active PASSED checkpoint."""
    t0 = time.monotonic()
    _ensure_prod_model_seeded(db)
    curr = db.scalars(
        select(ModelRegistryModel).where(ModelRegistryModel.is_active.is_(True)).with_for_update()
    ).first()

    target: ModelRegistryModel | None = None
    if curr is not None and isinstance(curr.eval_metrics_json, dict):
        prev_ptr = curr.eval_metrics_json.get("previous_active_model_id")
        if prev_ptr:
            try:
                candidate_prev = db.get(ModelRegistryModel, uuid.UUID(str(prev_ptr)))
                if candidate_prev is not None and candidate_prev.gate_verdict == "PASSED" and candidate_prev.id != curr.id:
                    target = candidate_prev
            except ValueError:
                target = None

    if target is None:
        # Fallback: most recently activated PASSED model excluding current (never pick unactivated candidates)
        stmt = (
            select(ModelRegistryModel)
            .where(
                ModelRegistryModel.gate_verdict == "PASSED",
                ModelRegistryModel.activated_at.is_not(None),
            )
            .order_by(ModelRegistryModel.activated_at.desc())
        )
        for m in db.scalars(stmt).all():
            if curr is None or m.id != curr.id:
                target = m
                break

    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "NO_ROLLBACK_TARGET", "message": "No previously active safe rollback target found."},
        )
    _verify_checkpoint_artifact(target.checkpoint_path, target.checkpoint_sha256)

    prev_id = str(curr.id) if curr else None
    if curr is not None:
        curr.is_active = False
        db.flush()
    target.is_active = True
    target.activated_at = datetime.now(UTC)
    db.commit()
    from app.modules.recommendation.service_v2 import invalidate_active_model_cache

    invalidate_active_model_cache()

    latency_ms = max(1, int((time.monotonic() - t0) * 1000))
    return {
        "active_model_id": str(target.id),
        "previous_model_id": prev_id,
        "active_checkpoint_sha256": target.checkpoint_sha256,
        "switched_at": target.activated_at.isoformat(),
        "switch_latency_ms": latency_ms,
    }


def _probe_http_health(url: str) -> str:
    try:
        with urllib.request.urlopen(url, timeout=0.5) as resp:
            return "up" if 200 <= resp.status < 300 else "degraded"
    except (urllib.error.URLError, OSError, ValueError):
        return "down"


def get_system_health_status(db: Session) -> dict[str, Any]:
    """Return real probed status of PostgreSQL, Redis, RL Checkpoint, and 4 services."""
    pg_ok = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        pg_ok = False

    pending_outbox = -1
    if assessment_service_url():
        ext_pending = fetch_outbox_pending_count_internal()
        pending_outbox = ext_pending if ext_pending is not None else -1
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
        except SQLAlchemyError:
            db.rollback()
            ext_pending = fetch_outbox_pending_count_internal()
            pending_outbox = ext_pending if ext_pending is not None else -1

    schemas_isolated = False
    bind = db.get_bind()
    if bind is not None and bind.dialect.name == "postgresql":
        rows = db.execute(
            text(
                "SELECT schema_name FROM information_schema.schemata "
                "WHERE schema_name IN ('auth_svc', 'content_svc', 'assess_svc', 'rec_ai_svc')"
            )
        ).scalars().all()
        public_app_tables = db.execute(
            text(
                "SELECT count(*) FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name IN ('users', 'domains', 'concepts', 'assessment_sessions', 'model_registry')"
            )
        ).scalar()
        svc_roles = db.execute(
            text(
                "SELECT count(*) FROM pg_roles "
                "WHERE rolname IN ('auth_svc_user', 'content_svc_user', 'assess_svc_user', 'rec_ai_svc_user')"
            )
        ).scalar()
        priv_ok = db.execute(
            text(
                "SELECT NOT has_schema_privilege('assess_svc_user', 'content_svc', 'USAGE') "
                "AND NOT has_schema_privilege('rec_ai_svc_user', 'assess_svc', 'USAGE')"
            )
        ).scalar()
        schemas_isolated = (
            len(set(rows)) == 4
            and int(public_app_tables or 0) == 0
            and int(svc_roles or 0) == 4
            and bool(priv_ok)
        )
    elif bind is not None and bind.dialect.name == "sqlite":
        schemas_isolated = True

    redis_ok = False
    cache_hit_rate = 0.0
    consumer_group_active = False
    redis_stream_pending = -1
    redis_lag_ms: float | None = None
    c2c_last_ms: float | None = None
    c2c_p95_ms: float | None = None
    c2c_samples = 0
    pending_age_ms: float | None = None
    try:
        client: redis.Redis = redis.Redis.from_url(
            settings.redis_url,
            socket_connect_timeout=0.5,
            socket_timeout=0.5,
            decode_responses=True,
        )
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
                groups = client.xinfo_groups("plumora:competency_events")
                worker_alive = bool(client.exists(WORKER_HEARTBEAT_KEY))
                if groups and worker_alive:
                    consumer_group_active = True
                    redis_stream_pending = sum(
                        int(g.get("pending", 0) or 0) + int(g.get("lag", 0) or 0)
                        for g in groups
                    )
                    pending_summary = client.xpending("plumora:competency_events", "rec_ai_cg")
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
        client.close()
    except redis.RedisError:
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
        "services": services_status,
        "postgres_connected": pg_ok,
        "rl_checkpoint_verified": ckpt_ok,
        "schemas_isolated": schemas_isolated,
        "outbox_pending_count": pending_outbox,
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
