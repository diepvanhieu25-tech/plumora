# ── Stage 1: Build Dependencies via uv ──
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder
WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

COPY backend/pyproject.toml ./backend/
RUN cd backend && uv venv /app/.venv && uv pip install -r pyproject.toml

# ── Stage 2: Minimal Non-Root Production Runner ──
FROM python:3.12-slim-bookworm AS runner
WORKDIR /app

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    APP_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=8000 \
    RL_CHECKPOINT_PATH=/app/rl/artifacts/checkpoint.zip \
    RL_MANIFEST_PATH=/app/rl/artifacts/manifest.json

# Create unprivileged non-root user
RUN groupadd -g 10001 plumora && \
    useradd -u 10001 -g plumora -s /bin/sh -M plumora

# Copy virtual environment from builder
COPY --from=builder --chown=plumora:plumora /app/.venv /app/.venv

# Copy application code and RL artifacts
COPY --chown=plumora:plumora backend/app /app/backend/app
COPY --chown=plumora:plumora backend/pyproject.toml /app/backend/pyproject.toml
COPY --chown=plumora:plumora rl/artifacts /app/rl/artifacts

USER plumora
WORKDIR /app/backend

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
