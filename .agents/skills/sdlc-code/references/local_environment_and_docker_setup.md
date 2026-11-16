# Local Environment Bootstrapping & Docker-First Principles

Guides agents through local development environment bootstrapping, deploying backing services under Docker-First principles, and executing readiness smoke tests in Step 2.2 of Phase 2.

---

## 1. Five-Step Local Bootstrapping Process

Local environments must be initialized following a strict 5-step sequence before implementing business logic:

```
[1. Runtime & Packages] ──> [2. Environment .env] ──> [3. Backing Services DB/Cache]
                                                                   │
                                                                   ▼
[5. Environment Smoke Test] <── [4. Migrations & Seed Test Data] ─┘
```

| Step | Action | Verification Command |
| :--- | :--- | :--- |
| **Step 1: Runtime & Dependencies** | Install language runtime and run package manager to install locked dependencies (`pnpm install`, `poetry install`, `go mod download`). | Exit code 0, lockfiles (`pnpm-lock.yaml`, `poetry.lock`) remain uncorrupted. |
| **Step 2: Environment Variables (`.env`)** | Copy `.env.example` to `.env.local` or `.env.test`. Populate local service ports, test database URLs, and mock secret keys. | Never overwrite production secrets; `.env.local` is ignored in `.gitignore`. |
| **Step 3: Launch Backing Services (DB, Redis, Queue)** | Start stateful backing services via Docker Compose for dedicated test isolation. | Verify listening ports and `healthy` status via `docker compose ps`. |
| **Step 4: Execute Migrations & Seed Test Data** | Run database migration commands (`prisma migrate`, `alembic upgrade`, `go-migrate`) and seed repeatable test fixtures. | Database contains verified schema and isolated seed data. |
| **Step 5: Execute Environment Smoke Test** | Launch dev server probe or null test suite verifying complete runtime and connection pipeline. | Commands pass with exit code 0; zero dependency or database connection errors. |

---

## 2. Docker-First Principles for Local Backing Services

### A. Failure Patterns of AI Coding Agents
* Agents frequently avoid or delay setting up Docker backing services.
* Consequence: The agent writes business code and runs tests when no database exists, triggering connection refused errors (`ECONNREFUSED`), timeouts, and missing database extensions (e.g., `uuid-ossp`, `pgvector`), wasting thousands of tokens in futile debug loops.
* Substituting SQLite for PostgreSQL/MySQL during development is **STRICTLY FORBIDDEN** due to severe behavioral drift across data types, foreign keys, JSON operators, and concurrency locking.

---

### B. Mandatory "Docker-First" Invariant
* If a project depends on any stateful backing service (PostgreSQL, MySQL, Redis, MongoDB, MinIO, RabbitMQ, Mailhog), the agent **MUST WRITE AND LAUNCH `docker-compose.yml` AT STEP 3 BEFORE RUNNING MIGRATIONS OR TOUCHING BUSINESS LOGIC**.

---

### C. Quality Standards for `docker-compose.yml`
1. `container_name`: Explicit naming with project prefix (e.g., `myapp-postgres`, `myapp-redis`).
2. `image`: Locked immutable tags (e.g., `postgres:16-alpine`); `:latest` is **STRICTLY FORBIDDEN**.
3. `ports`: Explicit host-to-container port mapping (e.g., `5432:5432`, `6379:6379`).
4. `environment` / `env_file`: 100% synchronized with `.env.example`.
5. `volumes`: **Named persistent volumes are mandatory** (e.g., `pgdata:/var/lib/postgresql/data`) to preserve test data across container restarts.
6. `healthcheck`: **MANDATORY** automated health check script. Never accept containers in raw `running` state without verified `healthy` status.

---

### D. Standard `docker-compose.yml` Reference
```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: myapp-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
      POSTGRES_DB: ${DB_NAME:-myapp_dev}
    ports:
      - "${DB_PORT:-5432}:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d ${DB_NAME:-myapp_dev}"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: myapp-redis
    restart: unless-stopped
    ports:
      - "${REDIS_PORT:-6379}:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

### E. Infrastructure Smoke Test Commands
```bash
docker compose up -d
docker compose ps
# STATUS column MUST display "Up (healthy)".
# Advancing to Step 4 (Migrations) is FORBIDDEN until containers report "healthy"!
```

---

## 3. Infrastructure Strategy: Docker vs Native Execution

1. **Hybrid Model (Standard Recommendation for Web & Backend)**:
   * **Stateful Backing Services (DB, Redis, Queue, Mock Mail)**: Run in **Docker Compose** (`docker-compose.yml`).
     * *Benefits*: Isolates test data in volumes, prevents port/version conflicts on host, clean teardown via `docker compose down -v`.
   * **Application Code & Dev Server**: Run **Native on Host** (`pnpm dev`, `python app.py`, `go run`).
     * *Benefits*: Native hot-reloading, fastest compile times, direct debugger integration without container I/O latency.
2. **Pure Native Model (No Docker)**:
   * For pure CLI tools, open-source libraries, static frontends, or embedded applications requiring zero stateful services.
3. **Full Containerized Model (Dev Containers)**:
   * For complex distributed systems requiring 100% frozen environment parity across developer machines.
4. **Production Infrastructure (Phase 4)**:
   * Multi-stage Docker builds (`Dockerfile`) optimized for minimal footprint and deployed to target infrastructure (Kubernetes, Cloud Run, VPS) per Phase 1 designs.
