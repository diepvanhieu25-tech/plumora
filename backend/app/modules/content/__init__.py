"""Content & Multi-Domain Knowledge Graph domain package (lazy exports)."""

from __future__ import annotations

from importlib import import_module
from typing import Any

_EXPORTS: dict[str, tuple[str, str]] = {
    "content_router": ("app.modules.content.router_v2", "router"),
    "expert_router": ("app.modules.content.router_expert", "router"),
    "init_db_and_seed": ("app.modules.content.seed_loader", "init_db_and_seed"),
}


def __getattr__(name: str) -> Any:
    if name in _EXPORTS:
        mod_path, attr = _EXPORTS[name]
        return getattr(import_module(mod_path), attr)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = list(_EXPORTS.keys())
