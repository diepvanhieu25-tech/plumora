# Risk-Based Verification & Multi-Layer Execution

Invoked during Steps 3.1–3.3. Inputs: requirements/criteria, architecture design, Phase 1 risk plan, and Gate 2 handoff evidence against the exact commit version. Evaluate code independently before reviewing developer claims.

## 1. Pre-Execution Verification Matrix

Every criteria ID requires an explicit test assertion, verification layer, environment/dataset, passing condition, and expected evidence. Update the plan as new risks emerge; never lower acceptance criteria after observing test failures.

| Risk / Change Type | Typical Applicable Layer & Scope |
| --- | --- |
| Documentation or configuration with zero runtime impact | Layer 1: validity, links, synchronization, and content audit |
| Business logic, state transitions, boundary edge cases | Layer 1 baseline and Layer 2 test quality; mutation testing proportional to risk |
| Cross-layer UI $\rightarrow$ API $\rightarrow$ Database integration | Layer 1 baseline and Layer 3 end-to-end integration flows |
| Multi-tenant data isolation, sensitive actions, authorization | Layer 1 baseline, Layer 3/4 authorization audits; unit test passes do not suffice |
| Concurrency, idempotency, or high-throughput requirements | Layer 1 baseline and Layer 4 invariant/concurrency/load testing; add Layer 3 for UI |

Omissions require explicit risk-based rationale; do not arbitrarily select tools merely to populate lists.

## 2. Four Verification Layers: Execution & Evidence

| Layer | Execution Strategy | Evidence & Boundaries |
| --- | --- | --- |
| **1 — Baseline** | Run build/lint/typecheck, unit, and integration tests; run secret scanners, dependency audits, and static analysis | Commands, environment, exit codes, reports, test counts; isolate infrastructure errors |
| **2 — Test Quality** | Audit assertion strength, boundary values, error branches, and SUT invocation; apply mutation testing on critical logic | Negative cases must fail; document mutation scope, unexecuted states, and exclusions |
| **3 — End-to-End / UX** | Seed isolated test data, navigate user journeys through UI/API to database; verify 5 UX states, a11y, keyboard flows | Prerequisites, actions, behavioral assertions, traces/screenshots; single screenshots do not prove data validity |
| **4 — Adversarial / Load** | Test privilege escalation, adversarial payloads, race conditions, and load thresholds; verify invariant preservation | Authorized scope, test data, seeds, load levels, duration, abort thresholds; missing metrics denote unverified |

Use tools appropriate to stack and granted permissions. If tools are missing, document blockers and approved fallbacks; never install packages based on guesswork. Manual checks must document observable steps, not merely "inspected".

## 3. Controlled Execution Protocol

1. Confirm exact revision, target URL/port, test accounts, and permissions. Use isolated environments for writes; review permissions never grant production access.
2. Run reproducible commands; record stdout, stderr, exit codes, and timeouts. Never treat missing results as passes; never retry-to-green to disguise flaky tests.
3. For exploratory browser testing, record findings and convert critical flows into automated assertions or stable reproduction steps. Page loading does not prove application correctness.
4. For concurrency/load, monitor data invariants and business errors in addition to latency. Abort immediately upon reaching safety limits.
5. Route findings to the [Finding & Rework Protocol](finding_and_rework.md); audit against the [Four-Axis Checklist](four_axis_audit_checklist.md).

## 4. Criteria-Based Acceptance

Using the [Verification Template](../resources/verification_template.md), classify results as pass / fail / unexecuted / not-applicable. Omissions require rationale; unexecuted items require root cause and remediation steps. Document commit version, environment, commands, and artifact locations.

Multiple checks covering one criterion do not imply that unrelated risks are mitigated. Code or configuration modifications post-test require identifying invalidated checks and re-verifying integrated builds. Local tests, CI runs, and production checks are distinct evidence types.

## 5. Lifecycle Quality & Traceability

Cross-reference intent, specifications, architecture design, and Gate 2 handoff evidence; record missing history as unverified rather than fabricating audit trails. Criteria IDs must strictly match test semantics: a password-change test does not verify origin-header validation.

Test multi-dimensional combinations (state $\times$ role $\times$ timing $\times$ concurrency). Prioritize repeated mutations, dropped connections followed by retries, concurrent duplicate locks, stale versions, and contract boundary drift. Green test suites alone do not substitute for comprehensive criteria coverage.

## 6. Evidence Integrity and Browser Verification

Select depth by risk without dropping browser interaction required by approved UI criteria. Verify tool availability with a non-destructive call; use equivalent authorized tooling or record BLOCKED/NOT RUN. Failed/unexecuted checks cannot become not-applicable retroactively.

For each AC record assertion/test ID, SUT entry point, source/config/test snapshot (including dirty files), environment/dataset/role, expected/actual, terminal command/tool result/exit code and artifact identity. Inspect runner output and assertion semantics. Counts, screenshots, HTTP 200, a tool invocation, process launch or self-declared pass do not prove behavior. Confirm real UI→API→auth→persistence→reload and applicable error/denial paths; inspect network/console/trace plus data assertions. Browser actions must start at approved entry points, not injected DOM/debug shortcuts or fabricated SUT state.

Audit mock inventory and actual imports/targets/endpoints: unit/component boundaries, isolated fixtures and constants can be valid; mocked backend/DB inside full-stack SUT cannot establish integration. Third-party stubs disclose unverified live boundaries. Verify algorithm/training/inference claims against actual implementation and execution; keyword scans alone neither prove nor refute them. For critical assertions, demonstrate that the negative case fails before the fix and passes afterward where applicable.

Explore navigation, layout, keyboard/focus, responsive behavior and five UX states; record steps/findings and turn critical failures into reproducible regressions. Design gaps route to P1; implementation/test/environment defects route to the appropriate phase based on proven root cause, not client/model blame.

Compare current hashes with test and review snapshots. Missing artifacts, unfinished tasks, stale source/config/test identities or inadequate assertions leave criteria unverified. Preserve valid unaffected evidence with rationale; rerun impacted checks and integrated verification after changes. Keep IMPLEMENTED, VERIFIED and final independent G3 acceptance distinct. Evaluate all four axes; document technical non-applicability per axis.
