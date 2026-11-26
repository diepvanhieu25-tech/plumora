"""Auth module public interface."""

from __future__ import annotations

from app.modules.auth.router import router
from app.modules.auth.schemas import LoginRequest, RegisterRequest, serialize_user
from app.modules.auth.security import (
    create_access_token,
    extract_current_user,
    hash_password,
    verify_password,
)
from app.modules.auth.service import DEMO_PASSWORD, PRESET_COMPETENCY_MAPS

__all__ = [
    "DEMO_PASSWORD",
    "PRESET_COMPETENCY_MAPS",
    "LoginRequest",
    "RegisterRequest",
    "create_access_token",
    "extract_current_user",
    "hash_password",
    "router",
    "serialize_user",
    "verify_password",
]
