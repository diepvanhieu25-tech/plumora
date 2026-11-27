"""Safe Micro-batch Online RL transition builder & KL-constrained trainer."""

from __future__ import annotations

import hashlib
import io
import json
import logging
import math
import os
import uuid
import zipfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
from fastapi import HTTPException, status
from plumora_rl.domain import (
    MODE_NAME_TO_ENUM,
    NodeFeatureIdx,
    PolicyGuardrailStrategy,
)
from plumora_rl.inference import ActorTransition, NumpyGnnPredictor
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import REPO_ROOT, settings
from app.db.models import (
    ModelRegistryModel,
    OnlineEvalRunModel,
    RlExperienceBufferModel,
)
from app.modules.recommendation.admin_schemas import (
    MicroBatchTrainRequest,
)
from app.modules.recommendation.services.model_registry import _ensure_prod_model_seeded
from app.modules.recommendation.services.online_rl_eval import (
    _evaluate_candidate_against_active,
    _load_domain_topology_for_rl,
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


