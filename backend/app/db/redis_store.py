"""Redis Read-Through / Write-Through 24-dim State Cache with Graceful Fallback (D-10)."""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass

import redis
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import (
    ConceptModel,
    ConceptPrerequisiteModel,
    UserConceptMasteryModel,
    UserModel,
)

logger = logging.getLogger(__name__)

PASS_THRESHOLD = 0.75
ACT_DIM = 12


@dataclass(frozen=True)
class LearnerState24D:
    """24-dimensional observation vector and provenance metadata for a learner."""

    user_id: uuid.UUID
    state_version: int
    mastery: list[float]
    is_eligible: list[float]
    observation_24d: list[float]
    state_source: str  # "redis_cache" | "postgres_cache_warm" | "postgres_fallback"


def compute_state_from_postgres(
    db: Session, user_id: uuid.UUID
) -> tuple[int, list[float], list[float]]:
    """Compute (state_version, mastery[12], is_eligible[12]) authoritatively from PostgreSQL."""
    user = db.get(UserModel, user_id)
    state_version = user.state_version if user is not None else 1

    mastery_rows = db.scalars(
        select(UserConceptMasteryModel).where(UserConceptMasteryModel.user_id == user_id)
    ).all()
    mastery_map: dict[int, float] = {
        row.concept_action_id: float(row.mastery_score) for row in mastery_rows
    }
    mastery = [round(mastery_map.get(i, 0.0), 4) for i in range(ACT_DIM)]

    prereq_rows = db.scalars(select(ConceptPrerequisiteModel)).all()
    prereqs_by_concept: dict[int, list[int]] = {i: [] for i in range(ACT_DIM)}
    for pr in prereq_rows:
        prereqs_by_concept.setdefault(pr.concept_action_id, []).append(pr.prereq_action_id)

    is_eligible: list[float] = []
    for i in range(ACT_DIM):
        if mastery[i] >= PASS_THRESHOLD:
            is_eligible.append(0.0)
        elif all(mastery[p] >= PASS_THRESHOLD for p in prereqs_by_concept.get(i, [])):
            is_eligible.append(1.0)
        else:
            is_eligible.append(0.0)

    return state_version, mastery, is_eligible


def _redis_key(user_id: uuid.UUID) -> str:
    return f"plumora:state:{user_id}"


def _open_redis_client(redis_url_override: str | None = None) -> redis.Redis:
    url = redis_url_override or settings.redis_url
    return redis.Redis.from_url(
        url,
        socket_connect_timeout=0.2,
        socket_timeout=0.2,
        decode_responses=True,
    )


def write_through_state_cache(
    db: Session,
    user_id: uuid.UUID,
    *,
    redis_url_override: str | None = None,
) -> None:
    """Write-through 24-dim state to Redis after PostgreSQL COMMIT (never fails the transaction)."""
    state_version, mastery, is_eligible = compute_state_from_postgres(db, user_id)
    obs_24d = mastery + is_eligible
    payload = {
        "state_version": state_version,
        "mastery": mastery,
        "is_eligible": is_eligible,
        "observation_24d": obs_24d,
    }
    client = _open_redis_client(redis_url_override)
    try:
        client.set(
            _redis_key(user_id),
            json.dumps(payload),
            ex=settings.redis_state_ttl_seconds,
        )
    except (redis.RedisError, OSError) as exc:
        logger.warning("Redis write-through failed for user %s: %s", user_id, exc)
        try:
            client.delete(_redis_key(user_id))
        except (redis.RedisError, OSError):
            pass
    finally:
        client.close()


def get_learner_state_24d(
    db: Session,
    user_id: uuid.UUID,
    *,
    redis_url_override: str | None = None,
) -> LearnerState24D:
    """Read 24-dim state from Redis if fresh; otherwise warm or fallback from PostgreSQL SSoT."""
    user = db.get(UserModel, user_id)
    pg_state_version = user.state_version if user is not None else 1

    client = _open_redis_client(redis_url_override)
    redis_alive = True
    try:
        raw = client.get(_redis_key(user_id))
        if isinstance(raw, str):
            data = json.loads(raw)
            if int(data.get("state_version", -1)) == pg_state_version:
                mastery = [float(x) for x in data["mastery"]]
                is_eligible = [float(x) for x in data["is_eligible"]]
                obs_24d = [float(x) for x in data["observation_24d"]]
                return LearnerState24D(
                    user_id=user_id,
                    state_version=pg_state_version,
                    mastery=mastery,
                    is_eligible=is_eligible,
                    observation_24d=obs_24d,
                    state_source="redis_cache",
                )
    except (redis.RedisError, OSError, ValueError, KeyError) as exc:
        redis_alive = False
        logger.warning(
            "Redis read failed for user %s, falling back to PostgreSQL: %s", user_id, exc
        )
    finally:
        client.close()

    # Reconstruct authoritatively from PostgreSQL SSoT
    state_version, mastery, is_eligible = compute_state_from_postgres(db, user_id)
    obs_24d = mastery + is_eligible

    if redis_alive:
        write_through_state_cache(db, user_id, redis_url_override=redis_url_override)
        source = "postgres_cache_warm"
    else:
        source = "postgres_fallback"

    return LearnerState24D(
        user_id=user_id,
        state_version=state_version,
        mastery=mastery,
        is_eligible=is_eligible,
        observation_24d=obs_24d,
        state_source=source,
    )


def get_missing_prerequisite_slugs(
    db: Session,
    user_id: uuid.UUID,
    concept_action_id: int,
) -> list[str]:
    """Return slugs of prerequisite concepts where learner mastery is < 0.75."""
    prereq_ids = db.scalars(
        select(ConceptPrerequisiteModel.prereq_action_id).where(
            ConceptPrerequisiteModel.concept_action_id == concept_action_id
        )
    ).all()
    if not prereq_ids:
        return []

    mastery_rows = db.scalars(
        select(UserConceptMasteryModel).where(
            UserConceptMasteryModel.user_id == user_id,
            UserConceptMasteryModel.concept_action_id.in_(prereq_ids),
        )
    ).all()
    mastery_map = {r.concept_action_id: float(r.mastery_score) for r in mastery_rows}
    missing_ids = [pid for pid in prereq_ids if mastery_map.get(pid, 0.0) < PASS_THRESHOLD]
    if not missing_ids:
        return []

    concepts = db.scalars(
        select(ConceptModel)
        .where(ConceptModel.action_id.in_(missing_ids))
        .order_by(ConceptModel.action_id)
    ).all()
    return [c.slug for c in concepts]
