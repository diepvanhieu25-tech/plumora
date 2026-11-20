"""GNN-PPO Serving + Policy Guardrail Decorator + Fallback Service (PL3-GUARD-01)."""

from __future__ import annotations

import uuid

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import ModelRegistryModel, UserModel
from app.db.redis_store import get_or_cache_graph_snapshot
from app.modules.assessment.schemas_v2 import (
    V2RecommendationResponse,
    V2RecommendedAction,
)
from app.modules.assessment.service_v2 import recommend_v2_next_step
from app.modules.content.kg_service import get_domain_roadmap_for_user
from app.modules.content.schemas_v2 import DomainRoadmapNode
from app.modules.recommendation.gnn_loader import (
    VerifiedGnnPpoCheckpoint,
    load_verified_gnn_checkpoint,
)

MODE_NAMES: tuple[str, str, str, str] = (
    "Learn_New",
    "Deep_Probe",
    "Code_Practice",
    "Spaced_Review",
)

MODE_REASONS_VI: dict[str, str] = {
    "Learn_New": "GNN-PPO đề xuất học nền tảng khái niệm đã mở khóa trên đồ thị DAG.",
    "Deep_Probe": "GNN-PPO đề xuất đào sâu 5 tầng để nâng mức hiểu lên Hiểu bản chất / Làm chủ.",
    "Code_Practice": "GNN-PPO đề xuất thực hành Code Sandbox để củng cố kỹ năng áp dụng.",
    "Spaced_Review": "Cảnh báo trí nhớ Ebbinghaus < 60%: Policy Guardrail ưu tiên ôn tập ngay.",
}


def _build_graph_tensors(
    nodes: list[DomainRoadmapNode],
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    n = len(nodes)
    slug_to_idx = {node.slug: idx for idx, node in enumerate(nodes)}
    feats = np.zeros((n, 8), dtype=np.float32)
    a_in = np.zeros((n, n), dtype=np.float32)
    a_out = np.zeros((n, n), dtype=np.float32)

    for idx, node in enumerate(nodes):
        feats[idx, 0] = float(node.depth_level_norm)
        feats[idx, 1] = float(node.confidence)
        feats[idx, 2] = float(node.retention_ebbinghaus)
        feats[idx, 3] = 1.0 if node.is_eligible else 0.0
        feats[idx, 4] = 1.0 if node.needs_review else 0.0
        feats[idx, 5] = float(node.tier) / 4.0
        feats[idx, 6] = float(node.code_practice_score)
        feats[idx, 7] = 1.0
        for p_slug in node.prerequisites:
            if p_slug in slug_to_idx:
                p_idx = slug_to_idx[p_slug]
                a_in[idx, p_idx] = 1.0
                a_out[p_idx, idx] = 1.0

    deg_in = np.where(a_in.sum(axis=1, keepdims=True) > 0, a_in.sum(axis=1, keepdims=True), 1.0)
    deg_out = np.where(a_out.sum(axis=1, keepdims=True) > 0, a_out.sum(axis=1, keepdims=True), 1.0)
    return feats, (a_in / deg_in).astype(np.float32), (a_out / deg_out).astype(np.float32)


def recommend_gnn_ppo_v2(
    db: Session,
    user_id: uuid.UUID,
    domain_slug: str,
    *,
    checkpoint_path_override: str | None = None,
    manifest_path_override: str | None = None,
) -> V2RecommendationResponse:
    """Serve GNN-PPO with Policy Guardrail (0% masked DAG violation + Ebbinghaus review priority)."""
    roadmap = get_domain_roadmap_for_user(db, user_id, domain_slug, 0.0)
    nodes = roadmap.nodes
    if not nodes:
        return V2RecommendationResponse(
            domain_slug=domain_slug,
            status="completed",
            recommended_action=None,
            policy_source="completed",
            state_source="postgres_fallback",
            guardrail_applied=False,
            retention_alert=False,
            checkpoint_sha256="",
            node_features_snapshot=[],
        )

    feats, adj_in, adj_out = _build_graph_tensors(nodes)
    computed_snapshot = [[round(float(val), 4) for val in row] for row in feats.tolist()]
    user_row = db.get(UserModel, user_id)
    state_version = user_row.state_version if user_row is not None else 1
    snapshot, state_source = get_or_cache_graph_snapshot(
        user_id=user_id,
        domain_slug=domain_slug,
        state_version=state_version,
        computed_snapshot=computed_snapshot,
    )

    # Completed check
    if all(n.depth_level_norm >= 0.75 and not n.needs_review for n in nodes):
        return V2RecommendationResponse(
            domain_slug=domain_slug,
            status="completed",
            recommended_action=None,
            policy_source="completed",
            state_source=state_source,
            guardrail_applied=False,
            retention_alert=False,
            checkpoint_sha256="",
            node_features_snapshot=snapshot,
        )

    ckpt: VerifiedGnnPpoCheckpoint | None = None
    if checkpoint_path_override is not None or manifest_path_override is not None:
        ckpt = load_verified_gnn_checkpoint(
            checkpoint_path_override=checkpoint_path_override,
            manifest_path_override=manifest_path_override,
        )
    else:
        active_model = db.scalars(
            select(ModelRegistryModel)
            .where(ModelRegistryModel.is_active.is_(True))
            .order_by(ModelRegistryModel.activated_at.desc(), ModelRegistryModel.created_at.desc())
            .limit(1)
        ).first()
        if active_model is not None:
            ckpt = load_verified_gnn_checkpoint(
                checkpoint_path_override=active_model.checkpoint_path,
                expected_sha256_override=active_model.checkpoint_sha256,
            )
        if ckpt is None:
            ckpt = load_verified_gnn_checkpoint()

    if ckpt is None:
        assert user_row is not None
        fallback = recommend_v2_next_step(db, user_row, domain_slug)
        fallback.state_source = state_source
        fallback.node_features_snapshot = snapshot
        return fallback

    # 1. Policy Guardrail Priority: Ebbinghaus Needs Review (R(t) < 0.60)
    review_nodes = [n for n in nodes if n.needs_review]
    if review_nodes:
        target = min(review_nodes, key=lambda n: n.retention_ebbinghaus)
        return V2RecommendationResponse(
            domain_slug=domain_slug,
            status="active",
            recommended_action=V2RecommendedAction(
                concept_slug=target.slug,
                title=target.title,
                tier=target.tier,
                learning_mode="Spaced_Review",
                reason_vi=MODE_REASONS_VI["Spaced_Review"],
            ),
            policy_source="gnn_ppo_masked",
            state_source=state_source,
            guardrail_applied=True,
            retention_alert=True,
            checkpoint_sha256=ckpt.sha256,
            node_features_snapshot=snapshot,
        )

    # 2. GNN-PPO Forward Pass + DAG Eligibility Guardrail
    logits = ckpt.predict_logits(feats, adj_in, adj_out)  # (N, 4)
    raw_idx = int(np.argmax(logits.reshape(-1)))
    raw_v = raw_idx // 4
    raw_m = raw_idx % 4

    raw_node = nodes[raw_v]
    if raw_node.is_eligible and raw_node.depth_level_norm < 1.0 and raw_m != 3:
        selected_node = raw_node
        selected_mode = MODE_NAMES[raw_m]
        policy_source = "gnn_ppo"
        guardrail_applied = False
    else:
        mask = np.zeros_like(logits, dtype=bool)
        for i, n in enumerate(nodes):
            if n.is_eligible and n.depth_level_norm < 1.0:
                mask[i, 0:3] = True
        if not np.any(mask):
            for i, n in enumerate(nodes):
                if n.is_eligible:
                    mask[i, 0:3] = True
        masked_logits = np.where(mask, logits, -1e9)
        sel_idx = int(np.argmax(masked_logits.reshape(-1)))
        selected_node = nodes[sel_idx // 4]
        selected_mode = MODE_NAMES[sel_idx % 4]
        policy_source = "gnn_ppo_masked"
        guardrail_applied = True

    return V2RecommendationResponse(
        domain_slug=domain_slug,
        status="active",
        recommended_action=V2RecommendedAction(
            concept_slug=selected_node.slug,
            title=selected_node.title,
            tier=selected_node.tier,
            learning_mode=selected_mode,
            reason_vi=MODE_REASONS_VI[selected_mode],
        ),
        policy_source=policy_source,
        state_source=state_source,
        guardrail_applied=guardrail_applied,
        retention_alert=False,
        checkpoint_sha256=ckpt.sha256,
        node_features_snapshot=snapshot,
    )
