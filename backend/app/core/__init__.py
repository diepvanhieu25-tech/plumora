"""System-wide core configuration and structured observability."""

from app.core.config import REPO_ROOT, Settings, resolve_jwt_secret, settings
from app.core.observability import (
    REQUEST_ID_CTX,
    JsonLogFormatter,
    configure_json_logging,
    emit_audit_event,
)

__all__ = [
    "REPO_ROOT",
    "REQUEST_ID_CTX",
    "JsonLogFormatter",
    "Settings",
    "configure_json_logging",
    "emit_audit_event",
    "resolve_jwt_secret",
    "settings",
]
