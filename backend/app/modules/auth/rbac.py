"""Backward-compatible re-export of RBAC dependencies from app.dependencies.auth."""

from app.dependencies.auth import require_authenticated_roles, require_roles

__all__ = ["require_authenticated_roles", "require_roles"]
