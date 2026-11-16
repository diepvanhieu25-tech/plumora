"""Argon2id password hashing, JWT signing/verifying, and Session extraction."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Request, Response
from sqlalchemy.orm import Session

from app.config import resolve_jwt_secret, settings
from app.db.models import UserModel

password_hasher = PasswordHasher()
JWT_SECRET = resolve_jwt_secret()
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 12


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


def set_auth_cookie(response: Response, token: str) -> None:
    """Set secure HttpOnly session cookie."""
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
