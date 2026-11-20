"""Pydantic request/response schemas for Authentication (D-11, PL-AUTH-01)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.db.models import UserModel


class RegisterRequest(BaseModel):
    """Learner registration payload (D-11)."""

    username: str = Field(..., min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$")
    display_name: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Tên hiển thị không được để trống.")
        if "<" in cleaned or ">" in cleaned:
            raise ValueError("Tên hiển thị không được chứa ký tự HTML (< hoặc >).")
        return cleaned


class LoginRequest(BaseModel):
    """Portal-aware login payload (D-11, PL3-ROLE-01)."""

    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)
    portal: Literal["learner", "expert", "admin"] = "learner"


def serialize_user(user: UserModel) -> dict[str, Any]:
    """Serialize UserModel without password_hash."""
    return {
        "id": str(user.id),
        "username": user.username,
        "display_name": user.display_name,
        "role": getattr(user, "role", "learner"),
        "state_version": user.state_version,
    }
