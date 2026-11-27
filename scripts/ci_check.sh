#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== [1/7] Lint, SAST & SCA Check (Backend, RL, Frontend) ==="
(cd backend && uv run ruff check .)
(cd rl && uv run ruff check .)
(cd frontend && npm run lint && npm audit --omit=dev --audit-level=high)

echo "=== [2/7] Type Check (Backend, RL, Frontend) ==="
(cd backend && uv run mypy app services tests)
(cd rl && uv run mypy src tests)
(cd frontend && npm run typecheck)

echo "=== [3/7] Unit & Behavioral Tests (Backend, RL, Frontend) ==="
(cd backend && uv run pytest)
(cd rl && uv run pytest)
(cd frontend && npm run test:unit)

echo "=== [4/7] Frontend Production Build Check ==="
(cd frontend && npm run build)

echo "=== [5/7] Live Docker 4-Microservices + API Gateway Readiness & Integration ==="
docker compose config --quiet

GW_HEALTH=$(curl -sf http://127.0.0.1:8000/api/v1/health 2>/dev/null || true)
FE_READY=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || true)

if ! echo "$GW_HEALTH" | grep -q '"mode":"microservices"' || [ "$FE_READY" != "200" ]; then
  echo "Starting unified 4-Microservices + API Gateway + Frontend Docker stack..."
  docker compose up -d --build --remove-orphans
  echo "Waiting up to 60s for API Gateway (:8000) & Frontend (:3000) readiness..."
  STACK_READY=0
  for i in $(seq 1 60); do
    GW_HEALTH=$(curl -sf http://127.0.0.1:8000/api/v1/health 2>/dev/null || true)
    FE_READY=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || true)
    if echo "$GW_HEALTH" | grep -q '"mode":"microservices"' && echo "$GW_HEALTH" | grep -q '"status":"ok"' && [ "$FE_READY" = "200" ]; then
      echo "Live Docker Microservices stack is healthy after ${i}s."
      STACK_READY=1
      break
    fi
    sleep 1
  done
  if [ "$STACK_READY" -ne 1 ]; then
    echo "FATAL: Docker Microservices stack failed to become healthy within 60s."
    docker compose ps
    exit 1
  fi
else
  echo "Live Docker 4-Microservices + API Gateway stack (:8000) & Frontend (:3000) already healthy."
fi

# Run live fullstack jsdom integration against real API Gateway -> 4 Microservices -> PG/Redis
(cd frontend && npm run test:integration)

echo "=== [6/7] Real Browser E2E Audit & Negative Control Verification ==="
# 6.1 Real Chromium E2E Audit against live Docker Frontend (:3000) -> API Gateway (:8000)
node scripts/audit_p3_slice1.cjs

# 6.2 Negative Control Verification (must exit non-zero when conditions fail)
echo "Running Negative-Control Audit probe (verifying failure detection)..."
if node scripts/audit_p3_slice1.cjs --negative-control > /dev/null 2>&1; then
  echo "FATAL: Audit negative-control probe unexpectedly passed with exit 0!"
  exit 1
else
  echo "Audit negative-control probe correctly failed with non-zero exit code as expected."
fi

echo "=== [7/7] Microservices Edge Security, 4-Schema Isolation & Diff Whitespace Check ==="
GW_INT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/v2/internal/domains/frontend/bundle)
if [ "$GW_INT_STATUS" != "403" ]; then
  echo "FATAL: API Gateway :8000 internal route returned $GW_INT_STATUS (expected 403)"
  exit 1
fi
FE_INT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v2/internal/domains/frontend/bundle)
if [ "$FE_INT_STATUS" != "403" ]; then
  echo "FATAL: Frontend Nginx :3000 internal route returned $FE_INT_STATUS (expected 403)"
  exit 1
fi
GW_TRAV_STATUS=$(curl -s --path-as-is -o /dev/null -w "%{http_code}" "http://127.0.0.1:8000/api/v2/domains/%25252e%25252e/%25252e%25252e/health")
if [ "$GW_TRAV_STATUS" != "400" ]; then
  echo "FATAL: API Gateway :8000 multi-encoded traversal returned $GW_TRAV_STATUS (expected 400)"
  exit 1
fi
DEAD_V1_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/v1/roadmap)
if [ "$DEAD_V1_STATUS" != "404" ]; then
  echo "FATAL: Removed v1 route /api/v1/roadmap returned $DEAD_V1_STATUS (expected 404)"
  exit 1
fi
echo "Edge security verified: Gateway/Nginx internal routes -> 403, removed v1 routes -> 404."

GW_RID=$(curl -sI -H "X-Request-ID: ci-trace-001" http://127.0.0.1:8000/api/v1/health | tr -d '\r' | grep -i "^x-request-id:" | awk '{print $2}')
if [ "$GW_RID" != "ci-trace-001" ]; then
  echo "FATAL: API Gateway did not echo X-Request-ID header (got '$GW_RID')"
  exit 1
fi

(cd backend && uv run python -c "import glob, yaml; [list(yaml.safe_load_all(open(f))) for f in glob.glob('../k8s/*.yaml')]; print('k8s YAML valid')")

git diff --check

echo "=== ALL DAY-0 CI, LIVE MICROSERVICES INTEGRATION & BROWSER E2E CHECKS PASSED ==="
