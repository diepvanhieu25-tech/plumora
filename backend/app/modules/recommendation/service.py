"""Recommendation Service applying the Strategy Pattern to compute next action (PL-REC-01)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import ConceptModel, RecommendationLogModel
from app.db.redis_store import PASS_THRESHOLD, get_learner_state_24d
from app.modules.recommendation.checkpoint import (
    VerifiedDqnCheckpoint,
    load_verified_dqn_checkpoint,
)
from app.modules.recommendation.strategies import (
    DagTierFallbackStrategy,
    DqnDirectStrategy,
    DqnMaskedQStrategy,
    RecommendationStrategy,
)


def compute_recommendation(
    db: Session,
    user_id: uuid.UUID,
    *,
    checkpoint_path_override: str | None = None,
    manifest_path_override: str | None = None,
    redis_url_override: str | None = None,
) -> dict[str, Any]:
    """Compute next recommended concept using verified DQN checkpoint or transparent fallback."""
    state_24d = get_learner_state_24d(
        db,
        user_id,
        redis_url_override=redis_url_override,
    )
    concepts = db.scalars(select(ConceptModel).order_by(ConceptModel.action_id)).all()
    concept_by_id = {c.action_id: c for c in concepts}

    # Check if all 12 concepts are mastered (>= 0.75)
    if all(m >= PASS_THRESHOLD for m in state_24d.mastery):
        log_entry = RecommendationLogModel(
            id=uuid.uuid4(),
            user_id=user_id,
            state_version=state_24d.state_version,
            recommended_action_id=None,
            policy_source="completed",
            state_source=state_24d.state_source,
            guardrail_applied=False,
            checkpoint_sha256=None,
            created_at=datetime.now(UTC),
        )
        db.add(log_entry)
        db.commit()
        return {
            "status": "completed",
            "recommended_concept": None,
            "policy_source": "completed",
            "state_source": state_24d.state_source,
            "guardrail_applied": False,
            "degraded": state_24d.state_source == "postgres_fallback",
            "checkpoint_sha256": None,
            "state_version": state_24d.state_version,
            "observation_24d": state_24d.observation_24d,
            "q_values": None,
        }

    eligible_indices = [i for i, flag in enumerate(state_24d.is_eligible) if flag > 0.5]
    if not eligible_indices:
        eligible_indices = [0]

    ckpt: VerifiedDqnCheckpoint | None = load_verified_dqn_checkpoint(
        checkpoint_path_override=checkpoint_path_override,
        manifest_path_override=manifest_path_override,
    )

    raw_action_id: int | None = None
    q_values_list: list[float] | None = None
    q_vals: np.ndarray | None = None
    strategy: RecommendationStrategy

    if ckpt is not None:
        q_vals = ckpt.compute_q_values(state_24d.observation_24d)
        q_values_list = [round(float(x), 4) for x in q_vals]
        raw_action_id = int(np.argmax(q_vals))

        # Select concrete strategy: Direct DQN or Guardrailed Q-Masking
        if raw_action_id in eligible_indices:
            strategy = DqnDirectStrategy()
        else:
            strategy = DqnMaskedQStrategy()

        decision = strategy.select_action(q_vals, eligible_indices)
        selected_action_id = decision.action_id
        policy_source = decision.policy_source
        guardrail_applied = decision.guardrail_applied
        ckpt_sha: str | None = ckpt.sha256
        degraded = state_24d.state_source == "postgres_fallback"
    else:
        # Fallback Strategy
        strategy = DagTierFallbackStrategy()
        decision = strategy.select_action(None, eligible_indices)
        selected_action_id = decision.action_id
        policy_source = decision.policy_source
        guardrail_applied = decision.guardrail_applied
        ckpt_sha = None
        degraded = True

    rec_concept = concept_by_id[selected_action_id]
    log_entry = RecommendationLogModel(
        id=uuid.uuid4(),
        user_id=user_id,
        state_version=state_24d.state_version,
        recommended_action_id=selected_action_id,
        policy_source=policy_source,
        state_source=state_24d.state_source,
        guardrail_applied=guardrail_applied,
        checkpoint_sha256=ckpt_sha,
        created_at=datetime.now(UTC),
    )
    db.add(log_entry)
    db.commit()

    return {
        "status": "active",
        "recommended_concept": {
            "action_id": rec_concept.action_id,
            "slug": rec_concept.slug,
            "title": rec_concept.title,
            "tier": rec_concept.tier,
            "mastery_score": state_24d.mastery[selected_action_id],
        },
        "raw_action_id": raw_action_id,
        "policy_source": policy_source,
        "state_source": state_24d.state_source,
        "guardrail_applied": guardrail_applied,
        "degraded": degraded,
        "checkpoint_sha256": ckpt_sha,
        "state_version": state_24d.state_version,
        "observation_24d": state_24d.observation_24d,
        "q_values": q_values_list,
    }
