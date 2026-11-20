"""Service layer for Multi-Domain Knowledge Graph, Cross-Domain Sync, and Ebbinghaus Retention."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import (
    AssessmentSessionModel,
    ConceptModel,
    DomainConceptMapModel,
    DomainModel,
    UserConceptMasteryModel,
    UserNodeCompetencyModel,
)
from app.modules.assessment.depth_state_machine import depth_label_for_norm
from app.modules.assessment.ebbinghaus import (
    INITIAL_STABILITY_DAYS,
    compute_elapsed_days,
    compute_retention,
    is_review_needed,
)
from app.modules.content.schemas_v2 import (
    DomainListItem,
    DomainRoadmapNode,
    DomainRoadmapResponse,
    DomainsListResponse,
    DomainUserSummary,
)
from app.modules.events.internal_client import (
    assessment_service_url,
    fetch_user_competencies_internal,
)


def sync_mvp_mastery_to_v2_competency(db: Session, user_id: uuid.UUID) -> None:
    """Sync existing MVP user_concept_mastery rows into user_node_competency (batch, anti-N+1)."""
    mvp_rows = db.execute(
        select(UserConceptMasteryModel, ConceptModel.slug)
        .join(ConceptModel, ConceptModel.action_id == UserConceptMasteryModel.concept_action_id)
        .where(UserConceptMasteryModel.user_id == user_id)
    ).all()

    positive_rows = [(m, slug) for m, slug in mvp_rows if m.mastery_score > 0.0]
    if not positive_rows:
        return

    slugs = [slug for _, slug in positive_rows]
    existing_rows = db.scalars(
        select(UserNodeCompetencyModel).where(
            UserNodeCompetencyModel.user_id == user_id,
            UserNodeCompetencyModel.concept_slug.in_(slugs),
        )
    ).all()
    existing_map = {r.concept_slug: r for r in existing_rows}

    changed = False
    for mastery_row, slug in positive_rows:
        comp = existing_map.get(slug)
        if comp is None:
            comp = UserNodeCompetencyModel(
                user_id=user_id,
                concept_slug=slug,
                depth_level_norm=mastery_row.mastery_score,
                peak_depth_level_norm=mastery_row.mastery_score,
                depth_label=depth_label_for_norm(mastery_row.mastery_score),
                confidence=0.85 if mastery_row.mastery_score >= 0.75 else 0.65,
                stability_s=INITIAL_STABILITY_DAYS,
                last_practiced_at=mastery_row.updated_at or datetime.now(UTC),
                code_practice_score=0.0,
            )
            db.add(comp)
            existing_map[slug] = comp
            changed = True
        elif mastery_row.mastery_score > comp.depth_level_norm:
            comp.depth_level_norm = mastery_row.mastery_score
            comp.peak_depth_level_norm = max(comp.peak_depth_level_norm, mastery_row.mastery_score)
            comp.depth_label = depth_label_for_norm(mastery_row.mastery_score)
            if comp.last_practiced_at is None:
                comp.last_practiced_at = mastery_row.updated_at or datetime.now(UTC)
            changed = True

    if changed:
        db.commit()


def _competency_from_dict(user_id: uuid.UUID, item: dict[str, Any]) -> UserNodeCompetencyModel:
    lp_raw = item.get("last_practiced_at")
    lp_dt = datetime.fromisoformat(str(lp_raw)) if lp_raw else None
    return UserNodeCompetencyModel(
        user_id=user_id,
        concept_slug=str(item["concept_slug"]),
        depth_level_norm=float(item["depth_level_norm"]),
        peak_depth_level_norm=float(item["peak_depth_level_norm"]),
        depth_label=str(item["depth_label"]),
        confidence=float(item["confidence"]),
        stability_s=float(item["stability_s"]),
        last_practiced_at=lp_dt,
        code_practice_score=float(item.get("code_practice_score", 0.0)),
    )


def _load_user_competencies(db: Session, user_id: uuid.UUID) -> dict[str, UserNodeCompetencyModel]:
    if assessment_service_url():
        items = fetch_user_competencies_internal(user_id)
        if items is not None:
            return {str(it["concept_slug"]): _competency_from_dict(user_id, it) for it in items}
    try:
        sync_mvp_mastery_to_v2_competency(db, user_id)
        rows = db.scalars(
            select(UserNodeCompetencyModel).where(UserNodeCompetencyModel.user_id == user_id)
        ).all()
        return {r.concept_slug: r for r in rows}
    except SQLAlchemyError:
        db.rollback()
        items = fetch_user_competencies_internal(user_id) or []
        return {str(it["concept_slug"]): _competency_from_dict(user_id, it) for it in items}


def list_domains_for_user(db: Session, user_id: uuid.UUID) -> DomainsListResponse:
    """List all published domains with cross-domain node counts and user summary (batch, anti-N+1)."""
    domains = db.scalars(
        select(DomainModel)
        .where(DomainModel.is_published.is_(True))
        .order_by(DomainModel.slug)
        .limit(100)
    ).all()
    comp_map = _load_user_competencies(db, user_id)

    if assessment_service_url():
        completed_placements = set()
    else:
        try:
            completed_placements = set(
                db.scalars(
                    select(AssessmentSessionModel.domain_slug)
                    .distinct()
                    .where(
                        AssessmentSessionModel.user_id == user_id,
                        AssessmentSessionModel.session_mode == "placement",
                        AssessmentSessionModel.status == "completed",
                    )
                    .limit(100)
                ).all()
            )
        except SQLAlchemyError:
            db.rollback()
            completed_placements = set()

    domain_slugs = [d.slug for d in domains]
    all_nodes = (
        db.scalars(
            select(DomainConceptMapModel)
            .where(DomainConceptMapModel.domain_slug.in_(domain_slugs))
            .order_by(DomainConceptMapModel.domain_slug, DomainConceptMapModel.node_idx)
        ).all()
        if domain_slugs
        else []
    )
    nodes_by_domain: dict[str, list[DomainConceptMapModel]] = {slug: [] for slug in domain_slugs}
    for node in all_nodes:
        nodes_by_domain.setdefault(node.domain_slug, []).append(node)

    items: list[DomainListItem] = []
    # Preferred display order: backend, frontend, devops, then alphabetical
    order_rank = {"backend": 0, "frontend": 1, "devops": 2}
    sorted_domains = sorted(domains, key=lambda d: (order_rank.get(d.slug, 99), d.slug))

    for d in sorted_domains:
        nodes = nodes_by_domain.get(d.slug, [])
        shared_count = sum(1 for n in nodes if n.is_shared)

        surface = 0
        applied = 0
        deep = 0
        mastery = 0
        needs_rev = 0
        for n in nodes:
            c = comp_map.get(n.concept_slug)
            if c is None or c.depth_level_norm < 0.25:
                continue
            if c.depth_level_norm >= 1.0:
                mastery += 1
            elif c.depth_level_norm >= 0.75:
                deep += 1
            elif c.depth_level_norm >= 0.50:
                applied += 1
            else:
                surface += 1

            dt = compute_elapsed_days(c.last_practiced_at, 0.0)
            ret = compute_retention(dt, c.stability_s)
            if is_review_needed(c.depth_level_norm, ret):
                needs_rev += 1

        items.append(
            DomainListItem(
                slug=d.slug,
                title=d.title,
                description=d.description,
                total_nodes=len(nodes),
                shared_nodes_count=shared_count,
                graph_version=d.graph_version,
                user_summary=DomainUserSummary(
                    surface_count=surface,
                    applied_count=applied,
                    deep_count=deep,
                    mastery_count=mastery,
                    needs_review_count=needs_rev,
                    placement_completed=d.slug in completed_placements,
                ),
            )
        )

    return DomainsListResponse(domains=items)


def get_domain_roadmap_for_user(
    db: Session,
    user_id: uuid.UUID,
    domain_slug: str,
    simulated_time_offset_days: float = 0.0,
) -> DomainRoadmapResponse:
    """Return full domain DAG roadmap with cross-domain competency & Ebbinghaus retention."""
    domain = db.get(DomainModel, domain_slug)
    if domain is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "DOMAIN_NOT_FOUND",
                "message": f"Domain '{domain_slug}' does not exist.",
            },
        )

    effective_offset = (
        simulated_time_offset_days
        if settings.app_env.lower() != "production"
        else 0.0
    )

    nodes = db.scalars(
        select(DomainConceptMapModel)
        .where(DomainConceptMapModel.domain_slug == domain_slug)
        .order_by(DomainConceptMapModel.node_idx)
    ).all()
    comp_map = _load_user_competencies(db, user_id)

    roadmap_nodes: list[DomainRoadmapNode] = []
    for n in nodes:
        c = comp_map.get(n.concept_slug)
        depth_norm = c.depth_level_norm if c is not None else 0.0
        depth_lbl = c.depth_label if c is not None else "Untested / Below Surface"
        confidence = c.confidence if c is not None else 0.0
        stability_s = c.stability_s if c is not None else INITIAL_STABILITY_DAYS
        code_score = c.code_practice_score if c is not None else 0.0

        if c is not None and c.last_practiced_at is not None and depth_norm >= 0.25:
            dt = compute_elapsed_days(c.last_practiced_at, effective_offset)
            ret = compute_retention(dt, stability_s)
        else:
            ret = 1.0

        prereqs = list(n.prerequisites_json)
        eligible = all(
            (comp_map.get(p) is not None and comp_map[p].depth_level_norm >= 0.75)
            for p in prereqs
        )
        review_flag = is_review_needed(depth_norm, ret)

        roadmap_nodes.append(
            DomainRoadmapNode(
                node_idx=n.node_idx,
                slug=n.concept_slug,
                title=n.title,
                tier=n.tier,
                is_shared=n.is_shared,
                prerequisites=prereqs,
                lesson_markdown=n.lesson_markdown,
                depth_level_norm=round(depth_norm, 4),
                depth_label=depth_lbl,
                confidence=round(confidence, 4),
                stability_s=round(stability_s, 4),
                retention_ebbinghaus=round(ret, 4),
                is_eligible=eligible,
                needs_review=review_flag,
                code_practice_score=round(code_score, 4),
            )
        )

    return DomainRoadmapResponse(
        domain_slug=domain.slug,
        domain_title=domain.title,
        graph_version=domain.graph_version,
        nodes=roadmap_nodes,
    )
