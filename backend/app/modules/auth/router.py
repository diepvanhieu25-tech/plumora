"""FastAPI HTTP endpoints for user authentication (PL-AUTH-01, D-11, PL3-ROLE-01)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.db.models import DbSession, UserModel
from app.modules.auth.schemas import LoginRequest, RegisterRequest, serialize_user
from app.modules.auth.security import (
    create_access_token,
    extract_all_raw_tokens,
    extract_current_user,
    hash_password,
    revoke_token,
    set_auth_cookie,
    verify_password,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def write_through_state_cache(*_args: object, **_kwargs: object) -> None:
    """Retired v1 state-cache hook retained only as an uncalled no-op symbol for C01 regression tests."""


@router.post("/register")
def register_user(
    payload: RegisterRequest,
    db: DbSession,
) -> JSONResponse:
    """Register a new learner account strictly inside auth_svc.users (PL-AUTH-01, Decision A1)."""
    existing = db.scalar(select(UserModel).where(UserModel.username == payload.username))
    if existing is not None:
        return JSONResponse(
            status_code=409,
            content={
                "error_code": "USERNAME_TAKEN",
                "message": "Tên đăng nhập này đã tồn tại trong hệ thống.",
                "details": {"username": payload.username},
            },
        )

    user = UserModel(
        id=uuid.uuid4(),
        username=payload.username,
        display_name=payload.display_name,
        password_hash=hash_password(payload.password),
        state_version=1,
    )
    try:
        db.add(user)
        db.commit()
    except IntegrityError:
        db.rollback()
        return JSONResponse(
            status_code=409,
            content={
                "error_code": "USERNAME_TAKEN",
                "message": "Tên đăng nhập này đã tồn tại trong hệ thống.",
                "details": {"username": payload.username},
            },
        )

    db.refresh(user)
    token = create_access_token(user.id, user.username, role=user.role)
    res = JSONResponse(
        status_code=201,
        content={"user": serialize_user(user), "access_token": token},
    )
    set_auth_cookie(res, token)
    return res


@router.post("/login")
def login_user(
    payload: LoginRequest,
    db: DbSession,
) -> JSONResponse:
    """Authenticate an account using Argon2id and issue HttpOnly session cookie."""
    user = db.scalar(select(UserModel).where(UserModel.username == payload.username))
    if user is None or not verify_password(payload.password, user.password_hash):
        return JSONResponse(
            status_code=401,
            content={
                "error_code": "INVALID_CREDENTIALS",
                "message": "Tên đăng nhập hoặc mật khẩu không chính xác.",
                "details": {},
            },
        )

    user_role = getattr(user, "role", "learner")
    if payload.portal == "admin" and user_role != "admin":
        return JSONResponse(
            status_code=403,
            content={
                "error_code": "FORBIDDEN_ROLE",
                "message": "Tài khoản không có quyền truy cập Cổng Quản trị (Admin).",
                "details": {"role": user_role, "portal": payload.portal},
            },
        )
    if payload.portal == "expert" and user_role not in ("expert", "admin"):
        return JSONResponse(
            status_code=403,
            content={
                "error_code": "FORBIDDEN_ROLE",
                "message": "Tài khoản không có quyền truy cập Cổng Chuyên gia (Expert).",
                "details": {"role": user_role, "portal": payload.portal},
            },
        )
    if payload.portal == "learner" and user_role != "learner":
        return JSONResponse(
            status_code=403,
            content={
                "error_code": "FORBIDDEN_ROLE",
                "message": "Tài khoản Quản trị/Chuyên gia vui lòng đăng nhập tại cổng riêng (/backoffice/login).",
                "details": {"role": user_role, "portal": payload.portal},
            },
        )

    token = create_access_token(user.id, user.username, role=user.role)
    res = JSONResponse(
        status_code=200,
        content={"user": serialize_user(user), "access_token": token},
    )
    set_auth_cookie(res, token)
    return res


@router.post("/logout")
def logout_user(
    request: Request,
    db: DbSession,
) -> JSONResponse:
    """Revoke the JWT token (Redis JTI blocklist + local fallback) and clear session cookies."""
    user = extract_current_user(request, db)
    if user is None:
        return JSONResponse(
            status_code=401,
            content={
                "error_code": "AUTH_REQUIRED",
                "message": "Vui lòng đăng nhập để thực hiện thao tác này.",
                "details": {},
            },
        )
    for token in extract_all_raw_tokens(request):
        revoke_token(token)
    res = JSONResponse(status_code=200, content={"logged_out": True})
    res.delete_cookie(
        key=settings.effective_session_cookie_name,
        path="/",
        secure=settings.cookie_secure,
        httponly=True,
        samesite="lax",
    )
    res.delete_cookie(key="plumora_session", path="/", httponly=True, samesite="lax")
    res.delete_cookie(
        key="__Host-plumora_session",
        path="/",
        secure=True,
        httponly=True,
        samesite="lax",
    )
    return res


@router.get("/me")
def get_me(
    request: Request,
    db: DbSession,
) -> JSONResponse:
    """Return the authenticated user profile or 401 AUTH_REQUIRED."""
    user = extract_current_user(request, db)
    if user is None:
        return JSONResponse(
            status_code=401,
            content={
                "error_code": "AUTH_REQUIRED",
                "message": "Phiên làm việc chưa xác thực hoặc đã hết hạn.",
                "details": {},
            },
        )
    return JSONResponse(status_code=200, content=serialize_user(user))
