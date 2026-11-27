"""Shared competency, Ebbinghaus retention, and observation helpers for Assessment services."""


from __future__ import annotations

import logging
import uuid
from typing import Any

import redis
from fastapi import HTTPException, status
from plumora_rl.domain import (
    EbbinghausMemoryModel,
)
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import (
    UserModel,
    UserNodeCompetencyModel,
)
from app.db.redis_pool import get_redis_client
from app.modules.assessment.graders_registry import TaskGraderRegistry
from app.modules.assessment.rubric_grader import (
    CircuitBreakerRubricService,
    DeterministicRubricGrader,
    LlmRubricGraderAdapter,
)
from app.modules.assessment.sandbox_worker import (
    IsolatedSandboxWorkerAdapter,
)
from app.modules.assessment.schemas_v2 import (
    DepthStepItem,
    UpdatedCompetencyOut,
)
from app.modules.auth.security import _can_query_users_table
from app.shared.contracts.dtos import ConceptNodeDTO, DepthQuestionDTO
from app.shared.contracts.ports import ContentCatalogPort
from app.shared.ebbinghaus import (
    INITIAL_STABILITY_DAYS,
    compute_elapsed_days,
    compute_next_review_due_at,
    compute_retention,
    is_review_needed,
)

_RUBRIC_SERVICE = CircuitBreakerRubricService(
    primary=LlmRubricGraderAdapter(),
    fallback=DeterministicRubricGrader(),
    failure_threshold=2,
)
_GRADER_REGISTRY = TaskGraderRegistry(_RUBRIC_SERVICE)
_SANDBOX_WORKER = IsolatedSandboxWorkerAdapter()


logger = logging.getLogger(__name__)


def _bump_user_state_version_if_accessible(db: Session, user_id: uuid.UUID) -> None:
    """Increment auth_svc.users.state_version in monolith mode; zero-error no-op under schema isolation."""
    if not _can_query_users_table(db):
        return
    try:
        with db.begin_nested():
            user_row = db.get(UserModel, user_id)
            if user_row is not None:
                user_row.state_version += 1
    except SQLAlchemyError:
        pass


def _invalidate_user_competency_cache(user_id: uuid.UUID) -> None:
    """Immediately delete Redis plumora:raw_comp_state:{user_id}:* keys after competency COMMIT (REM-03)."""
    try:
        client = get_redis_client(settings.redis_url, decode_responses=True, socket_timeout=0.2)
        keys = [
            str(k)
            for k in client.scan_iter(match=f"plumora:raw_comp_state:{user_id}:*", count=50)
        ]
        if keys:
            client.delete(*keys)
    except (redis.RedisError, OSError) as exc:
        logger.warning("Failed to invalidate Redis competency cache for user %s: %s", user_id, exc)


def _get_or_create_competency(
    db: Session,
    user_id: uuid.UUID,
    concept_slug: str,
) -> UserNodeCompetencyModel:
    comp = db.get(UserNodeCompetencyModel, (user_id, concept_slug))
    if comp is None:
        comp = UserNodeCompetencyModel(
            user_id=user_id,
            concept_slug=concept_slug,
            depth_level_norm=0.0,
            peak_depth_level_norm=0.0,
            depth_label="Untested / Below Surface",
            confidence=0.0,
            stability_s=INITIAL_STABILITY_DAYS,
            last_practiced_at=None,
            playbook_completed_at=None,
            code_practice_score=0.0,
        )
        db.add(comp)
        db.flush()
    return comp


def _compute_real_retention(comp: UserNodeCompetencyModel) -> float:
    if (
        comp.last_practiced_at is not None
        and comp.depth_level_norm >= EbbinghausMemoryModel.MIN_DEPTH_FOR_RETENTION
    ):
        dt = compute_elapsed_days(comp.last_practiced_at, 0.0)
        return compute_retention(dt, comp.stability_s)
    return 1.0


def _build_competency_out(
    comp: UserNodeCompetencyModel,
    *,
    stability_before: float | None = None,
) -> UpdatedCompetencyOut:
    ret_now = _compute_real_retention(comp)
    next_due = compute_next_review_due_at(
        comp.last_practiced_at, comp.stability_s, comp.depth_level_norm
    )
    return UpdatedCompetencyOut(
        depth_level_norm=round(comp.depth_level_norm, 4),
        depth_label=comp.depth_label,
        confidence=round(comp.confidence, 4),
        stability_s=round(comp.stability_s, 4),
        stability_s_before=round(stability_before, 4) if stability_before is not None else None,
        stability_s_after=round(comp.stability_s, 4),
        retention_ebbinghaus=round(ret_now, 4),
        next_review_due_at=next_due,
    )


def _check_concept_eligible(
    db: Session,
    user_id: uuid.UUID,
    domain_slug: str | None,
    concept_slug: str,
    catalog: ContentCatalogPort,
) -> ConceptNodeDTO:
    node: ConceptNodeDTO | None = None
    if domain_slug:
        topo = catalog.get_domain_topology(domain_slug)
        if topo is not None:
            node = next((n for n in topo.nodes if n.concept_slug == concept_slug), None)
    if node is None:
        bundle = catalog.get_concept_bundle(concept_slug)
        if bundle is not None:
            node = bundle.node
    if node is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "CONCEPT_NOT_FOUND", "message": f"Concept '{concept_slug}' not found."},
        )

    if node.prerequisites:
        prereq_rows = db.scalars(
            select(UserNodeCompetencyModel).where(
                UserNodeCompetencyModel.user_id == user_id,
                UserNodeCompetencyModel.concept_slug.in_(node.prerequisites),
            )
        ).all()
        prereq_map = {r.concept_slug: r for r in prereq_rows}
        for prereq_slug in node.prerequisites:
            comp = prereq_map.get(prereq_slug)
            if comp is None or comp.depth_level_norm < 0.75:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error_code": "CONCEPT_LOCKED",
                        "message": f"Prerequisite '{prereq_slug}' must reach Deep Understanding (>= 0.75) first.",
                    },
                )
    return node


def _build_domain_obs_snapshot(
    db: Session,
    user_id: uuid.UUID,
    domain_slug: str | None,
    catalog: ContentCatalogPort,
    nodes: tuple[ConceptNodeDTO, ...] | None = None,
    *,
    target_concept_slug: str | None = None,
) -> dict[str, Any]:
    """Build structured domain observation snapshot (before/after) with real node_order & retention."""
    if not domain_slug:
        return {"domain_slug": "", "node_order": [], "action_node_idx": None, "nodes": []}
    if nodes is None:
        topo = catalog.get_domain_topology(domain_slug)
        domain_nodes = topo.nodes if topo is not None else ()
    else:
        domain_nodes = nodes
    if not domain_nodes:
        return {"domain_slug": domain_slug, "node_order": [], "action_node_idx": None, "nodes": []}

    slugs = [n.concept_slug for n in domain_nodes]
    comp_rows = db.scalars(
        select(UserNodeCompetencyModel).where(
            UserNodeCompetencyModel.user_id == user_id,
            UserNodeCompetencyModel.concept_slug.in_(slugs),
        )
    ).all()
    comp_map = {r.concept_slug: r for r in comp_rows}
    node_entries: list[dict[str, Any]] = []
    action_node_idx: int | None = None
    for idx, n in enumerate(domain_nodes):
        if target_concept_slug and n.concept_slug == target_concept_slug:
            action_node_idx = idx
        c = comp_map.get(n.concept_slug)
        depth = float(c.depth_level_norm) if c else 0.0
        conf = float(c.confidence) if c else 0.0
        ret = _compute_real_retention(c) if c is not None else 1.0
        needs_rev = 1.0 if (c is not None and is_review_needed(depth, ret)) else 0.0
        elig = (
            1.0
            if all(
                (comp_map.get(p) is not None and comp_map[p].depth_level_norm >= 0.75)
                for p in n.prerequisites
            )
            else 0.0
        )
        code_sc = float(c.code_practice_score) if c else 0.0
        feats = [
            round(depth, 4),
            round(conf, 4),
            round(ret, 4),
            elig,
            needs_rev,
            round(float(n.tier) / 4.0, 4),
            round(code_sc, 4),
            1.0,
        ]
        node_entries.append(
            {
                "concept_slug": n.concept_slug,
                "node_idx": idx,
                "mastery": round(depth, 4),
                "confidence": round(conf, 4),
                "retention": round(ret, 4),
                "eligible": elig,
                "needs_review": needs_rev > 0.5,
                "tier_norm": round(float(n.tier) / 4.0, 4),
                "code_score": round(code_sc, 4),
                "features": feats,
            }
        )
    return {
        "domain_slug": domain_slug,
        "node_order": slugs,
        "action_node_idx": action_node_idx,
        "nodes": node_entries,
    }


def _build_step_item(q: DepthQuestionDTO) -> DepthStepItem:
    rubric_summary: list[dict[str, Any]] | None = None
    if q.rubric is not None:
        rubric_summary = [
            {"name": c["name"], "weight": c["weight"]} for c in q.rubric.criteria_json
        ]
    return DepthStepItem(
        question_id=q.id,
        depth_tier=q.depth_tier,
        task_type=q.task_type,
        prompt=q.prompt,
        options=q.options_json,
        rubric_summary=rubric_summary,
    )


def _select_question_for_tier(
    questions: tuple[DepthQuestionDTO, ...],
    target_tier: int,
    seen_ids: set[str],
) -> DepthQuestionDTO | None:
    """Select an active question for target_tier, rotating away from seen_ids on retry/review."""
    tier_qs = [q for q in questions if q.is_active and q.depth_tier == target_tier]
    if not tier_qs:
        return None
    unseen = [q for q in tier_qs if str(q.id) not in seen_ids]
    return unseen[0] if unseen else tier_qs[0]


