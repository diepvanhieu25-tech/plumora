"""Monolith SQL and Microservice Cached-HTTP Adapters for Hexagonal Boundary Ports."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime
from typing import Any

import redis
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import (
    AssessmentSessionModel,
    CodeChallengeModel,
    DbSession,
    DepthQuestionModel,
    DomainConceptMapModel,
    DomainModel,
    GradingRubricModel,
    UserModel,
    UserNodeCompetencyModel,
)
from app.db.redis_pool import get_redis_client
from app.modules.contracts.dtos import (
    CodeChallengeDTO,
    ConceptBundleDTO,
    ConceptNodeDTO,
    DepthQuestionDTO,
    DomainTopologyDTO,
    GradingRubricDTO,
    UserCompetencySnapshotDTO,
    UserNodeCompetencyDTO,
)
from app.modules.contracts.ports import CompetencyReaderPort, ContentCatalogPort
from app.modules.events.internal_client import (
    assessment_service_url,
    content_service_url,
    fetch_concept_bundle_internal,
    fetch_domain_bundle_internal,
    fetch_user_competencies_payload_internal,
)

logger = logging.getLogger(__name__)
KG_REDIS_TTL_SECONDS = 3600


def _kg_redis_key(domain_slug: str) -> str:
    return f"plumora:kg:{domain_slug}"


def _question_dto_from_dict(qd: dict[str, Any]) -> DepthQuestionDTO:
    q_id = uuid.UUID(str(qd["id"]))
    r_raw = qd.get("rubric")
    rubric_dto = (
        GradingRubricDTO(
            question_id=q_id,
            criteria_json=list(r_raw.get("criteria_json", [])),
            reference_explanation=str(r_raw.get("reference_explanation", "")),
        )
        if isinstance(r_raw, dict)
        else None
    )
    return DepthQuestionDTO(
        id=q_id,
        concept_slug=str(qd["concept_slug"]),
        depth_tier=int(qd["depth_tier"]),
        task_type=str(qd["task_type"]),
        prompt=str(qd["prompt"]),
        options_json=qd.get("options_json"),
        correct_option_key=qd.get("correct_option_key"),
        is_placement_eligible=bool(qd.get("is_placement_eligible", False)),
        is_active=bool(qd.get("is_active", True)),
        version=int(qd.get("version", 1)),
        display_order=int(qd.get("display_order", 0)),
        rubric=rubric_dto,
    )


def _domain_dto_from_bundle(bundle: dict[str, Any]) -> DomainTopologyDTO:
    dom = bundle["domain"]
    questions = tuple(_question_dto_from_dict(qd) for qd in bundle.get("questions", []))
    tiers_by_slug: dict[str, set[int]] = {}
    for q in questions:
        if q.is_active:
            tiers_by_slug.setdefault(q.concept_slug, set()).add(q.depth_tier)
    nodes = tuple(
        ConceptNodeDTO(
            domain_slug=str(n["domain_slug"]),
            concept_slug=str(n["concept_slug"]),
            node_idx=int(n["node_idx"]),
            title=str(n["title"]),
            tier=int(n["tier"]),
            is_shared=bool(n.get("is_shared", False)),
            prerequisites=tuple(str(p) for p in n.get("prerequisites_json", [])),
            lesson_markdown=str(n.get("lesson_markdown", "")),
            has_code_challenge=bool(n.get("has_code_challenge", False)),
            question_tiers_available=tuple(sorted(tiers_by_slug.get(str(n["concept_slug"]), set()))),
        )
        for n in bundle.get("nodes", [])
    )
    return DomainTopologyDTO(
        domain_slug=str(dom["slug"]),
        title=str(dom["title"]),
        description=str(dom.get("description", "")),
        graph_version=int(dom.get("graph_version", 1)),
        nodes=nodes,
        questions=questions,
    )


class SqlContentCatalogAdapter:
    """In-process SQLAlchemy adapter for ContentCatalogPort (Monolith & content-kg-service)."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def get_domain_topology(self, domain_slug: str) -> DomainTopologyDTO | None:
        dom = self._db.get(DomainModel, domain_slug)
        if dom is None:
            return None
        db_nodes = self._db.scalars(
            select(DomainConceptMapModel)
            .where(DomainConceptMapModel.domain_slug == domain_slug)
            .order_by(DomainConceptMapModel.node_idx)
        ).all()
        slugs = [n.concept_slug for n in db_nodes]
        db_qs = (
            self._db.scalars(
                select(DepthQuestionModel)
                .where(DepthQuestionModel.concept_slug.in_(slugs))
                .order_by(DepthQuestionModel.depth_tier, DepthQuestionModel.display_order)
            ).all()
            if slugs
            else []
        )
        q_ids = [q.id for q in db_qs]
        db_rubrics = (
            self._db.scalars(
                select(GradingRubricModel).where(GradingRubricModel.question_id.in_(q_ids))
            ).all()
            if q_ids
            else []
        )
        rubric_by_q = {r.question_id: r for r in db_rubrics}

        ch_slugs = (
            set(
                self._db.scalars(
                    select(CodeChallengeModel.concept_slug).where(
                        CodeChallengeModel.concept_slug.in_(slugs),
                        CodeChallengeModel.is_active.is_(True),
                    )
                ).all()
            )
            if slugs
            else set()
        )

        tiers_by_slug: dict[str, set[int]] = {}
        question_dtos: list[DepthQuestionDTO] = []
        for q in db_qs:
            if q.is_active:
                tiers_by_slug.setdefault(q.concept_slug, set()).add(q.depth_tier)
            rub = rubric_by_q.get(q.id)
            question_dtos.append(
                DepthQuestionDTO(
                    id=q.id,
                    concept_slug=q.concept_slug,
                    depth_tier=q.depth_tier,
                    task_type=q.task_type,
                    prompt=q.prompt,
                    options_json=q.options_json,
                    correct_option_key=q.correct_option_key,
                    is_placement_eligible=q.is_placement_eligible,
                    is_active=q.is_active,
                    version=q.version,
                    display_order=q.display_order,
                    rubric=(
                        GradingRubricDTO(
                            question_id=q.id,
                            criteria_json=list(rub.criteria_json),
                            reference_explanation=rub.reference_explanation,
                        )
                        if rub is not None
                        else None
                    ),
                )
            )

        node_dtos = tuple(
            ConceptNodeDTO(
                domain_slug=n.domain_slug,
                concept_slug=n.concept_slug,
                node_idx=n.node_idx,
                title=n.title,
                tier=n.tier,
                is_shared=n.is_shared,
                prerequisites=tuple(str(p) for p in (n.prerequisites_json or [])),
                lesson_markdown=n.lesson_markdown,
                has_code_challenge=n.concept_slug in ch_slugs,
                question_tiers_available=tuple(sorted(tiers_by_slug.get(n.concept_slug, set()))),
            )
            for n in db_nodes
        )
        return DomainTopologyDTO(
            domain_slug=dom.slug,
            title=dom.title,
            description=dom.description,
            graph_version=dom.graph_version,
            nodes=node_dtos,
            questions=tuple(question_dtos),
        )

    def get_concept_bundle(self, concept_slug: str) -> ConceptBundleDTO | None:
        node = self._db.scalars(
            select(DomainConceptMapModel).where(DomainConceptMapModel.concept_slug == concept_slug)
        ).first()
        if node is None:
            return None
        db_qs = self._db.scalars(
            select(DepthQuestionModel)
            .where(DepthQuestionModel.concept_slug == concept_slug)
            .order_by(DepthQuestionModel.depth_tier, DepthQuestionModel.display_order)
        ).all()
        q_ids = [q.id for q in db_qs]
        db_rubrics = (
            self._db.scalars(
                select(GradingRubricModel).where(GradingRubricModel.question_id.in_(q_ids))
            ).all()
            if q_ids
            else []
        )
        rubric_by_q = {r.question_id: r for r in db_rubrics}
        ch = self._db.scalars(
            select(CodeChallengeModel)
            .where(
                CodeChallengeModel.concept_slug == concept_slug,
                CodeChallengeModel.is_active.is_(True),
            )
            .order_by(CodeChallengeModel.display_order)
        ).first()

        q_dtos = tuple(
            DepthQuestionDTO(
                id=q.id,
                concept_slug=q.concept_slug,
                depth_tier=q.depth_tier,
                task_type=q.task_type,
                prompt=q.prompt,
                options_json=q.options_json,
                correct_option_key=q.correct_option_key,
                is_placement_eligible=q.is_placement_eligible,
                is_active=q.is_active,
                version=q.version,
                display_order=q.display_order,
                rubric=(
                    GradingRubricDTO(
                        question_id=q.id,
                        criteria_json=list(rubric_by_q[q.id].criteria_json),
                        reference_explanation=rubric_by_q[q.id].reference_explanation,
                    )
                    if q.id in rubric_by_q
                    else None
                ),
            )
            for q in db_qs
        )
        tiers_avail = tuple(sorted({q.depth_tier for q in db_qs if q.is_active}))
        ch_dto = (
            CodeChallengeDTO(
                id=ch.id,
                concept_slug=ch.concept_slug,
                title=ch.title,
                language=ch.language,
                prompt=ch.prompt,
                buggy_starter_code=ch.buggy_starter_code,
                test_cases_json=list(ch.test_cases_json),
                timeout_ms=ch.timeout_ms,
                memory_limit_mb=ch.memory_limit_mb,
                setup_sql=ch.setup_sql,
                is_active=ch.is_active,
                version=ch.version,
                display_order=ch.display_order,
            )
            if ch is not None
            else None
        )
        return ConceptBundleDTO(
            node=ConceptNodeDTO(
                domain_slug=node.domain_slug,
                concept_slug=node.concept_slug,
                node_idx=node.node_idx,
                title=node.title,
                tier=node.tier,
                is_shared=node.is_shared,
                prerequisites=tuple(str(p) for p in (node.prerequisites_json or [])),
                lesson_markdown=node.lesson_markdown,
                has_code_challenge=ch is not None,
                question_tiers_available=tiers_avail,
            ),
            questions=q_dtos,
            code_challenge=ch_dto,
        )

    def find_question_concept_slug(self, question_id: uuid.UUID) -> str | None:
        q = self._db.get(DepthQuestionModel, question_id)
        return str(q.concept_slug) if q is not None else None


class CachedHttpContentCatalogAdapter:
    """Microservice adapter: reads Redis plumora:kg:{domain_slug} -> fallback Internal HTTP."""

    def __init__(self, redis_url: str | None = None) -> None:
        self._redis_url = redis_url or settings.redis_url

    def get_domain_topology(self, domain_slug: str) -> DomainTopologyDTO | None:
        key = _kg_redis_key(domain_slug)
        try:
            r_client = get_redis_client(self._redis_url, decode_responses=True, socket_timeout=0.3)
            raw = r_client.get(key)
            if isinstance(raw, str):
                return _domain_dto_from_bundle(json.loads(raw))
        except (redis.RedisError, OSError, ValueError, KeyError) as exc:
            logger.warning("Redis KG cache read failed for '%s': %s", domain_slug, exc)

        bundle = fetch_domain_bundle_internal(domain_slug)
        if bundle is None:
            return None
        try:
            r_client = get_redis_client(self._redis_url, decode_responses=True, socket_timeout=0.3)
            r_client.set(key, json.dumps(bundle), ex=KG_REDIS_TTL_SECONDS)
        except (redis.RedisError, OSError) as exc:
            logger.warning("Redis KG cache warm failed for '%s': %s", domain_slug, exc)
        return _domain_dto_from_bundle(bundle)

    def get_concept_bundle(self, concept_slug: str) -> ConceptBundleDTO | None:
        bundle = fetch_concept_bundle_internal(concept_slug)
        if bundle is None:
            return None
        n = bundle["node"]
        q_dtos = tuple(_question_dto_from_dict(qd) for qd in bundle.get("questions", []))
        ch_d = bundle.get("code_challenge")
        ch_dto = (
            CodeChallengeDTO(
                id=uuid.UUID(str(ch_d["id"])),
                concept_slug=str(ch_d["concept_slug"]),
                title=str(ch_d["title"]),
                language=str(ch_d["language"]),
                prompt=str(ch_d["prompt"]),
                buggy_starter_code=str(ch_d["buggy_starter_code"]),
                test_cases_json=list(ch_d["test_cases_json"]),
                timeout_ms=int(ch_d.get("timeout_ms", 3000)),
                memory_limit_mb=int(ch_d.get("memory_limit_mb", 128)),
                setup_sql=ch_d.get("setup_sql"),
                is_active=bool(ch_d.get("is_active", True)),
                version=int(ch_d.get("version", 1)),
                display_order=int(ch_d.get("display_order", 0)),
            )
            if isinstance(ch_d, dict)
            else None
        )
        tiers_avail = tuple(sorted({q.depth_tier for q in q_dtos if q.is_active}))
        return ConceptBundleDTO(
            node=ConceptNodeDTO(
                domain_slug=str(n["domain_slug"]),
                concept_slug=str(n["concept_slug"]),
                node_idx=int(n["node_idx"]),
                title=str(n["title"]),
                tier=int(n["tier"]),
                is_shared=bool(n.get("is_shared", False)),
                prerequisites=tuple(str(p) for p in n.get("prerequisites_json", [])),
                lesson_markdown=str(n.get("lesson_markdown", "")),
                has_code_challenge=ch_dto is not None,
                question_tiers_available=tiers_avail,
            ),
            questions=q_dtos,
            code_challenge=ch_dto,
        )

    def find_question_concept_slug(self, question_id: uuid.UUID) -> str | None:
        _ = question_id
        return None


class SqlCompetencyReaderAdapter:
    """In-process SQLAlchemy adapter for CompetencyReaderPort (Monolith & assessment-grader-service)."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def get_user_competency_snapshot(self, user_id: uuid.UUID) -> UserCompetencySnapshotDTO:
        rows = self._db.scalars(
            select(UserNodeCompetencyModel).where(UserNodeCompetencyModel.user_id == user_id)
        ).all()
        completed_placements = tuple(
            self._db.scalars(
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
        user_row = self._db.get(UserModel, user_id)
        state_version = int(user_row.state_version) if user_row is not None else max(1, len(rows))
        comp_dtos = tuple(
            UserNodeCompetencyDTO(
                concept_slug=r.concept_slug,
                depth_level_norm=float(r.depth_level_norm),
                peak_depth_level_norm=float(r.peak_depth_level_norm),
                depth_label=r.depth_label,
                confidence=float(r.confidence),
                stability_s=float(r.stability_s),
                last_practiced_at=r.last_practiced_at,
                playbook_completed_at=r.playbook_completed_at,
                code_practice_score=float(r.code_practice_score),
            )
            for r in rows
        )
        return UserCompetencySnapshotDTO(
            user_id=user_id,
            state_version=state_version,
            completed_placement_domains=completed_placements,
            competencies=comp_dtos,
        )


class HttpCompetencyReaderAdapter:
    """Microservice adapter calling assessment-grader-service internal API."""

    def get_user_competency_snapshot(self, user_id: uuid.UUID) -> UserCompetencySnapshotDTO:
        payload = fetch_user_competencies_payload_internal(user_id)
        if payload is None:
            return UserCompetencySnapshotDTO(user_id=user_id, state_version=1)
        comp_dtos: list[UserNodeCompetencyDTO] = []
        for it in payload.get("competencies", []):
            lp_raw = it.get("last_practiced_at")
            pb_raw = it.get("playbook_completed_at")
            comp_dtos.append(
                UserNodeCompetencyDTO(
                    concept_slug=str(it["concept_slug"]),
                    depth_level_norm=float(it["depth_level_norm"]),
                    peak_depth_level_norm=float(it["peak_depth_level_norm"]),
                    depth_label=str(it["depth_label"]),
                    confidence=float(it["confidence"]),
                    stability_s=float(it["stability_s"]),
                    last_practiced_at=datetime.fromisoformat(str(lp_raw)) if lp_raw else None,
                    playbook_completed_at=datetime.fromisoformat(str(pb_raw)) if pb_raw else None,
                    code_practice_score=float(it.get("code_practice_score", 0.0)),
                )
            )
        return UserCompetencySnapshotDTO(
            user_id=user_id,
            state_version=int(payload.get("state_version", 1)),
            completed_placement_domains=tuple(
                str(d) for d in payload.get("completed_placement_domains", [])
            ),
            competencies=tuple(comp_dtos),
        )


def get_content_catalog_port(db: DbSession) -> ContentCatalogPort:
    """FastAPI Depends() factory resolving ContentCatalogPort for Monolith or Microservice mode."""
    if content_service_url():
        return CachedHttpContentCatalogAdapter()
    return SqlContentCatalogAdapter(db)


def get_competency_reader_port(db: DbSession) -> CompetencyReaderPort:
    """FastAPI Depends() factory resolving CompetencyReaderPort for Monolith or Microservice mode."""
    if assessment_service_url():
        return HttpCompetencyReaderAdapter()
    return SqlCompetencyReaderAdapter(db)
