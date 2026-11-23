"""Explicit 3-Phase Unit of Work with PostgreSQL advisory lock support."""

from __future__ import annotations

import uuid
from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy import text
from sqlalchemy.orm import Session


class SqlAlchemyUnitOfWork:
    """Explicit Unit of Work separating read, slow external compute, and short atomic writes.

    Usage:
        # Phase 1: Read & validate (no DB locks, no db.commit())
        # Phase 2: Slow compute (Code Sandbox / LLM Rubric) outside any DB lock
        # Phase 3: Atomic write under per-user advisory lock
        with uow.atomic_user_mutation(user_id):
            ... # DB mutations + outbox event insert
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    @property
    def is_postgresql(self) -> bool:
        bind = self.db.get_bind()
        return bind is not None and bind.dialect.name == "postgresql"

    def acquire_user_lock(self, user_id: uuid.UUID) -> None:
        """Acquire a transaction-scoped advisory lock for user_id on PostgreSQL."""
        if self.is_postgresql:
            self.db.execute(
                text("SELECT pg_advisory_xact_lock(hashtext(:uid))"),
                {"uid": str(user_id)},
            )

    @contextmanager
    def atomic_user_mutation(self, user_id: uuid.UUID) -> Generator[Session, None, None]:
        """Execute user-scoped mutations atomically with per-user PostgreSQL advisory lock.

        Commits on normal exit and rolls back on any exception.
        """
        try:
            self.acquire_user_lock(user_id)
            yield self.db
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
