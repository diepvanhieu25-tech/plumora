"""Authentication, RBAC, and internal service FastAPI dependencies."""

from __future__ import annotations

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from app.core.observability import emit_audit_event
from app.dependencies.db import DbSession
from app.modules.auth.models import UserModel
from app.modules.auth.security import extract_current_user, require_internal_service


def get_current_user(request: Request, db: DbSession) -> UserModel:
    """FastAPI dependency returning authenticated UserModel or raising 401 AUTH_REQUIRED."""
    user = extract_current_user(request, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error_code": "AUTH_REQUIRED",
                "message": "Authentication is required.",
            },
        )
    return user


CurrentUser = Annotated[UserModel, Depends(get_current_user)]


def require_authenticated_roles(
    request: Request,
    db: DbSession,
    allowed_roles: tuple[str, ...],
) -> UserModel:
    """Authenticate user and enforce RBAC role membership (401 or 403 FORBIDDEN_ROLE)."""
    user = get_current_user(request, db)
    user_role = getattr(user, "role", "learner")
    if user_role not in allowed_roles:
        emit_audit_event(
            action="auth.rbac_denied",
            actor_id=str(user.id),
            role=user_role,
            resource=request.url.path,
            outcome="denied",
            details={"allowed_roles": list(allowed_roles)},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error_code": "FORBIDDEN_ROLE",
                "message": f"Role '{user_role}' is not authorized for this resource.",
            },
        )
    return user


def require_roles(*allowed_roles: str) -> Callable[[Request, DbSession], UserModel]:
    """FastAPI Depends() factory enforcing RBAC before request body validation."""

    def _dependency(request: Request, db: DbSession) -> UserModel:
        return require_authenticated_roles(request, db, allowed_roles)

    return _dependency


__all__ = [
    "CurrentUser",
    "get_current_user",
    "require_authenticated_roles",
    "require_internal_service",
    "require_roles",
]
