"""Shared HTTP security headers helper for API Gateway and FastAPI applications."""

from __future__ import annotations

from fastapi import Request, Response


def apply_security_headers(request: Request, response: Response) -> Response:
    """Attach mandatory security headers (CSP, X-Frame-Options, nosniff, Cache-Control)."""
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Cache-Control"] = "no-store"
    if request.url.path in ("/docs", "/docs/oauth2-redirect", "/redoc"):
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "img-src 'self' data: https://fastapi.tiangolo.com; "
            "frame-ancestors 'self'; object-src 'none'"
        )
    else:
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; frame-ancestors 'self'; object-src 'none'"
        )
    return response
