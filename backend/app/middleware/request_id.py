"""X-Request-ID correlation middleware propagating request IDs into logs and response headers."""

from __future__ import annotations

import re
import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response

from app.core.observability import REQUEST_ID_CTX

_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


def resolve_request_id(request: Request) -> str:
    """Extract validated X-Request-ID from incoming headers or generate a UUID4."""
    incoming = request.headers.get("x-request-id", "").strip()
    return incoming if _REQUEST_ID_RE.fullmatch(incoming) else str(uuid.uuid4())


def register_request_id_middleware(app: FastAPI) -> None:
    """Attach X-Request-ID correlation middleware to a FastAPI application."""

    @app.middleware("http")
    async def request_id_context_middleware(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        rid = resolve_request_id(request)
        request.state.request_id = rid
        tok = REQUEST_ID_CTX.set(rid)
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = rid
            return response
        finally:
            REQUEST_ID_CTX.reset(tok)
