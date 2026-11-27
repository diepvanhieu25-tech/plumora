"""SQLAlchemy DeclarativeBase for all Plumora bounded-context ORM models."""

from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base declarative class for all Plumora PostgreSQL tables."""
