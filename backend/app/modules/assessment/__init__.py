"""Assessment module public interface and backward compatibility layer."""

from __future__ import annotations

from app.modules.assessment.router import router
from app.modules.assessment.schemas import (
    AnswerItemRequest,
    ApplyPresetRequest,
    SubmitAttemptRequest,
)
from app.modules.assessment.unit_of_work import execute_quiz_attempt_uow

__all__ = [
    "AnswerItemRequest",
    "ApplyPresetRequest",
    "SubmitAttemptRequest",
    "execute_quiz_attempt_uow",
    "router",
]
