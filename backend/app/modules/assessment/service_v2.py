"""Backward-compatible facade re-exporting app.modules.assessment.services."""

from app.modules.assessment.services import (
    _GRADER_REGISTRY,
    _RUBRIC_SERVICE,
    _SANDBOX_WORKER,
    _invalidate_user_competency_cache,
    abandon_assessment_session,
    complete_concept_playbook,
    get_code_challenge_for_concept,
    recommend_v2_next_step,
    start_depth_or_review_session,
    start_placement_session,
    submit_code_sandbox,
    submit_depth_or_review_step,
    submit_placement_answer,
)

__all__ = [
    "_GRADER_REGISTRY",
    "_RUBRIC_SERVICE",
    "_SANDBOX_WORKER",
    "_invalidate_user_competency_cache",
    "abandon_assessment_session",
    "complete_concept_playbook",
    "get_code_challenge_for_concept",
    "recommend_v2_next_step",
    "start_depth_or_review_session",
    "start_placement_session",
    "submit_code_sandbox",
    "submit_depth_or_review_step",
    "submit_placement_answer",
]
