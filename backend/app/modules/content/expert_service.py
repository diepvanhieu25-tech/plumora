"""Backward-compatible facade re-exporting app.modules.content.services."""

from app.modules.content.services import (
    create_expert_code_challenge,
    create_expert_domain,
    create_expert_question,
    delete_expert_question,
    dry_run_expert_code_challenge,
    dry_run_expert_rubric,
    get_expert_cohort_analytics,
    get_expert_domain_graph,
    list_expert_code_challenges,
    list_expert_questions,
    patch_expert_concept_playbook,
    update_expert_domain_graph,
    update_expert_question,
)

__all__ = [
    "create_expert_code_challenge",
    "create_expert_domain",
    "create_expert_question",
    "delete_expert_question",
    "dry_run_expert_code_challenge",
    "dry_run_expert_rubric",
    "get_expert_cohort_analytics",
    "get_expert_domain_graph",
    "list_expert_code_challenges",
    "list_expert_questions",
    "patch_expert_concept_playbook",
    "update_expert_domain_graph",
    "update_expert_question",
]
