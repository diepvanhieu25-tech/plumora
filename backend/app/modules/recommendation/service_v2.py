"""GNN-PPO Serving + Policy Guardrail Decorator + Fallback Service (PL3-GUARD-01)."""

from __future__ import annotations

import time
import uuid
from datetime import datetime

import numpy as np
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.models import ModelRegistryModel, UserModel
from app.db.redis_store import get_or_cache_graph_snapshot
from app.modules.assessment.ebbinghaus import (
    INITIAL_STABILITY_DAYS,
    compute_elapsed_days,
    compute_retention,
    is_review_needed,
)
from app.modules.assessment.schemas_v2 import (
    V2RecommendationResponse,
    V2RecommendedAction,
)
from app.modules.assessment.service_v2 import recommend_v2_next_step
from app.modules.content.kg_service import get_domain_roadmap_for_user
from app.modules.content.schemas_v2 import DomainRoadmapNode
from app.modules.events.internal_client import (
    assessment_service_url,
    content_service_url,
    fetch_domain_bundle_internal,
    fetch_user_competencies_internal,
)
from app.modules.recommendation.gnn_loader import (
    VerifiedGnnPpoCheckpoint,
    load_verified_gnn_checkpoint,
)
from app.modules.recommendation.guardrail import select_guarded_action

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


def _build_nodes_via_internal_services(
    user_id: uuid.UUID,
    domain_slug: str,
) -> list[DomainRoadmapNode] | None:
    bundle = fetch_domain_bundle_internal(domain_slug)
    comp_items = fetch_user_competencies_internal(user_id)
    if bundle is None or comp_items is None:
        return None
    comp_map = {str(c["concept_slug"]): c for c in comp_items}
    out: list[DomainRoadmapNode] = []
    for n in bundle.get("nodes", []):
        slug = str(n["concept_slug"])
        prereqs = [str(p) for p in n.get("prerequisites_json", [])]
        c = comp_map.get(slug)
        depth_norm = float(c["depth_level_norm"]) if c else 0.0
        conf = float(c["confidence"]) if c else 0.0
        stab = float(c["stability_s"]) if c else INITIAL_STABILITY_DAYS
        code_score = float(c.get("code_practice_score", 0.0)) if c else 0.0
        lp_raw = c.get("last_practiced_at") if c else None
        lp_dt = datetime.fromisoformat(str(lp_raw)) if lp_raw else None
        if depth_norm >= 0.50 and lp_dt is not None:
            dt = compute_elapsed_days(lp_dt, 0.0)
            ret = compute_retention(dt, stab)
            needs_rev = is_review_needed(depth_norm, ret)
        else:
            ret = 1.0
            needs_rev = False
        eligible = all(
            (comp_map.get(p) is not None and float(comp_map[p]["depth_level_norm"]) >= 0.75)
            for p in prereqs
        )
        out.append(
            DomainRoadmapNode(
                slug=slug,
                node_idx=int(n["node_idx"]),
                title=str(n["title"]),
                tier=int(n["tier"]),
                is_shared=bool(n["is_shared"]),
                prerequisites=prereqs,
                depth_level_norm=round(depth_norm, 4),
                depth_label=str(c["depth_label"]) if c else "Untested / Below Surface",
                confidence=round(conf, 4),
                stability_s=round(stab, 4),
                retention_ebbinghaus=round(ret, 4),
                needs_review=needs_rev,
                is_eligible=eligible,
                code_practice_score=round(code_score, 4),
                lesson_markdown="",
            )
        )
    return out


_ACTIVE_MODEL_CACHE: tuple[float, str, str] | None = None


def invalidate_active_model_cache() -> None:
    global _ACTIVE_MODEL_CACHE
    _ACTIVE_MODEL_CACHE = None


def _get_cached_active_model_meta(db: Session) -> tuple[str, str] | None:
    global _ACTIVE_MODEL_CACHE
    now = time.monotonic()
    if _ACTIVE_MODEL_CACHE is not None and (now - _ACTIVE_MODEL_CACHE[0]) < 2.0:
        return _ACTIVE_MODEL_CACHE[1], _ACTIVE_MODEL_CACHE[2]
    active_model = db.scalars(
        select(ModelRegistryModel)
        .where(ModelRegistryModel.is_active.is_(True))
        .order_by(ModelRegistryModel.activated_at.desc(), ModelRegistryModel.created_at.desc())
        .limit(1)
    ).first()
    if active_model is None:
        return None
    _ACTIVE_MODEL_CACHE = (now, str(active_model.checkpoint_path), str(active_model.checkpoint_sha256))
    return _ACTIVE_MODEL_CACHE[1], _ACTIVE_MODEL_CACHE[2]


def recommend_gnn_ppo_v2(
    db: Session,
    user_id: uuid.UUID,
    domain_slug: str,
    *,
    checkpoint_path_override: str | None = None,
    manifest_path_override: str | None = None,
) -> V2RecommendationResponse:
    """Serve GNN-PPO with Policy Guardrail (0% masked DAG violation + Ebbinghaus review priority)."""
    nodes: list[DomainRoadmapNode] | None = None
    if content_service_url() and assessment_service_url():
        nodes = _build_nodes_via_internal_services(user_id, domain_slug)
    if nodes is None:
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
    if content_service_url() and assessment_service_url():
        user_row = None
    else:
        try:
            user_row = db.get(UserModel, user_id)
        except SQLAlchemyError:
            db.rollback()
            user_row = None
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
        active_meta = _get_cached_active_model_meta(db)
        if active_meta is not None:
            ckpt = load_verified_gnn_checkpoint(
                checkpoint_path_override=active_meta[0],
                expected_sha256_override=active_meta[1],
            )
        if ckpt is None:
            ckpt = load_verified_gnn_checkpoint()

    if ckpt is None:
        if content_service_url() and assessment_service_url():
            eligible_nodes = [n for n in nodes if n.is_eligible and n.depth_level_norm < 1.0]
            target_n = eligible_nodes[0] if eligible_nodes else nodes[0]
            return V2RecommendationResponse(
                domain_slug=domain_slug,
                status="active",
                recommended_action=V2RecommendedAction(
                    concept_slug=target_n.slug,
                    title=target_n.title,
                    tier=target_n.tier,
                    learning_mode="Learn_New",
                    reason_vi=MODE_REASONS_VI["Learn_New"],
                ),
                policy_source="fallback_rule",
                state_source=state_source,
                guardrail_applied=True,
                retention_alert=False,
                checkpoint_sha256="",
                node_features_snapshot=snapshot,
            )
        fallback_user = user_row or UserModel(
            id=user_id,
            username="learner",
            display_name="Learner",
            password_hash="",
            role="learner",
            state_version=1,
        )
        fallback = recommend_v2_next_step(db, fallback_user, domain_slug)
        fallback.state_source = state_source
        fallback.node_features_snapshot = snapshot
        return fallback

    # 1 & 2. Shared Policy Guardrail + GNN-PPO Forward Pass (C03)
    logits = ckpt.predict_logits(feats, adj_in, adj_out)  # (N, 4)
    eligible_arr = np.array([n.is_eligible for n in nodes], dtype=bool)
    needs_review_arr = np.array([n.needs_review for n in nodes], dtype=bool)
    depth_arr = np.array([n.depth_level_norm for n in nodes], dtype=np.float32)
    ret_arr = np.array([n.retention_ebbinghaus for n in nodes], dtype=np.float32)

    sel_v, sel_m, policy_source, guardrail_applied = select_guarded_action(
        logits,
        eligible=eligible_arr,
        needs_review=needs_review_arr,
        depth=depth_arr,
        retention=ret_arr,
    )
    selected_node = nodes[sel_v]
    selected_mode = MODE_NAMES[sel_m]
    retention_alert = bool(np.any(needs_review_arr))

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
        retention_alert=retention_alert,
        checkpoint_sha256=ckpt.sha256,
        node_features_snapshot=snapshot,
    )
