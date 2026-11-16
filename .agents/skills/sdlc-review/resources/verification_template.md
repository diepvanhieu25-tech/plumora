# Verification Dossier: [Task]

- Requirement reference & version, Git branch/commit hash, or working tree state:
- Reviewer/auditor identity, audit scope, test environment, and tool dependencies:
- Skill adoption verification: skill source/version, CLI environment, evidence of invocation/loading, and unverified assumptions:
- Selected vs omitted verification tiers with technical justification:

| Criterion | Verification Command / Observed Behavior | Result (Pass / Fail / Unexecuted / N/A) | Empirical Evidence / Rationale |
| --- | --- | --- | --- |
| [AC-ID] | [Verification command or procedure] | [Result] | [Authoritative log output / artifact path] |

## 1. Audit Findings

- Finding ID, related criterion ID, severity, and codebase version:
- Classification: Code Bug / Requirement Gap / Test Defect / Environment Issue / Security Defect:
- Preconditions, reproduction steps, expected outcome, and actual observed behavior:
- Empirical evidence, assigned owner, and re-verification result:
- Detection locus vs confirmed root cause location:
- Root cause tracing: Intent $\rightarrow$ Criteria $\rightarrow$ Architecture/Contract $\rightarrow$ Code $\rightarrow$ Test Harness $\rightarrow$ Environment:
- Remediating stage/step, target files/tasks, assignee, and routing justification:
- Dependent blast radius, surviving valid evidence, and invalidated test suites:
- Documented exceptions (if any): approving stakeholder, justification, and expiration date:

## 2. Phase 3 Gate Sign-Off (G3 Conclusion)

- Status: APPROVED / REWORK REQUIRED / BLOCKED; unverified criteria and outstanding defects:
- Changes introduced post-review, re-test outputs, and stakeholder decisions:
- Next step; drafting a verification report does not confer merge or deployment authority:

## 3. Verification Plan and Remediation Loops

| Criterion / Risk | Verification Tier (1–4) | Target Environment & Permissions | Pass / Fail Criteria | Resolution Owner on Failure |
| --- | --- | --- | --- | --- |
| [AC-ID / Risk] | [Tiers 1–4 or justification for omission] | [Authorized test environment] | [Observable invariants] | [Owner / Remediation stage] |

- Pre-fix vs post-fix version diff and additional modification scope:
- Reproduction test results, relevant regression test suite, and final integrated build status:
- Finding status lifecycle: `open` / `remediated_pending_retest` / `reopened` / `closed` / `exception_accepted`:
- Stakeholder approving closure or exception, technical rationale, operational risk, and expiry deadline:

## 4. Root Cause Analysis and Residual Technical Debt

- Hypotheses, falsification tests, and confirming evidence; unresolved root causes:
- Evidence quality and limits of certainty: missing acceptance evidence is distinct from a reproduced defect; never infer developer fault solely from faulty paperwork:
- Root cause remediation vs temporary mitigations; shared contracts and documentation requiring updates:
- Regression tests capturing the failure mode, shared components audited, and re-test results:
- Deferred remediation scope (if any): description, rationale, risk profile, tracking task, and owner:
- Target resolution milestone, monitoring telemetry, temporary workaround sunset conditions, and stakeholder approval:

Do not close a finding merely because a developer reports it resolved. Requirement or code modifications made after audit require full re-verification of affected criteria.

## 5. Process Audit and Verification Completeness

- Authoritative intent, spec, architecture design, implementation plan, and environment dossier matching active version:
- Empirical readiness evidence prior to writing business code vs historical documentation gaps:
- Semantic mapping of each criterion ID against assertions in automated test suites:
- Entity lifecycles, idempotent retries, concurrency, timeout, and contract edge cases audited:
- Final pass/fail determination backed strictly by empirical command output; unexecuted tests must not be marked passed:

## 6. Snapshot, SUT and Browser Audit

- Source/config/test manifest including relevant dirty/untracked files; test/review snapshot comparison:
- AC/test ID → assertion → real SUT entry point → terminal runner output / exit code → artifact path/hash:
- Required browser capability, discovery/non-destructive call, fallback or BLOCKED/NOT RUN reason:
- Target URL/environment/dataset/role (no secrets), navigation/actions, expected/actual, exploratory findings:
- UI/API/auth/persistence/reload and error/denial assertions; trace/network/console/data evidence:
- Mock inventory and inspected boundaries; third-party live limits; unit fixtures/constants allowed within scope:
- Four-axis applicability/rationale, invalidated checks and valid surviving evidence:

Self-declared pass, background launch, DOM injection, test counts or screenshots alone do not satisfy acceptance. Return missing UI/business contracts to P1; classify proven implementation/test/environment causes separately.
