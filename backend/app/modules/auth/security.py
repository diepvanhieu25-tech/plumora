"""Argon2id password hashing, JWT signing/verifying, and Session extraction."""

from __future__ import annotations

import logging
import time
import uuid
from datetime import UTC, datetime, timedelta

import jwt
import redis
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Request, Response
from sqlalchemy.orm import Session

from app.config import resolve_jwt_secret, settings
from app.db.models import UserModel

logger = logging.getLogger(__name__)
password_hasher = PasswordHasher()
JWT_SECRET = resolve_jwt_secret(settings)
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 12

# In-memory fallback blocklist (jti -> exp epoch) used when Redis is unavailable.
_LOCAL_REVOKED_JTIS: dict[str, int] = {}


def _revoked_jti_key(jti: str) -> str:
    return f"plumora:revoked_jti:{jti}"


def _open_redis() -> redis.Redis:
    return redis.Redis.from_url(
        settings.redis_url,
        socket_connect_timeout=0.3,
        socket_timeout=0.3,
        decode_responses=True,
    )


def _prune_local_revoked() -> None:
    now_ts = int(time.time())
    expired = [k for k, exp_ts in _LOCAL_REVOKED_JTIS.items() if exp_ts <= now_ts]
    for k in expired:
        _LOCAL_REVOKED_JTIS.pop(k, None)


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
    """Issue an HS256 JWT token with unique jti for revocation support."""
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "username": username,
        "jti": str(uuid.uuid4()),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=TOKEN_EXPIRE_HOURS)).timestamp()),
    }
    return str(jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM))


def extract_raw_token(request: Request) -> str | None:
    """Extract raw JWT token from Cookie or Authorization Bearer header."""
    token = (
        request.cookies.get(settings.effective_session_cookie_name)
        or request.cookies.get("plumora_session")
        or request.cookies.get("__Host-plumora_session")
    )
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.removeprefix("Bearer ").strip()
    return token or None


def extract_all_raw_tokens(request: Request) -> list[str]:
    """Extract all distinct raw JWT tokens present across Cookies and Authorization header."""
    tokens: list[str] = []
    for key in (
        settings.effective_session_cookie_name,
        "plumora_session",
        "__Host-plumora_session",
    ):
        val = request.cookies.get(key)
        if val and val not in tokens:
            tokens.append(val)
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        bearer = auth_header.removeprefix("Bearer ").strip()
        if bearer and bearer not in tokens:
            tokens.append(bearer)
    return tokens


def revoke_token(token: str) -> None:
    """Revoke a JWT token by storing its jti in Redis (with TTL) and local fallback."""
    try:
        decoded = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return
    jti = decoded.get("jti")
    if not jti:
        return
    jti_str = str(jti)
    now_ts = int(time.time())
    exp_ts = int(decoded.get("exp", now_ts + TOKEN_EXPIRE_HOURS * 3600))
    ttl = max(1, exp_ts - now_ts)

    _prune_local_revoked()
    _LOCAL_REVOKED_JTIS[jti_str] = exp_ts

    client = _open_redis()
    try:
        client.set(_revoked_jti_key(jti_str), "1", ex=ttl)
    except (redis.RedisError, OSError) as exc:
        logger.warning("Redis JTI revocation write failed (using local fallback): %s", exc)
    finally:
        client.close()


def is_jti_revoked(jti: str) -> bool:
    """Check whether a JWT jti has been revoked via logout."""
    now_ts = int(time.time())
    local_exp = _LOCAL_REVOKED_JTIS.get(jti)
    if local_exp is not None:
        if local_exp > now_ts:
            return True
        _LOCAL_REVOKED_JTIS.pop(jti, None)

    client = _open_redis()
    try:
        return bool(client.exists(_revoked_jti_key(jti)))
    except (redis.RedisError, OSError):
        return False
    finally:
        client.close()


def set_auth_cookie(response: Response, token: str) -> None:
    """Set secure HttpOnly session cookie."""
    response.set_cookie(
        key=settings.effective_session_cookie_name,
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        max_age=TOKEN_EXPIRE_HOURS * 3600,
        path="/",
    )


def extract_current_user(request: Request, db: Session) -> UserModel | None:
    """Extract and verify authenticated UserModel from Cookie or Authorization Bearer header."""
    token = extract_raw_token(request)
    if not token:
        return None
    try:
        decoded = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        jti = decoded.get("jti")
        if jti and is_jti_revoked(str(jti)):
            return None
        user_id = uuid.UUID(str(decoded["sub"]))
    except (jwt.PyJWTError, ValueError, KeyError):
        return None
    return db.get(UserModel, user_id)
