"""Service layer for Multi-Domain Knowledge Graph, Cross-Domain Sync, and Ebbinghaus Retention."""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from plumora_rl.domain import EbbinghausMemoryModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import (
    CodeChallengeModel,
    DomainConceptMapModel,
    DomainModel,
)
from app.modules.content.schemas_v2 import (
    ConceptPlaybookDetailResponse,
    DomainListItem,
    DomainRoadmapNode,
    DomainRoadmapResponse,
    DomainsListResponse,
    DomainUserSummary,
)
from app.modules.contracts.adapters import get_competency_reader_port
from app.modules.contracts.dtos import UserCompetencySnapshotDTO, UserNodeCompetencyDTO
from app.modules.contracts.ports import CompetencyReaderPort


def sync_mvp_mastery_to_v2_competency(db: Session, user_id: uuid.UUID) -> None:
    """Backward-compatible no-op for read paths (MVP overlay is strictly read-only inside port)."""
    _ = (db, user_id)


def _load_user_snapshot(
    db: Session,
    user_id: uuid.UUID,
    competency_port: CompetencyReaderPort | None = None,
) -> tuple[UserCompetencySnapshotDTO, dict[str, UserNodeCompetencyDTO]]:
    port = competency_port or get_competency_reader_port(db)
    snapshot = port.get_user_competency_snapshot(user_id)
    return snapshot, snapshot.by_slug()


def _build_roadmap_node(
    n: DomainConceptMapModel,
    comp_map: dict[str, UserNodeCompetencyDTO],
    title_by_slug: dict[str, str],
    challenge_slugs: set[str],
    effective_offset: float,
) -> DomainRoadmapNode:
    c = comp_map.get(n.concept_slug)
    depth_norm = c.depth_level_norm if c is not None else 0.0
    depth_lbl = c.depth_label if c is not None else "Untested / Below Surface"
    confidence = c.confidence if c is not None else 0.0
    stability_s = c.stability_s if c is not None else EbbinghausMemoryModel.INITIAL_STABILITY_DAYS
    code_score = c.code_practice_score if c is not None else 0.0
    last_practiced = c.last_practiced_at if c is not None else None
    playbook_done = (c is not None and c.playbook_completed_at is not None) or depth_norm >= 0.25

    if c is not None and last_practiced is not None and depth_norm >= EbbinghausMemoryModel.MIN_DEPTH_FOR_RETENTION:
        dt = EbbinghausMemoryModel.compute_elapsed_days(last_practiced, effective_offset)
        ret = EbbinghausMemoryModel.compute_retention(dt, stability_s)
    else:
        ret = 1.0

    prereqs = list(n.prerequisites_json or [])
    prereq_titles = [{"slug": p, "title": title_by_slug.get(p, p)} for p in prereqs]
    eligible = all(
        (comp_map.get(p) is not None and comp_map[p].depth_level_norm >= 0.75)
        for p in prereqs
    )
    review_flag = EbbinghausMemoryModel.is_review_needed(depth_norm, ret)
    next_due = EbbinghausMemoryModel.compute_next_review_due_at(
        last_practiced, stability_s, depth_norm
    )

    return DomainRoadmapNode(
        node_idx=n.node_idx,
        slug=n.concept_slug,
        title=n.title,
        tier=n.tier,
        is_shared=n.is_shared,
        prerequisites=prereqs,
        prerequisite_titles=prereq_titles,
        lesson_markdown=n.lesson_markdown,
        depth_level_norm=round(depth_norm, 4),
        depth_label=depth_lbl,
        confidence=round(confidence, 4),
        stability_s=round(stability_s, 4),
        retention_ebbinghaus=round(ret, 4),
        is_eligible=eligible,
        needs_review=review_flag,
        code_practice_score=round(code_score, 4),
        has_code_challenge=n.concept_slug in challenge_slugs,
        playbook_completed=playbook_done,
        last_practiced_at=last_practiced,
        next_review_due_at=next_due,
    )


def list_domains_for_user(
    db: Session,
    user_id: uuid.UUID,
    competency_port: CompetencyReaderPort | None = None,
) -> DomainsListResponse:
    """List all published domains with cross-domain node counts and user summary (read-only)."""
    domains = db.scalars(
        select(DomainModel)
        .where(DomainModel.is_published.is_(True))
        .order_by(DomainModel.slug)
        .limit(100)
    ).all()
    snapshot, comp_map = _load_user_snapshot(db, user_id, competency_port)
    completed_placements = set(snapshot.completed_placement_domains)

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

            if c.last_practiced_at is not None and c.depth_level_norm >= EbbinghausMemoryModel.MIN_DEPTH_FOR_RETENTION:
                dt = EbbinghausMemoryModel.compute_elapsed_days(c.last_practiced_at, 0.0)
                ret = EbbinghausMemoryModel.compute_retention(dt, c.stability_s)
                if EbbinghausMemoryModel.is_review_needed(c.depth_level_norm, ret):
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
    competency_port: CompetencyReaderPort | None = None,
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
    slugs = [n.concept_slug for n in nodes]
    challenge_slugs = (
        set(
            db.scalars(
                select(CodeChallengeModel.concept_slug).where(
                    CodeChallengeModel.concept_slug.in_(slugs),
                    CodeChallengeModel.is_active.is_(True),
                )
            ).all()
        )
        if slugs
        else set()
    )
    title_by_slug = {n.concept_slug: n.title for n in nodes}
    _, comp_map = _load_user_snapshot(db, user_id, competency_port)

    roadmap_nodes = [
        _build_roadmap_node(n, comp_map, title_by_slug, challenge_slugs, effective_offset)
        for n in nodes
    ]

    return DomainRoadmapResponse(
        domain_slug=domain.slug,
        domain_title=domain.title,
        graph_version=domain.graph_version,
        nodes=roadmap_nodes,
    )


def get_concept_playbook_detail(
    db: Session,
    user_id: uuid.UUID,
    domain_slug: str,
    concept_slug: str,
    competency_port: CompetencyReaderPort | None = None,
) -> ConceptPlaybookDetailResponse:
    """Return single concept playbook and learner competency state strictly by (domain_slug, concept_slug)."""
    domain = db.get(DomainModel, domain_slug)
    if domain is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "DOMAIN_NOT_FOUND",
                "message": f"Domain '{domain_slug}' does not exist.",
            },
        )
    node = db.get(DomainConceptMapModel, (domain_slug, concept_slug))
    if node is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "CONCEPT_NOT_FOUND",
                "message": f"Concept '{concept_slug}' does not exist in domain '{domain_slug}'.",
            },
        )

    prereqs = list(node.prerequisites_json or [])
    prereq_rows = (
        db.scalars(
            select(DomainConceptMapModel).where(
                DomainConceptMapModel.domain_slug == domain_slug,
                DomainConceptMapModel.concept_slug.in_(prereqs),
            )
        ).all()
        if prereqs
        else []
    )
    title_by_slug = {r.concept_slug: r.title for r in prereq_rows}
    title_by_slug[node.concept_slug] = node.title

    has_ch = (
        db.scalars(
            select(CodeChallengeModel.id).where(
                CodeChallengeModel.concept_slug == concept_slug,
                CodeChallengeModel.is_active.is_(True),
            )
        ).first()
        is not None
    )
    challenge_slugs = {concept_slug} if has_ch else set()
    _, comp_map = _load_user_snapshot(db, user_id, competency_port)

    node_out = _build_roadmap_node(node, comp_map, title_by_slug, challenge_slugs, 0.0)
    return ConceptPlaybookDetailResponse(
        domain_slug=domain.slug,
        domain_title=domain.title,
        node=node_out,
    )
