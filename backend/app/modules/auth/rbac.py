"""RBAC 3-Role Security Guard (learner / expert / admin) per PL3-ROLE-01."""

from __future__ import annotations

from collections.abc import Callable

from fastapi import HTTPException, Request, status

from app.db.models import DbSession, UserModel
from app.modules.auth import extract_current_user


def require_authenticated_roles(
    request: Request,
    db: DbSession,
    allowed_roles: tuple[str, ...],
) -> UserModel:
    """Authenticate user and enforce RBAC role membership (401 or 403 FORBIDDEN_ROLE)."""
    user = extract_current_user(request, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error_code": "AUTH_REQUIRED", "message": "Authentication is required."},
        )
    user_role = getattr(user, "role", "learner")
    if user_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error_code": "FORBIDDEN_ROLE",
                "message": f"Role '{user_role}' is not authorized for this resource.",
            },
        )
    return user


def require_roles(*allowed_roles: str) -> Callable[[Request, DbSession], UserModel]:
    """FastAPI Depends() factory enforcing RBAC before request body validation (F-G3-12)."""

    def _dependency(request: Request, db: DbSession) -> UserModel:
        return require_authenticated_roles(request, db, allowed_roles)

    return _dependency
