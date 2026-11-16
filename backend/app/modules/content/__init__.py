"""Content module public interface and backward compatibility layer."""

from __future__ import annotations

from app.modules.content.dag_engine import build_roadmap_payload
from app.modules.content.router import router
from app.modules.content.seed_loader import SEED_FILE_PATH, SEED_USERS, init_db_and_seed

__all__ = [
    "SEED_FILE_PATH",
    "SEED_USERS",
    "build_roadmap_payload",
    "init_db_and_seed",
    "router",
]
