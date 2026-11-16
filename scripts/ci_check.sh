#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== [1/4] Lint Check (Backend, RL, Frontend) ==="
(cd backend && uv run ruff check .)
(cd rl && uv run ruff check .)
(cd frontend && npm run lint)

echo "=== [2/4] Type Check (Backend, RL, Frontend) ==="
(cd backend && uv run mypy app tests)
(cd rl && uv run mypy src tests)
(cd frontend && npm run typecheck)

echo "=== [3/4] Automated Behavioral, Adversarial & E2E Tests (Backend, RL, Frontend) ==="
(cd backend && uv run pytest)
(cd rl && uv run pytest)
(cd frontend && npm test -- --run)

echo "=== [4/4] Frontend Production Build Check ==="
(cd frontend && npm run build)

echo "=== ALL DAY-0 CI & SMOKE CHECKS PASSED ==="
