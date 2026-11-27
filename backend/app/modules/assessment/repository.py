"""Data access repository for the Assessment & Grader bounded context (schema: assess_svc)."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.assessment.models import (
    AssessmentSessionModel,
    AttemptRecordModel,
    UserNodeCompetencyModel,
)
from app.shared.events.models import OutboxEventModel


class AssessmentRepository:
    """SQLAlchemy repository for competencies, assessment sessions, attempts & outbox stats."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def list_user_competencies(self, user_id: uuid.UUID) -> list[UserNodeCompetencyModel]:
        return list(
            self.db.scalars(
                select(UserNodeCompetencyModel).where(UserNodeCompetencyModel.user_id == user_id)
            ).all()
        )

    def list_completed_placement_domains(self, user_id: uuid.UUID, limit: int = 100) -> list[str]:
        return list(
            self.db.scalars(
                select(AssessmentSessionModel.domain_slug)
                .distinct()
                .where(
                    AssessmentSessionModel.user_id == user_id,
                    AssessmentSessionModel.session_mode == "placement",
                    AssessmentSessionModel.status == "completed",
                )
                .limit(limit)
            ).all()
        )

    def count_user_attempts(self, user_id: uuid.UUID) -> int:
        return int(
            self.db.scalar(
                select(func.count())
                .select_from(AttemptRecordModel)
                .where(AttemptRecordModel.user_id == user_id)
            )
            or 0
        )

    def list_cohort_competencies(
        self,
        slugs: list[str],
        limit: int = 5000,
    ) -> list[UserNodeCompetencyModel]:
        if not slugs:
            return []
        return list(
            self.db.scalars(
                select(UserNodeCompetencyModel)
                .where(UserNodeCompetencyModel.concept_slug.in_(slugs))
                .limit(limit)
            ).all()
        )

    def aggregate_cohort_bottlenecks(self, slugs: list[str]) -> list[tuple[str, int, int]]:
        if not slugs:
            return []
        rows = self.db.execute(
            select(
                AssessmentSessionModel.concept_slug,
                AssessmentSessionModel.current_depth_tier,
                func.count(),
            )
            .where(
                AssessmentSessionModel.concept_slug.in_(slugs),
                AssessmentSessionModel.status.in_(["ceiling_reached", "insufficient_evidence"]),
            )
            .group_by(AssessmentSessionModel.concept_slug, AssessmentSessionModel.current_depth_tier)
        ).all()
        return [(str(c_slug), int(tier_num), int(cnt)) for c_slug, tier_num, cnt in rows if c_slug]

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
