"""Structured JSON logging, X-Request-ID correlation context, and Security Audit Events (O-01, S-06)."""

from __future__ import annotations

import json
import logging
import sys
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

REQUEST_ID_CTX: ContextVar[str] = ContextVar("request_id", default="-")
_CONFIGURED_SERVICES: set[str] = set()
_AUDIT_LOGGER = logging.getLogger("plumora.audit")


class JsonLogFormatter(logging.Formatter):
    """Single-line JSON log formatter injecting service name, request_id, and optional audit payload."""

    def __init__(self, service_name: str) -> None:
        super().__init__()
        self.service_name = service_name

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "service": self.service_name,
            "request_id": REQUEST_ID_CTX.get(),
            "logger": record.name,
            "message": record.getMessage(),
        }
        audit_data = getattr(record, "audit_payload", None)
        if isinstance(audit_data, dict):
            payload["audit"] = audit_data
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


def configure_json_logging(service_name: str) -> None:
    """Attach JsonLogFormatter to root logger idempotently for a microservice."""
    if service_name in _CONFIGURED_SERVICES:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonLogFormatter(service_name))
    root = logging.getLogger()
    root.handlers = [handler]
    if root.level == logging.NOTSET:
        root.setLevel(logging.INFO)
    _CONFIGURED_SERVICES.add(service_name)


def emit_audit_event(
    *,
    action: str,
    actor_id: str | None,
    role: str | None,
    resource: str,
    outcome: str,
    details: dict[str, Any] | None = None,
) -> None:
    """Emit a structured security audit event without logging passwords or tokens."""
    audit_payload: dict[str, Any] = {
        "action": action,
        "actor_id": actor_id or "anonymous",
        "role": role or "anonymous",
        "resource": resource,
        "outcome": outcome,
    }
    if details:
        audit_payload["details"] = details
    _AUDIT_LOGGER.info(
        "audit:%s outcome=%s resource=%s",
        action,
        outcome,
        resource,
        extra={"audit_payload": audit_payload},
    )
