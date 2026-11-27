"""Plumora v4.2 baseline schema & isolated 4-schema migration with full downgrade support.

Revision ID: 0001_v4_baseline
Revises:
Create Date: 2026-11-28
"""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import text

import app.db.models  # noqa: F401
from alembic import op
from app.db.base import Base
from app.db.migrations import run_database_migrations_on_connection

revision: str = "0001_v4_baseline"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create all Plumora v4.2 tables, performance indexes, and 4 isolated PostgreSQL schemas."""
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)
    run_database_migrations_on_connection(bind)


def downgrade() -> None:
    """Roll back all Plumora v4.2 tables and schemas cleanly."""
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for schema in ("rec_ai_svc", "assess_svc", "content_svc", "auth_svc"):
            bind.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE;"))
        bind.execute(text("DROP TABLE IF EXISTS schema_migrations CASCADE;"))
    Base.metadata.drop_all(bind=bind)
    if bind.dialect.name == "sqlite":
        bind.execute(text("DROP TABLE IF EXISTS schema_migrations;"))
