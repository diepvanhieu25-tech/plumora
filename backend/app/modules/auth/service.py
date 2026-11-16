"""Authentication business service and preset state management (D-11)."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import UserConceptMasteryModel, UserModel
from app.db.redis_store import PASS_THRESHOLD

DEMO_PASSWORD = "PlumoraDemo#2026"

PRESET_MASTERY_MAPS: dict[str, dict[int, float]] = {
    "new_learner": {i: 0.0 for i in range(12)},
    "foundation_ready": {
        0: 1.00,  # net-internet
        1: 0.75,  # os-basics
        2: 0.75,  # web-http
        3: 0.75,  # db-relational
        4: 0.00,  # db-transactions (Unlocked, DQN target)
        5: 0.25,  # db-nosql (Unlocked, in-progress)
        6: 0.00,  # api-rest (Unlocked)
        7: 0.00,
        8: 0.00,
        9: 0.00,
        10: 0.00,
        11: 0.00,
    },
    "api_stage_ready": {
        0: 1.00,
        1: 1.00,
        2: 1.00,
        3: 1.00,
        4: 0.75,
        5: 0.75,
        6: 0.75,
        7: 0.00,  # api-validation (Unlocked)
        8: 0.00,  # api-data (Unlocked)
        9: 0.00,  # cache-redis (Unlocked)
        10: 0.00,
        11: 0.00,
    },
}


def apply_preset_to_user_in_tx(
    db: Session,
    user: UserModel,
    preset_key: str,
) -> None:
    """Apply one of the 3 preset mastery maps to user inside the active DB transaction."""
    mastery_map = PRESET_MASTERY_MAPS[preset_key]
    existing_rows = db.scalars(
        select(UserConceptMasteryModel).where(UserConceptMasteryModel.user_id == user.id)
    ).all()
    by_action = {r.concept_action_id: r for r in existing_rows}
    now = datetime.now(UTC)
    for action_id in range(12):
        score = float(mastery_map.get(action_id, 0.0))
        is_mastered = score >= PASS_THRESHOLD
        if action_id in by_action:
            row = by_action[action_id]
            row.mastery_score = score
            row.is_mastered = is_mastered
            row.updated_at = now
        else:
            db.add(
                UserConceptMasteryModel(
                    user_id=user.id,
                    concept_action_id=action_id,
                    mastery_score=score,
                    is_mastered=is_mastered,
                    updated_at=now,
                )
            )
