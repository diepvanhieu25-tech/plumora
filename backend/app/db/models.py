"""Central ORM metadata registry re-exporting all bounded-context models & DB session helpers."""

from __future__ import annotations

from app.db.base import Base
from app.db.session import DbSession, SessionLocal, engine, get_db
from app.modules.assessment.models import (
    AssessmentSessionModel,
    AttemptRecordModel,
    UserNodeCompetencyModel,
)
from app.modules.auth.models import UserModel
from app.modules.content.models import (
    CodeChallengeModel,
    DepthQuestionModel,
    DomainConceptMapModel,
    DomainModel,
    GradingRubricModel,
)
from app.modules.recommendation.models import (
    ModelRegistryModel,
    OnlineEvalRunModel,
    RecommendationLogModel,
    RlExperienceBufferModel,
)
from app.shared.events.models import ConsumedEventModel, OutboxEventModel

__all__ = [
    "AssessmentSessionModel",
    "AttemptRecordModel",
    "Base",
    "CodeChallengeModel",
    "ConsumedEventModel",
    "DbSession",
    "DepthQuestionModel",
    "DomainConceptMapModel",
    "DomainModel",
    "GradingRubricModel",
    "ModelRegistryModel",
    "OnlineEvalRunModel",
    "OutboxEventModel",
    "RecommendationLogModel",
    "RlExperienceBufferModel",
    "SessionLocal",
    "UserModel",
    "UserNodeCompetencyModel",
    "engine",
    "get_db",
]
