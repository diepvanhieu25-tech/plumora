"""Pydantic request/response schemas for Authentication (D-11, PL-AUTH-01)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.db.models import UserModel


class RegisterRequest(BaseModel):
    """Learner registration payload (D-11)."""

    username: str = Field(..., min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$")
    display_name: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    """Learner login payload (D-11)."""

    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)


def serialize_user(user: UserModel) -> dict[str, Any]:
    """Serialize UserModel without password_hash."""
    return {
        "id": str(user.id),
        "username": user.username,
        "display_name": user.display_name,
        "state_version": user.state_version,
    }
