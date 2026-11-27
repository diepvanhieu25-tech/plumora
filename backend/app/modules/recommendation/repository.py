"""Data access repository for the Recommendation & Online RL bounded context (schema: rec_ai_svc)."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.recommendation.models import (
    ModelRegistryModel,
    RecommendationLogModel,
    RlExperienceBufferModel,
)


class RecommendationRepository:
    """SQLAlchemy repository for recommendation_logs, rl_experience_buffer & model_registry."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_active_model(self) -> ModelRegistryModel | None:
        return self.db.scalars(
            select(ModelRegistryModel)
            .where(ModelRegistryModel.is_active.is_(True))
            .order_by(ModelRegistryModel.activated_at.desc(), ModelRegistryModel.created_at.desc())
            .limit(1)
        ).first()

    def list_models(self, limit: int = 50) -> list[ModelRegistryModel]:
        return list(
            self.db.scalars(
                select(ModelRegistryModel)
                .order_by(ModelRegistryModel.created_at.desc())
                .limit(max(1, min(limit, 200)))
            ).all()
        )

    def count_experience_buffer(self) -> int:
        return int(
            self.db.scalar(select(func.count()).select_from(RlExperienceBufferModel)) or 0
        )

    def list_recent_recommendation_logs(
        self,
        *,
        domain_slug: str | None = None,
        user_id: uuid.UUID | None = None,
        limit: int = 1000,
    ) -> list[RecommendationLogModel]:
        stmt = select(RecommendationLogModel)
        if domain_slug:
            stmt = stmt.where(RecommendationLogModel.domain_slug == domain_slug)
        if user_id is not None:
            stmt = stmt.where(RecommendationLogModel.user_id == user_id)
        return list(
            self.db.scalars(
                stmt.order_by(RecommendationLogModel.created_at.desc()).limit(limit)
            ).all()
        )
