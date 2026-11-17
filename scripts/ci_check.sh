#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== [1/6] Lint Check (Backend, RL, Frontend) ==="
(cd backend && uv run ruff check .)
(cd rl && uv run ruff check .)
(cd frontend && npm run lint)

echo "=== [2/6] Type Check (Backend, RL, Frontend) ==="
(cd backend && uv run mypy app tests)
(cd rl && uv run mypy src tests)
(cd frontend && npm run typecheck)

echo "=== [3/6] Unit & Behavioral Mock Tests (Backend, RL, Frontend) ==="
(cd backend && uv run pytest)
(cd rl && uv run pytest)
(cd frontend && npm run test:unit)

echo "=== [4/6] Frontend Production Build Check ==="
(cd frontend && npm run build)

echo "=== [5/6] Backend Health Verification & Live Fullstack Integration ==="
BACKEND_PID=""
FRONTEND_PID=""
cleanup() {
  if [ -n "$BACKEND_PID" ]; then
    echo "Stopping background backend process (PID: $BACKEND_PID)..."
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ -n "$FRONTEND_PID" ]; then
    echo "Stopping background frontend process (PID: $FRONTEND_PID)..."
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if ! curl -sf http://127.0.0.1:8000/api/v1/health > /dev/null 2>&1; then
  echo "Backend is not running at 127.0.0.1:8000. Starting backend in background..."
  (cd backend && uv run uvicorn app.main:app --host 127.0.0.1 --port 8000) &
  BACKEND_PID=$!
  echo "Waiting up to 30s for backend readiness at http://127.0.0.1:8000/api/v1/health..."
  HEALTHY=0
  for i in $(seq 1 30); do
    if curl -sf http://127.0.0.1:8000/api/v1/health > /dev/null 2>&1; then
      echo "Backend is healthy after ${i}s."
      HEALTHY=1
      break
    fi
    sleep 1
  done
  if [ "$HEALTHY" -ne 1 ]; then
    echo "FATAL: Backend at 127.0.0.1:8000 failed to become healthy within 30 seconds."
    exit 1
  fi
else
  echo "Backend at 127.0.0.1:8000 is already active and healthy."
fi

# Run live fullstack jsdom integration against real backend
(cd frontend && npm run test:integration)

# Ensure frontend server is active for browser E2E (either pre-existing or vite preview)
if ! curl -sf http://localhost:3000 > /dev/null 2>&1; then
  echo "Frontend is not running at http://localhost:3000. Starting vite preview in background..."
  (cd frontend && npx vite preview --host 127.0.0.1 --port 3000) &
  FRONTEND_PID=$!
  echo "Waiting up to 15s for frontend preview readiness at http://localhost:3000..."
  FE_HEALTHY=0
  for i in $(seq 1 15); do
    if curl -sf http://localhost:3000 > /dev/null 2>&1; then
      echo "Frontend preview is healthy after ${i}s."
      FE_HEALTHY=1
      break
    fi
    sleep 1
  done
  if [ "$FE_HEALTHY" -ne 1 ]; then
    echo "FATAL: Frontend failed to become ready on port 3000 within 15 seconds."
    exit 1
  fi
else
  echo "Frontend at http://localhost:3000 is already active and healthy."
fi

echo "=== [6/6] Real Browser E2E Audit & Negative Control Verification ==="
# 6.1 Real Chromium E2E Audit (must exit 0 with allChecksPassed=true)
node scripts/audit_mvp_hardening.cjs
node scripts/audit_product_realism.cjs

# 6.2 Negative Control Verification (must exit non-zero when conditions fail)
echo "Running Negative-Control Audit probe (verifying failure detection)..."
if node scripts/audit_mvp_hardening.cjs --negative-control > /dev/null 2>&1; then
  echo "FATAL: Audit negative-control probe unexpectedly passed with exit 0!"
  exit 1
else
  echo "Audit negative-control probe correctly failed with non-zero exit code as expected."
fi

echo "=== ALL DAY-0 CI, INTEGRATION & BROWSER E2E HARDENING CHECKS PASSED ==="
