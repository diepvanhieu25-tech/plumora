# Implementation Plan: [Scope]

Status: DRAFT. Version: [Version].

- Authoritative intent, specification, architecture design, and effective version:
- Objective, in-scope vs out-of-scope boundaries, initial Git baseline (task branch, `.gitignore`, Day 0 CI/CD GitHub Actions):
- Unresolved decisions, research spikes, and blocked downstream tasks:

## 1. Codebase Current State and Project Layout

- Codebase baseline (Greenfield: scaffolding tool / lockfile; Existing codebase: entry points, build/test scripts, test coverage baseline):
- Project directory layout and layer responsibility boundaries:

## 2. Detailed Task Breakdown: Inputs – Outputs – Acceptance Criteria

| ID | Deliverable / AC-ID | Dependencies | Inputs (Spec, DTOs, Files to Read/Modify) | Outputs (Source & Test Files to Create/Update) | Acceptance Criteria (CLI Command, Exit Code 0, Expected Output) |
| --- | --- | --- | --- | --- | --- |
| [TASK-ID] | [Deliverable and AC-ID] | [Depends-on IDs or none] | [Referenced documents, existing code files] | [Concrete source and test files] | [Terminal test command, pass condition, stop-on-failure rule] |

## 3. Acceptance Traceability Matrix

| Criterion | Requirement / Design Reference | Verification Tier & Test Type | Target Environment & Fixtures | Expected Invariants | Verification Dossier Link |
| --- | --- | --- | --- | --- | --- |
| [AC-ID] | [Source spec and version] | [Unit / Integration / Contract / E2E / Adversarial] | [Dedicated isolated test target] | [Payload & domain state] | [Link to verification report] |

## 4. Readiness, Integration, and Handover

- Environment readiness dossier, test fixtures, and preconditions before writing business code:
- End-to-end integration step, regression test suite, and rollback plan:
- On failure: triage stage, assigned owner, and unblocking criteria:
- On requirement change: affected tasks, tests, and invalidated evidence:
- Self-check results and Phase 2 handover dossier upon task completion:

The implementation plan references verification dossiers; do not maintain a duplicate results table. The existence of a plan does not imply that the environment is ready or that tasks are accepted.

## Integration and Browser Evidence

- AC/test IDs → real user entry point/journey → UI/state → API/auth → persistence/reload assertions (or applicability rationale):
- Approved design/component/token revisions; missing contracts and blocked dependents:
- Mock inventory: location, boundary, purpose, environment, replacement condition; live third-party limits:
- Source/config/test snapshot including relevant dirty files; required checks and terminal command/tool results:
- Browser URL/environment/dataset/role, steps, expected/actual; exploratory findings and regressions:
- Artifact paths/hashes (runner/trace/network/console/data assertions); no secrets:
- IMPLEMENTED / VERIFIED / BLOCKED or NOT RUN; invalidated evidence and next owner/action:

Unit/build pass, HTTP 200, screenshot, tool-call count or background launch alone does not establish integrated behavior. Missing browser capability requires equivalent authorized tooling with evidence or a blocker.
