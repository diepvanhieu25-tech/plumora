"""Read-only Admin Online RL Buffer Summary & Policy Inspector."""

from __future__ import annotations

import logging
import uuid
from pathlib import Path
from typing import Any

import numpy as np
from fastapi import HTTPException, status
from plumora_rl.domain import (
    MODE_NAMES,
    PolicyGuardrailStrategy,
)
from plumora_rl.inference import NumpyGnnPredictor
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import REPO_ROOT, settings
from app.db.models import (
    ModelRegistryModel,
    RlExperienceBufferModel,
)
from app.modules.recommendation.admin_schemas import (
    PolicyInspectRequest,
)
from app.modules.recommendation.gnn_loader import load_verified_gnn_checkpoint
from app.modules.recommendation.service_v2 import (
    build_domain_graph_observation,
)
from app.modules.recommendation.services.model_registry import _ensure_prod_model_seeded
from app.shared.contracts.adapters import (
    get_competency_reader_port,
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



