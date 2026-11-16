---
name: sdlc-code
description: "Develop implementation plans, bootstrap local test environments before business logic, execute TDD engineering standards, and hand off Gate 2 verification evidence."
---

# Phase 2 — Environment Setup & Implementation

Receives valid Gate 1 baselines with criteria IDs, dependencies, and risk models. Operates independently of rigid JSON structures or arbitrary documentation layouts. Inspect inputs thoroughly before modifying code.

## Context Loading

Start with approved criteria/contracts, current handoff, and this entrypoint. Read only the reference needed for the affected boundary: environment for setup changes, backend/frontend for the corresponding code, transactions for data consistency. Service-free documentation/validator work needs applicable checks, not dummy backing services. Use scoped reads and bounded logs with failures/exit codes preserved.

## Plan $\rightarrow$ Environment & Test Harness $\rightarrow$ Business Logic $\rightarrow$ Self-Test

| Step | Actions & Competencies | References / Deliverables |
| --- | --- | --- |
| 2.1 — Baseline & Plan | Baseline codebase state (greenfield vs brownfield), set up Git and Day-0 GitHub Actions CI, document directory layout; specify tasks via inputs, outputs, and criteria | [Codebase & Git Workflow](references/codebase_and_git_workflow.md), [Planning & Readiness](references/planning_and_readiness.md), [Tooling & Subagent Dispatch](references/tooling_and_subagent_dispatch.md), [Implementation Plan Template](resources/implementation_plan_template.md) |
| 2.2 — Environment Setup | Execute 5-step local bootstrapping (runtime, .env, Docker-First backing services with healthchecks, migration/seed, smoke test); verify behavioral parity with production | [Local Environment & Docker Setup](references/local_environment_and_docker_setup.md), [Planning & Readiness](references/planning_and_readiness.md), [Environment Readiness Template](resources/environment_readiness_template.md), [Environment & Integration](references/environment_and_integration.md) |
| 2.3 — Implementation | Implement behavior following API contracts, backend standards (Clean Arch, ACID, concurrency locking) and frontend standards (5 UX states, a11y WCAG AA); enforce TDD cycles | [Backend Standards](references/backend_engineering_standards.md), [Frontend Standards](references/frontend_engineering_standards.md), [Contracts, Transactions & State](references/contracts_transactions_and_state.md), [TDD Cycle](references/tdd_cycle_and_circuit_breaker.md), [External Adapters](references/external_adapter_pattern.md) |
| 2.4 — Self-Test / Gate 2 | Verify behavioral regression and integration paths; audit diff, secrets, supply chain, and Git working tree hygiene | [Handoff Template](resources/handoff_template.md); commit and push only within granted authorization |

Before writing business logic: verify plan feasibility, environment parity, isolated test data, executable test suites, and resolved behavioral drift. Greenfield projects MUST use official scaffolding CLIs and combined bash commands (`mkdir -p ...`); never create directories or boilerplate configs manually. Establish Git repo and Day-0 GitHub Actions CI (`.github/workflows/ci.yml`) as an external quality firewall; stateful backing services MUST use Docker-First with named volumes and healthchecks before coding. Adhere to Git Workflow: direct commits to `main` are FORBIDDEN; use dedicated task branches (`feat/`, `fix/`, `refactor/`), atomic Conventional Commits when authorized, and explicit working tree state. Without commit authority, preserve user changes and hand off immutable hashes for relevant dirty/untracked files. Tests must fail for expected reasons (RED); infrastructure errors do not demonstrate readiness.

For logic, write behavioral assertions; observe RED before implementation in TDD cycles. Run corresponding checks for documentation and configuration. Mock external boundaries appropriately while keeping the System Under Test (SUT) real; never weaken assertions to disguise failures.

Defaults to sequential execution. Multi-agent execution occurs only upon explicit requirement; isolate working trees, data, ports, and outputs. Verify on final integrated branches; Git worktrees do not isolate background ports, databases, or permissions.

For real integration, mock inventory, UI readiness and browser self-test evidence, follow [Planning & Readiness](references/planning_and_readiness.md). Missing browser capability or backend contracts block dependent verification; equivalent authorized tooling may preserve the required evidence.

## Gate 2 — Ready for Review

Hand off requirements/criteria versions, file/branch/commit identifiers or immutable snapshot manifest including relevant dirty/untracked files, required environments/data, commands/exit codes/evidence, baseline vs new test results, unexecuted checks, and next actions. Modifying code post-verification invalidates evidence. Gate 2 does not constitute final acceptance.

## Rework and Continuity

Fix code defects against hard test evidence; requirement shifts regress to Phase 1. Environment or permission failures block dependent tasks without expanding permissions. Terminate edit loops when stalled; record hypotheses and terminal evidence.

Record progress and external side-effects before pausing. When resuming: read handoff notes $\rightarrow$ inspect Git and version state $\rightarrow$ verify processes/services/data $\rightarrow$ test baseline $\rightarrow$ select next action.
