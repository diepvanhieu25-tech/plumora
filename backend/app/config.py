"""Configuration settings for Plumora FastAPI Modular Monolith."""

from __future__ import annotations

import logging
import secrets
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)
REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Application settings loaded from environment variables or .env.local."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env", ".env.local", "../.env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    api_host: str = "127.0.0.1"
    api_port: int = 8000
    frontend_origin: str = "http://127.0.0.1:5173"
    jwt_secret_key: str = ""

    database_url: str = (
        "postgresql+psycopg://plumora_app:plumora_dev_pass_local_only@127.0.0.1:5432/plumora_dev"
    )
    redis_url: str = "redis://127.0.0.1:6379/0"
    redis_state_ttl_seconds: int = 3600

    session_cookie_name: str = "__Host-plumora_session"
    rl_checkpoint_path: str = str(REPO_ROOT / "rl" / "artifacts" / "checkpoint.zip")
    rl_manifest_path: str = str(REPO_ROOT / "rl" / "artifacts" / "manifest.json")


def resolve_jwt_secret(app_settings: Settings | None = None) -> str:
    """Resolve JWT secret safely from resolved Settings as single source of truth.

    Priority order:
    1. Process environment variables
    2. .env.local / .env files
    3. jwt_secret.txt (if present)

    In production: strictly refuses to start if secret is missing or < 32 chars.
    In development: generates an ephemeral instance-isolated secret with warning.
    """
    resolved_settings = app_settings if app_settings is not None else Settings()
    secret = resolved_settings.jwt_secret_key.strip()

    if not secret:
        secret_file = Path("jwt_secret.txt")
        if secret_file.exists():
            file_secret = secret_file.read_text(encoding="utf-8").strip()
            if file_secret:
                secret = file_secret

    if resolved_settings.app_env.lower() == "production":
        if not secret:
            raise RuntimeError("JWT_SECRET_KEY must be set in production environment.")
        if len(secret) < 32:
            raise RuntimeError("JWT_SECRET_KEY in production must be at least 32 characters long.")
        return secret

    if secret:
        return secret

    logger.warning("Generating ephemeral secret for development/testing. Instance-isolated!")
    return secrets.token_hex(32)


settings = Settings()
