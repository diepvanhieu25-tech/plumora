"""Auth module public interface (lazy exports to prevent circular imports)."""

from __future__ import annotations

from importlib import import_module
from typing import Any

_EXPORTS: dict[str, tuple[str, str]] = {
    "DEMO_PASSWORD": ("app.modules.auth.service", "DEMO_PASSWORD"),
    "PRESET_COMPETENCY_MAPS": ("app.modules.auth.service", "PRESET_COMPETENCY_MAPS"),
    "LoginRequest": ("app.modules.auth.schemas", "LoginRequest"),
    "RegisterRequest": ("app.modules.auth.schemas", "RegisterRequest"),
    "create_access_token": ("app.modules.auth.security", "create_access_token"),
    "extract_current_user": ("app.modules.auth.security", "extract_current_user"),
    "hash_password": ("app.modules.auth.security", "hash_password"),
    "router": ("app.modules.auth.router", "router"),
    "serialize_user": ("app.modules.auth.schemas", "serialize_user"),
    "verify_password": ("app.modules.auth.security", "verify_password"),
}


def __getattr__(name: str) -> Any:
    if name in _EXPORTS:
        mod_path, attr = _EXPORTS[name]
        return getattr(import_module(mod_path), attr)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = list(_EXPORTS.keys())
