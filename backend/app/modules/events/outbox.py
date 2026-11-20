"""Transactional Outbox, Redis Streams Publisher, and Idempotent Consumer (PL3-ARCH-01)."""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from typing import Any

import redis
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import (
    ConsumedEventModel,
    OutboxEventModel,
    RlExperienceBufferModel,
)


def record_outbox_event_in_tx(
    db: Session,
    *,
    event_id: uuid.UUID | None = None,
    event_type: str,
    stream_name: str,
    payload: dict[str, Any],
) -> OutboxEventModel:
    """Insert an outbox event inside the active ACID database transaction."""
    ev_id = event_id if event_id is not None else uuid.uuid4()
    row = OutboxEventModel(
        id=uuid.uuid4(),
        event_id=ev_id,
        event_type=event_type,
        stream_name=stream_name,
        payload_json=payload,
        published_at=None,
    )
    db.add(row)
    return row


def relay_pending_outbox_events(
    db: Session,
    *,
    redis_url_override: str | None = None,
) -> int:
    """Relay unpublished outbox events to Redis Streams; safely leaves pending on outage."""
    pending = db.scalars(
        select(OutboxEventModel)
        .where(OutboxEventModel.published_at.is_(None))
        .order_by(OutboxEventModel.created_at)
    ).all()
    if not pending:
        return 0

    client: redis.Redis = redis.Redis.from_url(
        redis_url_override or settings.redis_url,
        socket_connect_timeout=0.5,
        socket_timeout=0.5,
    )
    relayed = 0
    try:
        for ev in pending:
            client.xadd(
                ev.stream_name,
                {
                    "event_id": str(ev.event_id),
                    "event_type": ev.event_type,
                    "payload": json.dumps(ev.payload_json),
                },
                maxlen=10000,
                approximate=True,
            )
            ev.published_at = datetime.now(UTC)
            relayed += 1
        db.commit()
    except redis.RedisError:
        db.rollback()
    finally:
        client.close()
    return relayed


def consume_competency_event_idempotent(
    db: Session,
    event_id: uuid.UUID,
    payload: dict[str, Any],
    *,
    consumer_group: str = "rec_ai_cg",
) -> bool:
    """Idempotently consume a CompetencyUpdatedEvent into rl_experience_buffer.

    Returns True if inserted, False if duplicate event_id already consumed.
    """
    existing = db.get(ConsumedEventModel, event_id)
    if existing is not None:
        return False

    db.add(
        ConsumedEventModel(
            event_id=event_id,
            consumer_group=consumer_group,
            consumed_at=datetime.now(UTC),
        )
    )
    db.add(
        RlExperienceBufferModel(
            id=uuid.uuid4(),
            event_id=event_id,
            user_id=uuid.UUID(str(payload["user_id"])),
            domain_slug=str(payload["domain_slug"]),
            concept_slug=str(payload["concept_slug"]),
            action_mode=str(payload["action_mode"]),
            reward=float(payload["reward"]),
            obs_before_json=list(payload.get("obs_before", [])),
            obs_after_json=list(payload.get("obs_after", [])),
        )
    )
    db.commit()
    return True
