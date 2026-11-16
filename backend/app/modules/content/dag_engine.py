"""DAG Graph Traversal, Mastery Calculation, and Roadmap Payload Builder (PL-CONTENT-01)."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    ConceptModel,
    ConceptPrerequisiteModel,
    QuizAttemptModel,
    RecommendationLogModel,
    UserConceptMasteryModel,
    UserModel,
)
from app.db.redis_store import PASS_THRESHOLD


def build_roadmap_payload(db: Session, user: UserModel) -> dict[str, Any]:
    """Build the 12-node Roadmap DAG payload for the authenticated learner."""
    concepts = db.scalars(select(ConceptModel).order_by(ConceptModel.action_id)).all()
    prereqs = db.scalars(select(ConceptPrerequisiteModel)).all()
    mastery_rows = db.scalars(
        select(UserConceptMasteryModel).where(UserConceptMasteryModel.user_id == user.id)
    ).all()

    slug_by_id = {c.action_id: c.slug for c in concepts}
    prereq_ids_by_id: dict[int, list[int]] = {c.action_id: [] for c in concepts}
    for pr in prereqs:
        prereq_ids_by_id.setdefault(pr.concept_action_id, []).append(pr.prereq_action_id)

    mastery_by_id = {r.concept_action_id: float(r.mastery_score) for r in mastery_rows}

    nodes: list[dict[str, Any]] = []
    mastered_count = 0
    for c in concepts:
        score = round(mastery_by_id.get(c.action_id, 0.0), 4)
        p_ids = sorted(prereq_ids_by_id.get(c.action_id, []))
        p_slugs = [slug_by_id[pid] for pid in p_ids]
        unlocked = all(mastery_by_id.get(pid, 0.0) >= PASS_THRESHOLD for pid in p_ids)
        if score >= PASS_THRESHOLD:
            status = "mastered"
            mastered_count += 1
        elif unlocked:
            status = "unlocked"
        else:
            status = "locked"

        nodes.append(
            {
                "action_id": c.action_id,
                "slug": c.slug,
                "title": c.title,
                "tier": c.tier,
                "prerequisites": p_slugs,
                "mastery_score": score,
                "status": status,
            }
        )

    attempts = db.scalars(
        select(QuizAttemptModel)
        .where(QuizAttemptModel.user_id == user.id)
        .order_by(QuizAttemptModel.created_at.desc())
        .limit(10)
    ).all()
    recent_attempts = [
        {
            "attempt_id": str(a.id),
            "submission_id": str(a.submission_id),
            "concept_action_id": a.concept_action_id,
            "concept_slug": slug_by_id.get(a.concept_action_id, ""),
            "correct_count": a.correct_count,
            "attempt_score": a.attempt_score,
            "passed": a.passed,
            "mastery_before": a.mastery_before,
            "mastery_after": a.mastery_after,
            "created_at": a.created_at.isoformat(),
        }
        for a in attempts
    ]

    rec_logs = db.scalars(
        select(RecommendationLogModel)
        .where(RecommendationLogModel.user_id == user.id)
        .order_by(RecommendationLogModel.created_at.desc())
        .limit(5)
    ).all()
    recent_recommendations = [
        {
            "id": str(r.id),
            "state_version": r.state_version,
            "recommended_action_id": r.recommended_action_id,
            "recommended_slug": (
                slug_by_id.get(r.recommended_action_id, "")
                if r.recommended_action_id is not None
                else None
            ),
            "policy_source": r.policy_source,
            "state_source": r.state_source,
            "guardrail_applied": r.guardrail_applied,
            "checkpoint_sha256": r.checkpoint_sha256,
            "created_at": r.created_at.isoformat(),
        }
        for r in rec_logs
    ]

    return {
        "state_version": user.state_version,
        "mastered_count": mastered_count,
        "total_concepts": len(concepts),
        "nodes": nodes,
        "recent_attempts": recent_attempts,
        "recent_recommendations": recent_recommendations,
    }
