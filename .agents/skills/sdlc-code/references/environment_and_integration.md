# Environment Setup, Baseline Audits & Integration

Invoked during Steps 2.1/2.2 and prior to Gate 2 handoffs when changes impact environments. Inputs: task plan, requirements/architecture designs, commit versions, and granted permissions. Objective: Establish which test suites can execute and what behaviors they prove.

## 1. Pre-Implementation Checklist

1. Confirm working directory, branch, Git status, and user modifications. Read active handoffs; never reset or overwrite working trees to simulate cleanliness.
2. Cross-reference tasks, criteria IDs, and API contracts against active versions. If requirements shifted, document affected tasks before implementation.
3. Identify build/test commands from project manifests and documentation; understand target behavior before running. Never install generic tools unprompted.
4. Verify runtime versions, dependencies, output directories, test services, and credentials. Confirm environment variables are present without printing secrets.
5. Execute baseline verification tests; record commands, exit codes, and symptoms. Distinguish pre-existing errors from new regressions; unexecuted checks do not demonstrate a baseline pass.

| Baseline Status | Operational Decision |
| --- | --- |
| Green and inputs complete | Begin assigned implementation task |
| Failing in areas related to assigned task | Diagnose and resolve environment blocker; document isolation strategy |
| Pre-existing failures in independent modules | Document limitations as known debt; proceed with assigned scope |
| Insufficient permissions or missing services | Block tests requiring access or use approved fallbacks; document boundaries |

## 2. Required Behavioral Parity

| Dimension | Verification Requirement | Mandatory Documented Limitation |
| --- | --- | --- |
| Runtime / OS | Exact version, lockfile integrity, execution mode | Native host vs containerized execution per project needs |
| Database | Constraints, transactions, concurrency, test fixtures | In-memory substitutes (e.g., SQLite) do not prove target DB semantics |
| Cache / Queue | Configuration, FIFO ordering, TTL expiration, tenant isolation | Mock brokers may conceal distributed race conditions |
| External Services | Contracts, credentials, sanctioned sandboxes | Mocks do not prove live third-party connectivity or side-effects |
| UI / Network | Target host, session cookies, proxy routes | Local tests do not prove production network/CDN behavior |
| Observability | Structured logs, request tracing, sanitized output | Absence of real production load and telemetry must be noted |

Launch only services required by assigned tasks. Test databases and credentials must remain strictly isolated from production; write permissions to test databases require explicit authorization. Read access to production never grants write permissions.

## 3. Repeatable Test Harnesses

Document test fixtures, ownership, initial state, operations, and observable assertions. Use unique test fixture identifiers to prevent cross-test collisions; ensure teardown scripts clean only owned test records.

Placeholder commands in documentation must be replaced with verified project commands prior to execution. If commands do not exist, define required scripts; never cite placeholder commands as execution evidence.

Tooling (LSPs, database inspectors, headless browsers, MCPs) is optional. If tasks depend on tooling, verify connectivity with non-destructive queries; tool loading failures must never be reported as passed assertions.

## 4. Integration & Self-Testing

1. Verify task-specific behavior first, followed by regression suites. Use [TDD Cycles](tdd_cycle_and_circuit_breaker.md) and [External Adapters](external_adapter_pattern.md) to isolate external boundaries.
2. Trace end-to-end user journeys across UI $\rightarrow$ API $\rightarrow$ Database; reconcile API responses against database records and UI states.
3. For multi-branch workflows, verify behavior on the final integrated branch; document shared contracts, ports, and databases. Git worktrees do not isolate background ports, databases, or permissions.
4. Audit Git diffs, configurations, dependencies, and secrets; never weaken tests to conceal bugs. Code modifications post-test require re-running affected verification suites.

## 5. Gate 2 Handoff & Session Continuity

Using the [Handoff Template](../resources/handoff_template.md), document inputs, versions, modified files, baseline vs new test results, exit codes, terminal evidence, limitations, and next steps. For incomplete background processes, record operation IDs, resource utilization, and known side-effects.

When resuming: read handoff notes $\rightarrow$ inspect Git state and input versions $\rightarrow$ verify background processes/services/data $\rightarrow$ run baseline checks $\rightarrow$ select next action. Never assume command timeouts imply an absence of external mutations. Missing business decisions regress to Phase 1; environment blockers halt dependent tasks while unblocking independent work.
