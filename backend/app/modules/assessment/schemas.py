"""Pydantic request/response schemas for Assessment and Quiz grading (PL-QUIZ-01)."""

from __future__ import annotations

from pydantic import BaseModel


class AnswerItemRequest(BaseModel):
    """Single question answer choice."""

    question_id: str
    selected_option: str


class SubmitAttemptRequest(BaseModel):
    """Quiz attempt submission payload with mandatory submission_id (D-06, D-10)."""

    submission_id: str
    answers: list[AnswerItemRequest]


class ApplyPresetRequest(BaseModel):
    """Demo preset reset payload (D-05, D-11)."""

    preset_key: str
