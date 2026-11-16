# Tooling & Subagent Dispatch in Phase 4

Guides agents in identifying activation triggers for specialized release tools, subagents, and slash commands across release preparation, live target verification, and post-deployment operations.

## 1. Phase 4 Dispatch Matrix

| Task / Scenario | Recommended Capability / Tool | Calling / Recommendation Mechanism | Optimization Objective |
| --- | --- | --- | --- |
| Optimized production container packaging | Container CLI (`docker buildx`, `docker inspect`) | Run multi-stage build via `run_command` | Build lightweight images (Alpine/Distroless), non-root security, zero build toolchain leaks. |
| Zero-downtime database migration | Database CLI & Backup (`pg_dump`, `prisma`, `alembic`) | Run via `run_command` following Expand & Contract | Pre-migration snapshot backup; background backfilling without table locks. |
| Three-barrier post-deployment smoke tests | Network tools (`curl -fsS`, `openssl`) | Automated probes checking `/healthz`, core APIs, and SSL | Validate live service health before shifting user traffic. |
| Scheduled post-release health monitoring | `/schedule` slash command | Recommend user type `/schedule` with `CronExpression` or `DurationSeconds` | Automates periodic health checks; catches performance degradation and memory leaks early. |
| Release artifact-to-source reconciliation | Cryptographic hashing (`sha256sum`, `git rev-parse`) | Run via `run_command` comparing digests and commit SHAs | Ensure deployment artifact matches the Gate 3 approved commit 1:1, preventing accidental stale builds. |
| Emergency operational incident triage (Step 4.4) | `research` subagent for deep log investigation | `invoke_subagent(TypeName='research', ...)` | Analyze massive access/error logs in an isolated sandbox without overflowing primary context. |
| Operational metrics and latency monitoring | Observability / Metrics MCP | `call_mcp_tool` with configured server | Real-time collection of latency percentiles (`p95`/`p99`), 5xx error ratios, and resource limits. |

## 2. Release Safety Protocols

1. **Strict Permission Boundaries**:
   * Production deployment, live database migration execution, and live cloud configuration mutations **require explicit authorized human sign-off**. Agents never run destructive commands (`DROP TABLE`, `rm -rf`, `force push`).
2. **Mandatory Rollback Readiness**:
   * Prior to triggering any deployment or migration command, an actionable rollback plan with concrete triggers must be verified.
3. **Model Inheritance & Reasoning Effort**:
   * All subagents (e.g., incident triage) default to `Model: 'inherit'`, using the user's active session model.
   * For P0 Root Cause Analysis (5-Whys), recommend activating the `/boost` command for maximum reasoning budget (`reasoning_effort: high`).

## 3. Fallback Principles

* If the platform does not support the `/schedule` slash command, document standard OS cronjob configurations (or CI/CD scheduled workflows) in `docs/release.md`.
* Prioritize standard Linux utilities (`curl`, `grep`, `systemctl`, `journalctl`) to verify service health.
