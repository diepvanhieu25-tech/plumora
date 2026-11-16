---
name: sdlc-review
description: "Independently evaluate code against original requirements, perform risk-based 4-axis verification and adversarial testing, trace root causes, and audit technical debt."
---

# Phase 3 — Verification & Adversarial Testing

Inputs: original requirements/criteria, exact commit or snapshot manifest, and Gate 2 handoff evidence. Evaluate code independently before reviewing developer claims. Requires Context Isolation via Zero-Knowledge Review to eliminate confirmation bias and self-rationalization; rely exclusively on objective facts (Specifications, Git Diff, Test Logs) without inheriting chat transcripts or subjective developer commentary. Use a fresh-context independent subagent (`Adversarial Reviewer`) or a separate isolated session. If neither is available, block G3; self-checks cannot satisfy independent review.

## Context Loading

Start with original criteria, exact diff/version, and test logs in fresh context. Select references by risk; open the four-axis checklist for the review, tooling dispatch only for actual tool/session decisions. Record why application UI or database checks are inapplicable. Do not inherit implementation transcripts or load unrelated phase manuals.

## Execution Steps & Specialized Skills

| Step | Actions & Competencies | References / Deliverables |
| --- | --- | --- |
| 3.1 — Planning | Cross-reference intent/spec/design, implementation plan, environment, and versions; map criteria IDs to test assertions | [Risk-Based Verification](references/risk_based_verification.md), [Tooling & Subagent Dispatch](references/tooling_and_subagent_dispatch.md); criteria-layer-environment-evidence matrix |
| 3.2 — Test Quality & Audit | Execute baseline checks; conduct comprehensive Four-Axis Audit (UI/UX & a11y, Code Quality & Clean Arch, OWASP Security, DB Performance & Concurrency), audit assertion strength, edge cases, and mutations | [Four-Axis Audit Checklist](references/four_axis_audit_checklist.md); commands, exit codes, and coverage boundaries |
| 3.3 — E2E & Adversarial | Select applicable UI, security, DB and concurrency checks; use supported tools and an independent adversarial reviewer in a fresh-context subagent or separate isolated session | [Execution of Layers](references/risk_based_verification.md), [Tooling & Subagent Dispatch](references/tooling_and_subagent_dispatch.md); target scope, test data, abort criteria, and evidence |
| 3.4 — Finding Triage & G3 | Trace symptoms back to requirements, contracts, code, or environment; route to remediation stage; audit technical debt and regression evidence | [Finding & Rework Guide](references/finding_and_rework.md), [Verification Template](resources/verification_template.md) |

## Risk-Based Layer Selection

Layer 1 is baseline checks for the change type. Layer 2 audits test quality, Layer 3 verifies end-to-end experience, Layer 4 tests adversarial resilience and load. Selected in Phase 1 and updated as risks emerge; document rationale for unapplied layers. Never reclassify a failed layer as non-applicable; avoid universal tool mandates.

## Gate 3 — Handoff and Boundaries

- Every criteria ID requires verified evidence on the exact commit or snapshot manifest; blocking defects resolved, fixes re-tested, and integrated build state evaluated.
- Exceptions document owner, rationale, residual risk, deadline, and explicit authorized sign-off. The user reviews critical diffs and behaviors; agents never self-authorize merges or deployments.
- Record version, verification matrix, findings, commands/environments, limitations, recipient, and next actions. Local test runs, CI runs, and content audits are distinct evidence types.

Evaluating the wrong version or divergent criteria demonstrates an absence of acceptance evidence, not developer error. An evaluating agent may conclude technical rework is needed within its isolated review. Do not invent mandatory review hierarchies or unapproved exception policies.

## Rework, Changes & Continuity

When defects occur, follow the finding triage protocol in Step 3.4: record discovery location, proven root causes, and remediation target; trace requirements $\rightarrow$ design $\rightarrow$ code $\rightarrow$ tests/environment. Remediate at the root cause, update dependent tasks, and return to Gate 3. Keep unproven causes as active hypotheses; never modify specifications to rationalize code defects.

Reviewers modifying code must re-execute all verification checks; never inherit pass labels from prior versions. Close findings only when original tests, regression suites, and integrated builds pass with hard evidence; deferred fixes require owner, risk assessment, deadline, and sign-off.

Resume by inspecting handoff notes, Git state, requirements sources, and active test environments. Never retry-to-green to disguise flaky tests; never treat missing evidence as a pass.

## Optional Evidence Checker

For C2 v1 structured records, see [Evidence record contract](references/evidence_record_contract.md) and the portable [checker](resources/evidence_checker.py). It validates declared files/results only; it does not establish approval authenticity, complete check selection or product correctness. Its absence does not waive review or evidence obligations.
