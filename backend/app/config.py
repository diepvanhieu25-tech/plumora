"""Configuration settings for Plumora FastAPI Modular Monolith."""

from __future__ import annotations

import logging
import os
import secrets
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)
REPO_ROOT = Path(__file__).resolve().parents[2]


def resolve_jwt_secret() -> str:
    """Resolve JWT secret safely without hardcoded fallback literals."""
    env_secret = os.getenv("JWT_SECRET_KEY", "").strip()
    if env_secret:
        return env_secret
    secret_file = Path("jwt_secret.txt")
    if secret_file.exists():
        file_secret = secret_file.read_text(encoding="utf-8").strip()
        if file_secret:
            return file_secret
    if os.getenv("APP_ENV") == "production":
        raise RuntimeError("JWT_SECRET_KEY must be set in production environment.")
    logger.warning("Generating ephemeral secret for development/testing. Instance-isolated!")
    return secrets.token_hex(32)


class Settings(BaseSettings):
    """Application settings loaded from environment variables or .env.local."""

    model_config = SettingsConfigDict(
        env_file=("../.env.local", ".env.local", "../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    api_host: str = "127.0.0.1"
    api_port: int = 8000
    frontend_origin: str = "http://127.0.0.1:5173"

    database_url: str = (
        "postgresql+psycopg://plumora_app:plumora_dev_pass_local_only@127.0.0.1:5432/plumora_dev"
    )
    redis_url: str = "redis://127.0.0.1:6379/0"
    redis_state_ttl_seconds: int = 3600

    session_cookie_name: str = "__Host-plumora_session"
    rl_checkpoint_path: str = str(REPO_ROOT / "rl" / "artifacts" / "checkpoint.zip")
    rl_manifest_path: str = str(REPO_ROOT / "rl" / "artifacts" / "manifest.json")


settings = Settings()
