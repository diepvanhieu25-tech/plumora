---
name: sdlc-release
description: "Prepare release packaging, execute verified deployments within granted permissions, manage operations, investigate incidents, and route fixes back to development."
---

# Phase 4 — Deployment & Operations

Two distinct entry points: release preparation from a verified Gate 3 candidate, or direct operational incident triage at Step 4.4. Never assume production access, container infrastructure, operational privileges, or autonomous self-healing. Operations represent activity phases, not mandatory multi-agent swarms.

## Context Loading

Start with verified candidate, target/runbook, and this entrypoint. For preparation read packaging/preflight; for incidents read investigation/recovery. Load only references for the active path. A framework/documentation handoff without a deployment target is not-deployed; do not provision infrastructure merely to satisfy a checklist.

## Execution Steps & Specialized Skills

| Step | Actions & Competencies | References / Deliverables |
| --- | --- | --- |
| 4.1 — Preparation | Cross-reference Gate 3 candidate and environment matrices; configure multi-stage non-root packaging, Expand/Contract DB migrations, and rollback runbooks | [Production Packaging & Operations](references/production_packaging_and_safe_rollout.md), [Release Preflight Checklist](references/release_preflight_checklist.md), [Tooling & Subagent Dispatch](references/tooling_and_subagent_dispatch.md), [Rollout & Recovery](references/rollout_and_recovery.md), [Environment Template](resources/env_template.example) |
| 4.2 — Deployment | Confirm target and permissions, execute sequential runbook steps, run Three-Barrier Post-Deployment Smoke Tests (/healthz, critical paths, SSL) | [Production Packaging & Operations](references/production_packaging_and_safe_rollout.md), [Rollout Guide](references/rollout_and_recovery.md), [Release Template](resources/release_template.md) |
| 4.3 — Observability / G4 | Monitor 3 observability pillars (Structured Logs, RED Method Metrics, /schedule), evaluate abort thresholds, verify stability or trigger rollback | [Production Packaging & Operations](references/production_packaging_and_safe_rollout.md), [Recovery Guide](references/rollout_and_recovery.md); record live versions and operational state |
| 4.4 — Incidents | Execute OODA loop (Observe-Orient-Decide-Act), hypothesis validation, blast radius containment, reproduction, and 5-Whys Root Cause Analysis | [Incident Investigation](references/incident_investigation_and_5whys.md), [Incident RCA Template](resources/incident_rca_template.md), [Lessons Template JSON](resources/lessons_template.json) |

Production authority belongs exclusively to authorized personnel; act strictly within granted permissions without re-requesting valid authorization. Runbooks must define exact commands, entry/abort conditions, verifiable outcomes, and rollback plans prior to production impact.

## Gate 4 — Handoff and Boundaries

Record commit or immutable source manifest, build/config/dependency identity, release artifact, environment, permissions, operations/results, post-deploy tests, telemetry sources, observation window, and rollback steps. Distinguish prepared / approved / deployed / observing / stable / rolled-back / blocked / not-deployed; without a target environment, mark "not deployed" rather than claiming a deployment pass.

Rollback does not automatically revert external data side-effects. Select rollback vs fix-forward vs data restoration based on schema compatibility and permissions; verify before declaring recovery. Missing telemetry does not imply stability.

## Incidents, Changes & Continuity

Mitigate incidents within approved runbooks; code fixes with valid specifications proceed through Phase 2 $\rightarrow$ Phase 3 $\rightarrow$ Phase 4; requirement or architectural shifts regress to Phase 1. Implement reproducible regression tests while keeping patches minimal; avoid rigid universal quotas for hotfix lines, RCA deadlines, or 5-Whys counts.

Record operation IDs, running processes, and external impacts before pausing; resume by verifying deployment/migration state before re-executing. Prior approvals do not carry forward to updated artifacts. Document lessons learned with evidence and owners; policy changes require authorized sign-off.

Autonomous self-healing, canary routing, and multi-agent operations require dedicated infrastructure and permissions; they are never assumed defaults.
