"""Global FastAPI exception handlers standardizing 422 validation and 500 internal error envelopes."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.observability import REQUEST_ID_CTX

logger = logging.getLogger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    """Register standardized 422 and 500 exception handlers with X-Request-ID correlation."""

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        rid = str(getattr(request.state, "request_id", REQUEST_ID_CTX.get()))
        return JSONResponse(
            status_code=422,
            content={
                "error_code": "VALIDATION_ERROR",
                "message": "Dữ liệu đầu vào không hợp lệ.",
                "request_id": rid,
                "detail": exc.errors(),
            },
            headers={"X-Request-ID": rid},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request,
        exc: Exception,
    ) -> JSONResponse:
        rid = str(getattr(request.state, "request_id", REQUEST_ID_CTX.get()))
        logger.exception("Unhandled exception on %s %s: %s", request.method, request.url.path, exc)
        return JSONResponse(
            status_code=500,
            content={
                "error_code": "INTERNAL_SERVER_ERROR",
                "message": "Lỗi hệ thống nội bộ.",
                "request_id": rid,
                "detail": {
                    "error_code": "INTERNAL_SERVER_ERROR",
                    "message": "Lỗi hệ thống nội bộ.",
                },
            },
            headers={"X-Request-ID": rid},
        )
