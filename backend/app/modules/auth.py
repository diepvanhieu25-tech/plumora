"""Authentication, Argon2id password hashing, JWT/Cookie sessions, and Demo Presets (D-11)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import resolve_jwt_secret, settings
from app.db.models import DbSession, UserConceptMasteryModel, UserModel
from app.db.redis_store import PASS_THRESHOLD, write_through_state_cache

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
password_hasher = PasswordHasher()
JWT_SECRET = resolve_jwt_secret()
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 12

DEMO_PASSWORD = "PlumoraDemo#2026"

PRESET_MASTERY_MAPS: dict[str, dict[int, float]] = {
    "new_learner": {i: 0.0 for i in range(12)},
    "foundation_ready": {
        0: 1.00,  # net-internet
        1: 0.75,  # os-basics
        2: 0.75,  # web-http
        3: 0.75,  # db-relational
        4: 0.00,  # db-transactions (Unlocked, DQN target)
        5: 0.25,  # db-nosql (Unlocked, in-progress)
        6: 0.00,  # api-rest (Unlocked)
        7: 0.00,
        8: 0.00,
        9: 0.00,
        10: 0.00,
        11: 0.00,
    },
    "api_stage_ready": {
        0: 1.00,
        1: 1.00,
        2: 1.00,
        3: 1.00,
        4: 0.75,
        5: 0.75,
        6: 0.75,
        7: 0.00,  # api-validation (Unlocked)
        8: 0.00,  # api-data (Unlocked)
        9: 0.00,  # cache-redis (Unlocked)
        10: 0.00,
        11: 0.00,
    },
}


class RegisterRequest(BaseModel):
    """Learner registration payload (D-11)."""

    username: str = Field(..., min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$")
    display_name: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    """Learner login payload (D-11)."""

    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)


def hash_password(plain_password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return str(password_hasher.hash(plain_password))


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Verify a plaintext password against an Argon2id hash."""
    try:
        return bool(password_hasher.verify(password_hash, plain_password))
    except (VerifyMismatchError, ValueError):
        return False


def create_access_token(user_id: uuid.UUID, username: str) -> str:
    """Issue an HS256 JWT token for the authenticated learner."""
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "username": username,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=TOKEN_EXPIRE_HOURS)).timestamp()),
    }
    return str(jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM))


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        samesite="lax",
        secure=(settings.app_env == "production"),
        max_age=TOKEN_EXPIRE_HOURS * 3600,
        path="/",
    )


def extract_current_user(request: Request, db: Session) -> UserModel | None:
    """Extract and verify authenticated UserModel from Cookie or Authorization Bearer header."""
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.removeprefix("Bearer ").strip()
    if not token:
        return None
    try:
        decoded = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = uuid.UUID(str(decoded["sub"]))
    except (jwt.PyJWTError, ValueError, KeyError):
        return None
    return db.get(UserModel, user_id)


def apply_preset_to_user_in_tx(
    db: Session,
    user: UserModel,
    preset_key: str,
) -> None:
    """Apply one of the 3 preset mastery maps to user inside the active DB transaction."""
    mastery_map = PRESET_MASTERY_MAPS[preset_key]
    existing_rows = db.scalars(
        select(UserConceptMasteryModel).where(UserConceptMasteryModel.user_id == user.id)
    ).all()
    by_action = {r.concept_action_id: r for r in existing_rows}
    now = datetime.now(UTC)
    for action_id in range(12):
        score = float(mastery_map.get(action_id, 0.0))
        is_mastered = score >= PASS_THRESHOLD
        if action_id in by_action:
            row = by_action[action_id]
            row.mastery_score = score
            row.is_mastered = is_mastered
            row.updated_at = now
        else:
            db.add(
                UserConceptMasteryModel(
                    user_id=user.id,
                    concept_action_id=action_id,
                    mastery_score=score,
                    is_mastered=is_mastered,
                    updated_at=now,
                )
            )


def serialize_user(user: UserModel) -> dict[str, Any]:
    """Serialize UserModel without password_hash."""
    return {
        "id": str(user.id),
        "username": user.username,
        "display_name": user.display_name,
        "state_version": user.state_version,
    }


@router.post("/register")
def register_user(
    payload: RegisterRequest,
    db: DbSession,
) -> JSONResponse:
    """Register a new learner account with 12 initialized mastery=0.0 rows (PL-AUTH-01)."""
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
    db.add(user)
    db.flush()
    apply_preset_to_user_in_tx(db, user, "new_learner")
    db.commit()
    db.refresh(user)
    write_through_state_cache(db, user.id)

    token = create_access_token(user.id, user.username)
    res = JSONResponse(
        status_code=201,
        content={"user": serialize_user(user), "access_token": token},
    )
    _set_auth_cookie(res, token)
    return res


@router.post("/login")
def login_user(
    payload: LoginRequest,
    db: DbSession,
) -> JSONResponse:
    """Authenticate a learner account using Argon2id and issue HttpOnly session cookie."""
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

    write_through_state_cache(db, user.id)
    token = create_access_token(user.id, user.username)
    res = JSONResponse(
        status_code=200,
        content={"user": serialize_user(user), "access_token": token},
    )
    _set_auth_cookie(res, token)
    return res


@router.post("/logout")
def logout_user(
    request: Request,
    db: DbSession,
) -> JSONResponse:
    """Clear the authenticated learner session cookie."""
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
    res = JSONResponse(status_code=200, content={"logged_out": True})
    res.delete_cookie(key=settings.session_cookie_name, path="/")
    return res


@router.get("/me")
def get_me(
    request: Request,
    db: DbSession,
) -> JSONResponse:
    """Return the authenticated learner profile or 401 AUTH_REQUIRED."""
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
