"""Data access repository for the Content & Knowledge Graph bounded context (schema: content_svc)."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.content.models import (
    CodeChallengeModel,
    DepthQuestionModel,
    DomainConceptMapModel,
    DomainModel,
    GradingRubricModel,
)
from app.shared.events.models import OutboxEventModel


class ContentRepository:
    """SQLAlchemy repository for domains, concepts, depth questions, rubrics & code challenges."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_domain(self, slug: str) -> DomainModel | None:
        return self.db.get(DomainModel, slug)

    def list_published_domains(self, limit: int = 100) -> list[DomainModel]:
        return list(
            self.db.scalars(
                select(DomainModel)
                .where(DomainModel.is_published.is_(True))
                .order_by(DomainModel.slug)
                .limit(limit)
            ).all()
        )

    def list_domain_nodes(self, domain_slug: str) -> list[DomainConceptMapModel]:
        return list(
            self.db.scalars(
                select(DomainConceptMapModel)
                .where(DomainConceptMapModel.domain_slug == domain_slug)
                .order_by(DomainConceptMapModel.node_idx)
            ).all()
        )

    def get_concept_node(
        self,
        concept_slug: str,
        domain_slug: str | None = None,
    ) -> DomainConceptMapModel | None:
        if domain_slug:
            node = self.db.get(DomainConceptMapModel, (domain_slug, concept_slug))
            if node is not None:
                return node
        return self.db.scalars(
            select(DomainConceptMapModel)
            .where(DomainConceptMapModel.concept_slug == concept_slug)
            .order_by(DomainConceptMapModel.domain_slug)
        ).first()

    def list_questions_for_slugs(self, slugs: list[str]) -> list[DepthQuestionModel]:
        if not slugs:
            return []
        return list(
            self.db.scalars(
                select(DepthQuestionModel)
                .where(DepthQuestionModel.concept_slug.in_(slugs))
                .order_by(
                    DepthQuestionModel.depth_tier,
                    DepthQuestionModel.version.desc(),
                    DepthQuestionModel.display_order,
                )
            ).all()
        )

    def map_rubrics_by_question_id(
        self,
        question_ids: list[uuid.UUID],
    ) -> dict[str, GradingRubricModel]:
        if not question_ids:
            return {}
        rubrics = self.db.scalars(
            select(GradingRubricModel).where(GradingRubricModel.question_id.in_(question_ids))
        ).all()
        return {str(r.question_id): r for r in rubrics}

    def list_active_challenge_slugs(self, slugs: list[str]) -> set[str]:
        if not slugs:
            return set()
        return set(
            self.db.scalars(
                select(CodeChallengeModel.concept_slug).where(
                    CodeChallengeModel.concept_slug.in_(slugs),
                    CodeChallengeModel.is_active.is_(True),
                )
            ).all()
        )

    def get_active_code_challenge(self, concept_slug: str) -> CodeChallengeModel | None:
        return self.db.scalars(
            select(CodeChallengeModel)
            .where(
                CodeChallengeModel.concept_slug == concept_slug,
                CodeChallengeModel.is_active.is_(True),
            )
            .order_by(CodeChallengeModel.version.desc(), CodeChallengeModel.display_order)
        ).first()

    def count_pending_outbox(self) -> tuple[int, dict[str, int]]:
        cnt = int(
            self.db.scalar(
                select(func.count())
                .select_from(OutboxEventModel)
                .where(OutboxEventModel.published_at.is_(None))
            )
            or 0
        )
        rows = self.db.execute(
            select(OutboxEventModel.event_type, func.count())
            .where(OutboxEventModel.published_at.is_(None))
            .group_by(OutboxEventModel.event_type)
        ).all()
        return cnt, {str(ev_t): int(c) for ev_t, c in rows}
