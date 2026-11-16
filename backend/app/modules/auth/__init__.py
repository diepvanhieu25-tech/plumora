"""Auth module public interface and backward compatibility layer."""

from __future__ import annotations

from app.modules.auth.router import router
from app.modules.auth.schemas import LoginRequest, RegisterRequest, serialize_user
from app.modules.auth.security import (
    create_access_token,
    extract_current_user,
    hash_password,
    verify_password,
)
from app.modules.auth.service import (
    DEMO_PASSWORD,
    PRESET_MASTERY_MAPS,
    apply_preset_to_user_in_tx,
)

__all__ = [
    "DEMO_PASSWORD",
    "PRESET_MASTERY_MAPS",
    "LoginRequest",
    "RegisterRequest",
    "apply_preset_to_user_in_tx",
    "create_access_token",
    "extract_current_user",
    "hash_password",
    "router",
    "serialize_user",
    "verify_password",
]
