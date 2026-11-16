# Implementation Planning & Pre-Code Readiness

Invoked in Steps 2.1–2.2 before writing business logic or when environments/contracts shift. This readiness check is part of Phase 2; Gate 2 represents the post-implementation handoff, not an environment readiness label.

## 1. Implementation Plan Structure

Ingest approved requirements/design versions, inspect Git state, build commands, and permissions. Use the [Implementation Plan Template](../resources/implementation_plan_template.md) for `docs/plan.md` on greenfield projects. For existing tasks (`tasks.md`), map and extend them; avoid maintaining competing task plans.

Each task documents: outcome/criteria, scope, sequence/dependencies, owner, capabilities, verified tooling, environment/fixtures, test harness, pass/abort conditions, and evidence. Multi-domain specifications require explicit integration milestones; ambiguous sections remain blocked. Never assume generic tools exist without explicit validation.

## 2. Behavioral Parity: Local vs Target Production

Use the [Environment Readiness Template](../resources/environment_readiness_template.md) for `docs/environment.md`. For each relevant dimension, record target baseline, local state, verification command, drift, impact, and operational decision:

- Runtime / OS, service versions, package lockfiles.
- Database extensions, schemas, migrations, collations, timezones, and role permissions.
- Queue/cache brokers, ordering semantics, retry policies, TTL expirations, and external APIs.
- Ingress routing, reverse proxies, CORS origins, session cookies, TLS termination, and container build manifests.

"1:1 Parity" denotes verified equivalence across behavior-influencing characteristics. Running Docker containers alone does not prove parity. If production does not yet exist, compare against the approved Phase 1 design. Unreproducible cloud services must be noted as documented limitations; unresolved behavioral drift blocks dependent tasks. Authorized human sign-off is required for exceptions.

Test datasets, mock secrets, and test accounts must remain strictly segregated from production; never copy live production datasets to simulate parity. Before destructive operations, verify the target URL and credentials; variable names like `TEST_DATABASE_URL` do not guarantee safety. Test teardowns must clean only owned test records; never truncate shared tables unprompted.

## 3. Test Harness Readiness & Progression Gates

Map acceptance criteria to unit, integration, contract, E2E, and adversarial tests proportional to risk. Prepare test runners, seed fixtures, and initial test files before coding. Verify infrastructure connectivity, credentials, and migrations; see [Environment & Integration](environment_and_integration.md).

Distinguish four operational test states:
1. Test harness is executable.
2. Product tests fail expectedly due to missing business logic (RED).
3. Test commands fail due to infrastructure/tooling errors (blocker).
4. Tests remain unexecuted.

Never demand all tests pass green before code exists; conversely, never bypass infrastructure failures by mocking out the System Under Test.

Advance to Step 2.3 only within scopes with verified inputs, feasible plans, configured environments, isolated test data, executable test harnesses, and resolved behavioral drift. Independent tasks continue within scoped boundaries; coding permissions never authorize skipping preparation steps.

## 4. Real Integration and UI Readiness

Trace AC → journey → route/action → component/state → API/event → authorization → persistence → user result/error before implementing a functional slice. Confirm approved representative layouts/components, five states and API mapping; new navigation, screens or business decisions return to P1. Reuse approved components without inventing a debug page/button/modal to make tests pass. Missing backend contracts or services block integration; independent prototypes/unit work remain explicitly scoped and cannot be accepted as full-stack functionality.

Keep a mock inventory: location, purpose, test boundary, environment and replacement condition. Unit/component boundary mocks, isolated seed/fixtures, approved prototypes, static content and legitimate business constants remain valid. Never mock backend/DB inside the full-stack SUT. Third-party stubs disclose the unverified live boundary. Keyword scans create findings for inspection, not automatic violations. Algorithm claims (for example PPO/DQN) require actual training/inference evidence; heuristics must be labeled as such.

Self-test unit/component rules, real integration/contracts and applicable browser journeys. For UI changes, actually navigate/click/type from the approved user entry point; check layout/focus/responsive and record exploratory findings. Select E2E depth and error branches by AC/risk. Verify UI→real API→auth→persistence→reload/new session, denial and controlled API error/timeout: errors must not produce hardcoded success. Tests must exercise the real SUT, never injected DOM or fabricated application state.

Evidence records AC/test IDs, source/config/test snapshot including relevant dirty files, URL, environment/dataset/role (no secrets), expected/actual steps, runner command/tool output and terminal exit code, artifact paths/hashes and limits. Trace/network/console and persistence assertions complement screenshots; a browser call, HTTP 200, test count or screenshot alone is insufficient. Confirm tool availability with a non-destructive call; use authorized equivalent browser tooling or mark BLOCKED/NOT RUN.

Separate IMPLEMENTED from VERIFIED and blockers. Capture background task completion; process launch is not test success. Convert critical exploratory failures into regression/reproduction steps. Code/config/input changes invalidate affected evidence; retain old results and rerun against the current snapshot before handoff.
