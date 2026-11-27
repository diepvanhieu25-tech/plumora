"""Centralized FastAPI dependencies for database sessions, authentication, and RBAC."""

from app.dependencies.auth import (
    CurrentUser,
    get_current_user,
    require_authenticated_roles,
    require_internal_service,
    require_roles,
)
from app.dependencies.db import DbSession, get_db

__all__ = [
    "CurrentUser",
    "DbSession",
    "get_current_user",
    "get_db",
    "require_authenticated_roles",
    "require_internal_service",
    "require_roles",
]
