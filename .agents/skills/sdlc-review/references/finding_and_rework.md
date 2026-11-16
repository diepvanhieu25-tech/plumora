# Finding Triage, Rework Protocols & Acceptance

Invoked during Step 3.4 when test assertions fail, coverage is insufficient, or code reviews raise defects. Inputs are requirements baselines, evaluated commit versions, and evidence; an external issue tracker is optional.

## 1. Actionable Defect Documentation

Using the [Verification Template](../resources/verification_template.md), document finding ID, criteria ID, severity, commit version, prerequisites, reproduction steps, expected vs actual behavior, evidence sources, environment, and assigned owner.

For static findings where live reproduction is hazardous, link the code location and data path; explicitly state that live execution was omitted. Avoid vague assertions like "might be insecure" as proof of a defect, and never dismiss findings without an assigned owner.

## 2. Root Cause Tracing & Remediation Routing

Document **Discovery Location**, **Root Cause**, and **Remediation Target** separately. For example, a missing timestamp in an email might be detected in inbox UI, but the root cause could be schema divergence between API and background workers. Blast radius determines priority; root-cause evidence dictates remediation routing.

Bound conclusions by evidence type; AI self-rationalization (e.g., claiming "this is an edge case" or "the spec did not explicitly prohibit this") is STRICTLY FORBIDDEN. All arguments must rely on technical facts and reproducible cases.

1. Capture minimal reproduction steps or data paths; document version, input payloads, expected vs actual behavior, and data state.
2. Trace defective flows upstream: observable symptom $\rightarrow$ producer/consumer $\rightarrow$ transactions/configuration $\rightarrow$ API contracts/architecture $\rightarrow$ acceptance criteria/intent.
3. Contrast hypotheses against evidence at each boundary; select tests capable of falsifying hypotheses. Distinguish verified causes, contributing factors, and unknowns.
4. Route remediation per the matrix below; document target files, criteria IDs, and owners. If multiple root causes exist, decouple fixes and sequence dependencies.

| Proven Defect Root Cause | Routing Target | Required Fix & Re-entry Criteria |
| --- | --- | --- |
| Misunderstood intent, missing business decision | Phase 1, Intent Clarification | Reconcile with user; update intent, specification, and dependent tasks per approved decision |
| Missing or contradictory acceptance criteria | Phase 1, Specification | Update domain spec; trace impact to criteria, architecture, and tests; do not inherit prior approvals |
| Architecture, data model, or permission failure | Phase 1, System Design | Update design records, schemas, and contracts; plan compatibility/migration; route via Phase 2 |
| Missing integration steps or broken dependencies | Phase 2, Task Planning | Update DAG tasks, sequence, and end-to-end integration milestones; if design is missing, regress to Phase 1 |
| Environment, config, test data, or permission drift | Phase 2, Environment Setup | Remediate environment/data within scope; verify connectivity and parity before re-running tests |
| Implementation logic violates approved contracts | Phase 2, Implementation | Fix implementation and affected consumers; add regression test catching failure; preserve approved spec |
| Test suite asserts wrong behavior or masks SUT | Phase 3, Test Quality; Phase 2 if test code | Reconcile with requirements, fix assertions/fixtures; never weaken assertions to force green passes |
| Packaging, deployment, or recovery failure | Phase 4 Preparation; Phase 2 if code/build | Fix packaging runbooks on isolated environment; re-verify Gate 3 if changes impact deliverable |
| Security vulnerability | Appropriate design, code, env, or ops step | Apply severity-based blocking; verify both fix effectiveness and business non-regression |

Scope rework strictly to affected tasks and dependencies; document valid remaining evidence alongside re-executed tests. After remediation in any phase, return to Phase 3 for full re-verification.

## 3. Defect Classification & Blocking Severities

| Classification | Triage Protocol |
| --- | --- |
| Code defect / Regression | Route to Phase 2 with reproducible test; re-verify Gate 3; no automatic deployment authority |
| Security vulnerability | Trace to design/code/env/ops; enforce blocking gate proportional to exploitability |
| Contradictory criteria | Regress to Phase 1; identify missing decisions and invalidated evidence |
| Flaky / Invalid test | Audit test fixtures, execution order, environment, and assertions; re-verify without weakening |
| Environment / Tool failure | Document commands and logs; restore clean environment before re-testing |
| Missing permissions | Block dependent tasks or use approved fallback; document boundaries |

Severity assessments consider data integrity, blast radius, exploitability, and reversibility. Unresolved blockers halt Gate 3 sign-off.

## 4. Remediation Loops & Re-Verification

1. Assigned engineer receives exact commit version/criteria; reproduces failure before patching.
2. Remediate at the routed phase; update dependent docs/code/tests. If behavior changes, regress to Phase 1 rather than altering criteria during coding.
3. Hand off patched version with affected files, test commands, and evidence. Mark finding as "Remediated, Pending Re-verification".
4. Re-run original test and regression suites against patched version; audit Git diff for unintended side-effects.
5. Close finding only when criteria pass with hard terminal evidence. If tests fail, reopen with new evidence. Terminate edit loops when stalled.

Reviewers modifying code must execute this entire loop. Context isolation reduces blind spots; an agent evaluating its own code cannot replace independent verification.

## 5. Technical Debt Containment & Gate 3 Sign-Off

Prioritize root-cause fixes within defect scope. Avoid temporary wrapper patches that conceal component contradictions. Never expand defect fixes into unapproved full-system refactorings.

When deferring fixes or maintaining temporary workarounds, record technical debt immediately: deferred item, rationale, blast radius/risk, owner, linked task, retirement milestone, and verification criteria. A `TODO` comment does not constitute approved technical debt. Authorized sign-off is mandatory for exceptions; unapproved blockers maintain rework/blocked status. Green tests do not prove zero technical debt.

Gate 3 bundles contain verified criteria matrices, resolved findings, approved exceptions, and evaluated versions. Passing Gate 3 authorizes release preparation; it does not authorize merge or deployment.

## 6. Routing Examples

- **Email missing timestamp**: If the contract specifies `startAt` but the producer sends `newStartAt`, fix code in Phase 2 and verify end-to-end. If the contract is undefined, regress to Phase 1 design.
- **Concurrent duplicate writes**: If the design requires conditional updates or locking, fix code in Phase 2; if the design lacks concurrency strategies, regress to Phase 1, then verify race conditions in Phase 3.
- **Test accepts out-of-bounds appointments**: Audit code and test assertions; fix code in Phase 2 and test assertions in Phase 3, preserving original criteria.
- **Database lacks required extension**: Fix environment in Phase 2; acknowledge prior tests did not prove target semantics, rerun dependent tests.

## 7. Missing Evidence Is a Finding

Record missing/stale evidence with AC, snapshot, affected check and remediation owner; do not invent a product defect or blame a platform without causal logs. Distinguish missing P1 contracts, conflicting process instructions, permission/tool/environment failures, skipped available verification and reviewer acceptance of inadequate evidence. Preserve unproven causes as hypotheses. Evidence-only rework returns to the relevant execution/check step; new business/UI/architecture decisions return to P1. Re-review the resulting exact snapshot independently before final acceptance.
