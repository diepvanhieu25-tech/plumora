# Task: [ID and Title]

- Objective and referenced requirement / version:
- In-scope vs out-of-scope boundaries; target file boundaries:
- Initial Git baseline: task branch (`feat/...`, `fix/...`), base commit, uncommitted working tree diff:
- Task owner, dependencies, and missing inputs:
- Authoritative decisions serving as baseline; open proposals/questions and blocked downstream tasks:
- Acceptance criterion IDs (`AC-ID`) and observable outcomes:
- Verification harness, execution environment, test data fixtures, and required permissions:
- Operational risks, rollback plan, and required user sign-off points:
- Task status, verification evidence, and next steps:

By default, execute tasks sequentially. Status lifecycle values: `draft` / `ready` / `running` / `verifying` / `blocked` / `rework` / `accepted`; these represent tracking markers, not automated orchestration state. When inputs change, re-evaluate affected outcomes; `accepted` does not imply production deployment.

A task can only transition to `ready` when its inputs are finalized for its specific scope. Completing a DRAFT specification or mocking external dependencies does not automatically unblock tasks depending on missing business decisions.

## 1. Execution and Handover Methodology

- Workflow stage, coordinating skill, and specialized capabilities required:
- Reference documentation and existing tooling; supplementary requirements (if any):
- Observable deliverables and concrete definition of done:
- Foundational checks / change-level verification / end-to-end integration step:
- On failure: triage location, blocked scope, resolution owner, and unblock criteria:
- On requirement change: criteria, tasks, and test evidence requiring re-evaluation:
- Handover recipient and immediate next step:

Skill references do not mandate package installations or subagent invocations. Target file boundaries describe anticipated scope, not filesystem permission enforcement.

## 2. Preconditions Prior to Business Code

- Referenced implementation plan and environment readiness dossier:
- Verified runtime tools, credentials, and target database/service endpoints:
- Unblocked vs blocked scopes, supporting evidence, and parity discrepancies:
- Executable test harness ready; missing implementation failures distinguished from environment errors:

## 3. Value, Design and Evidence Mapping

- Capability/domain → journey → vertical slice → this task → AC/assertion:
- Approved System Design / Design System / diagram IDs, versions and decision references:
- UI route/action → component/state/token → API/event → permission → persistence → result/error (or reason not applicable):
- Authoritative data source, backend readiness and missing design/integration dependencies:
- Effort/rationale, technical debt owner/closure condition and integration verification task for horizontal work:
- Required verification layers, browser interactions/E2E depth by risk, snapshot identity and expected artifacts:

Readiness requires all decisions needed by this slice; an unresolved upstream decision blocks its dependents. Record change impacts on linked contracts, tasks and evidence rather than silently reducing acceptance criteria.
