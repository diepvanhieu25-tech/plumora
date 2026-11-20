"""Transactional Outbox, Redis Streams Publisher, and Idempotent Consumer (PL3-ARCH-01)."""

from __future__ import annotations

import json
import time
import uuid
from datetime import UTC, datetime
from typing import Any, cast

import redis
from sqlalchemy import select
from sqlalchemy.exc import DataError, SQLAlchemyError
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
            commit_ts_ms = int((ev.created_at or datetime.now(UTC)).timestamp() * 1000)
            client.xadd(
                ev.stream_name,
                {
                    "event_id": str(ev.event_id),
                    "event_type": ev.event_type,
                    "db_commit_ts_ms": str(commit_ts_ms),
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
            obs_before_json=payload.get("obs_before", {}),
            obs_after_json=payload.get("obs_after", {}),
        )
    )
    db.commit()
    return True


def consume_competency_stream_once(
    db: Session,
    *,
    redis_url_override: str | None = None,
    consumer_group: str = "rec_ai_cg",
    consumer_name: str = "worker-1",
    stream_name: str = "plumora:competency_events",
    min_idle_ms: int = 1000,
) -> dict[str, int]:
    """Reclaim idle pending messages and consume new CompetencyUpdatedEvent messages via XREADGROUP."""
    consumed = 0
    acked = 0
    reclaimed = 0
    dlq = 0
    transient_errors = 0
    dlq_stream = f"{stream_name}:dlq"

    client: redis.Redis = redis.Redis.from_url(
        redis_url_override or settings.redis_url,
        socket_connect_timeout=0.5,
        socket_timeout=0.5,
        decode_responses=True,
    )
    try:
        try:
            client.xgroup_create(stream_name, consumer_group, id="0", mkstream=True)
        except redis.ResponseError as exc:
            if "BUSYGROUP" not in str(exc):
                raise

        client.set(f"plumora:worker:{consumer_group}", "alive", ex=15)

        def _process_messages(messages: list[tuple[str, dict[str, Any]]]) -> None:
            nonlocal consumed, acked, dlq, transient_errors
            for msg_id, fields in messages:
                try:
                    ev_type = str(fields.get("event_type", ""))
                    ev_id_raw = str(fields.get("event_id", ""))
                    payload_raw = str(fields.get("payload", "{}"))
                    if ev_type == "CompetencyUpdatedEvent" and ev_id_raw:
                        payload_dict = json.loads(payload_raw)
                        if not isinstance(payload_dict, dict):
                            raise ValueError("Payload must be a JSON object")
                        inserted = consume_competency_event_idempotent(
                            db,
                            uuid.UUID(ev_id_raw),
                            payload_dict,
                            consumer_group=consumer_group,
                        )
                        if inserted:
                            consumed += 1
                            db_ts_raw = fields.get("db_commit_ts_ms")
                            ref_ts_ms: int | None = None
                            if db_ts_raw is not None:
                                ref_ts_ms = int(str(db_ts_raw))
                            elif "-" in str(msg_id):
                                ref_ts_ms = int(str(msg_id).split("-", 1)[0])
                            if ref_ts_ms is not None:
                                c2c_ms = max(0.0, time.time() * 1000.0 - ref_ts_ms)
                                client.set("plumora:metrics:last_commit_to_consume_ms", f"{c2c_ms:.2f}", ex=300)
                                client.lpush("plumora:metrics:commit_to_consume_samples", f"{c2c_ms:.2f}")
                                client.ltrim("plumora:metrics:commit_to_consume_samples", 0, 199)
                                client.expire("plumora:metrics:commit_to_consume_samples", 3600)
                    client.xack(stream_name, consumer_group, msg_id)
                    acked += 1
                except (json.JSONDecodeError, ValueError, KeyError, TypeError, DataError) as exc:
                    db.rollback()
                    client.xadd(
                        dlq_stream,
                        {
                            "original_msg_id": str(msg_id),
                            "reason": "poison_payload_or_schema",
                            "error_type": type(exc).__name__,
                            "error": str(exc)[:300],
                            "raw_fields": json.dumps(fields, default=str)[:2000],
                        },
                        maxlen=1000,
                        approximate=True,
                    )
                    client.xack(stream_name, consumer_group, msg_id)
                    dlq += 1
                except (SQLAlchemyError, redis.RedisError, OSError, TimeoutError, ConnectionError):
                    # Transient DB/infra error: leave pending in PEL for xautoclaim retry, never DLQ
                    db.rollback()
                    transient_errors += 1

        # 1. Recover pending messages from crashed consumers (idle >= min_idle_ms)
        try:
            claimed_raw = client.xautoclaim(
                stream_name,
                consumer_group,
                consumer_name,
                min_idle_time=min_idle_ms,
                start_id="0-0",
                count=50,
            )
            if isinstance(claimed_raw, (list, tuple)) and len(claimed_raw) >= 2:
                reclaimed_msgs = cast(list[tuple[str, dict[str, Any]]], claimed_raw[1] or [])
                reclaimed = len(reclaimed_msgs)
                if reclaimed_msgs:
                    _process_messages(reclaimed_msgs)
        except redis.ResponseError:
            pass

        # 2. Read new messages delivered to this consumer group
        raw_entries = client.xreadgroup(
            groupname=consumer_group,
            consumername=consumer_name,
            streams={stream_name: ">"},
            count=50,
            block=1,
        )
        entries = cast(
            list[tuple[str, list[tuple[str, dict[str, Any]]]]],
            raw_entries or [],
        )
        for _sname, messages in entries:
            _process_messages(messages)
    except redis.RedisError:
        pass
    finally:
        client.close()

    return {
        "consumed": consumed,
        "acked": acked,
        "reclaimed": reclaimed,
        "dlq": dlq,
        "transient_errors": transient_errors,
    }


def run_outbox_relay_and_consume_once(
    db: Session,
    *,
    redis_url_override: str | None = None,
    consumer_group: str = "rec_ai_cg",
    consumer_name: str = "worker-1",
    stream_name: str = "plumora:competency_events",
    min_idle_ms: int = 1000,
) -> dict[str, int]:
    """Monolith convenience helper: relay pending outbox events and consume Redis Streams."""
    relayed = relay_pending_outbox_events(db, redis_url_override=redis_url_override)
    stats = consume_competency_stream_once(
        db,
        redis_url_override=redis_url_override,
        consumer_group=consumer_group,
        consumer_name=consumer_name,
        stream_name=stream_name,
        min_idle_ms=min_idle_ms,
    )
    return {"relayed": relayed, **stats}
