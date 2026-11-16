# Production Packaging, Database Migrations & Safe Operations

Establishes operational standards and methodologies for Phase 4: **(1) Production Container Packaging**, **(2) Zero-Downtime Database Migrations (Expand & Contract)**, **(3) Post-Deployment Smoke Tests**, **(4) The 3 Pillars of Observability**, and **(5) Safe Rollback Strategies**.

---

## 1. Production Container Packaging Standards (Multi-Stage Dockerfiles)

Objective: Build minimal, secure, non-root images containing zero build toolchains or sensitive development files.

### A. Mandatory Multi-Stage Build Pattern
Completely decouple the build toolchain from the runtime environment:

```dockerfile
# ── Stage 1: Build & Dependencies ──
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build && pnpm prune --prod

# ── Stage 2: Minimal Production Runner ──
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Run as non-root user (Principle of Least Privilege)
USER node

# Copy only runtime artifacts
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json ./package.json

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### B. Security & Image Tagging Standards
1. **Non-Root Runtime User**:
   * **RUNNING CONTAINERS AS ROOT IS STRICTLY FORBIDDEN**: Use `USER node` (Node.js) or create a dedicated unprivileged user (`RUN addgroup -S appgroup && adduser -S appuser -G appgroup`). Prevents host compromise upon container escape vulnerabilities.
2. **Mandatory `.dockerignore`**:
   * Exclude secrets, tests, and development files:
     ```text
     .git
     .env*
     node_modules
     tests
     docs
     *.md
     Dockerfile*
     docker-compose*
     npm-debug.log*
     ```
3. **Immutable Tagging**:
   * **TAGGING `:latest` IN PRODUCTION IS STRICTLY FORBIDDEN**: The `:latest` tag is mutable and obscures deployment traceability and rollbacks.
   * Required naming: **Semantic Versioning + Git Commit SHA** (e.g., `app:v1.2.0-8a2b3c4`) or immutable **Image Digest** (`@sha256:...`).

---

## 2. Zero-Downtime Database Migrations (Expand & Contract Pattern)

Objective: Apply production database migrations without table locks, application downtime, or breaking older client versions.

### A. Three-Step Expand & Contract Workflow
Schema changes (column renaming, table splitting, `NOT NULL` constraints) must execute across 3 decoupled phases:

```
[Initial Baseline: Old Column]
            │
            ▼
[Step 1: EXPAND]
- Migration: Add New Column (NULLABLE or with DEFAULT).
- Deploy App: Read Old Column, but DUAL-WRITE to both Old and New Columns.
            │
            ▼
[Step 2: BACKFILL]
- Background Script: Migrate historical records from Old to New Column in small batches (e.g., 1,000 records) without table locks.
            │
            ▼
[Step 3: CONTRACT]
- Deploy App: Switch read and write operations exclusively to New Column.
- Final Migration: After production runs stably for several days, drop Old Column.
```

### B. Pre-Migration Safeguards
1. **Pre-Migration Backups**:
   * Capture a database snapshot (`pg_dump -Fc ...`) immediately before applying any migration.
2. **Reversible vs Irreversible Classification**:
   * Explicitly document: Does this migration have an executable `DOWN` script? Destructive migrations (drop column/table) require tested restore procedures from backups.

---

## 3. Post-Deployment Smoke Test Protocol

Immediately after deployment, operators/agents execute the Three-Barrier Smoke Test sequence before shifting live traffic:

1. **Barrier 1: Health Check Probe**:
   * Query the health probe:
     ```bash
     curl -fsS https://my-app.example.com/healthz
     ```
   * Verifies live connectivity:
     * Database connectivity (query `SELECT 1`).
     * Redis cache connectivity.
     * Memory consumption and disk space limits.
2. **Barrier 2: Critical Path Smoke Test**:
   * Execute automated probes exercising 1–2 primary read/write API workflows using dedicated test accounts (e.g., create an appointment and cancel immediately).
3. **Barrier 3: Network Security & TLS Certificate Verification**:
   * Verify valid HTTPS certificates, expiration dates, and HTTP security headers (`Strict-Transport-Security`, `X-Content-Type-Options: nosniff`).

---

## 4. The 3 Pillars of Observability

Systems are not considered stable without live telemetry.

```
       ┌────────────────────────────────────────────────────────┐
       │             3 PILLARS OF PHASE 4 OBSERVABILITY         │
       └───────────────────────────┬────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
   [1. LOGS]                 [2. METRICS]              [3. TRACES]
  (Structured JSON,         (RED Method: Rate,        (OpenTelemetry,
  request_id correlation)   Errors 5xx, Duration)     Distributed Tracing)
```

1. **Structured Logs**:
   * JSON logs with standard keys: `timestamp`, `level`, `request_id`, `path`, `status_code`, `latency_ms`.
   * Fast correlation by `request_id` upon customer support reports.
2. **Metrics & The RED Method**:
   * **Rate**: Requests served per second.
   * **Errors**: Ratio of HTTP 5xx responses. Alarm threshold: 5xx errors $> 1\%$.
   * **Duration**: Latency percentiles (`p95` and `p99`). Alarm threshold: `p95 > 1000ms`.
3. **Scheduled Post-Release Health Checks (`/schedule`)**:
   * During the initial 24–48 hours post-deployment, configure a 15-minute cronjob via `/schedule` to monitor error rates and detect memory leaks or database bottlenecks.

---

## 5. Rollback Strategies & Incident Recovery

### A. Two Distinct Rollback Classes
1. **Application Rollback**:
   * Rapid and low-risk: Switch traffic or restart containers pointing to the prior image digest (`git checkout <prior-tag>` or update deployment manifests).
   * Prerequisite: Current database schema remains backward-compatible with prior application code.
2. **Database Restoration**:
   * Higher latency and risk: If a faulty migration corrupted or deleted data, restore from the pre-migration snapshot.
   * **Caution**: Snapshot restores cause data loss for transactions occurring between backup creation and failure time. Reconcile transactions after restoration.

### B. Emergency Incident Loop
When alarms trigger (e.g., 5xx error spikes):
1. **Contain Blast Radius**: Trigger application rollback to the known stable image per the approved runbook.
2. **Verify Restored Baseline**: Run post-deployment smoke tests to confirm recovery.
3. **Transition to Step 4.4 (5-Whys Incident RCA)**: Collect faulty version telemetry in `docs/incidents/`, isolate root causes, and route verified remediation tasks to Phase 2 and Phase 3.
