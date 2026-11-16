# Handover: [Task and Timestamp]

- Task objective, referenced requirement / version, and applicable acceptance criteria:
- Completed scope, confirmed decisions, and modified files:
- Git status: standardized task branch (`feat/...`, `fix/...`, `refactor/...`), commit hash, clean working tree (`git status`), uncommitted user changes:
- When evaluating skill usage: skill source/version, CLI environment, observed invocation/loading evidence, and unverified assumptions (do not infer loading solely from configuration):
- Executed verification commands, exit codes, observable outputs, and evidence paths:
- Criteria: Passed / Failed / Unchecked / N/A with rationale:
- Environmental errors, known limitations, assumptions, or open decisions:
- External processes, services, or side-effects that must be reconciled before re-testing:
- Handover status and immediate next step:

Fill in empirical data. Declaring handover readiness does not constitute acceptance or deployment approval.

## 1. Ingestion and Re-Verification

- Source stage / gate $\rightarrow$ next stage and designated recipient:
- Open findings, resolution owners, and approved exception decisions (if any):
- Requirements, code, configuration, or environment changes since the last verification pass:
- Valid reusable evidence vs required re-runs with justification:
- Resumption preconditions: reconcile Git/version, active processes, resources, and baseline checks:

| Executed Verification Command | Environment / Version | Exit Code & Observed Output | Evidence Path & Known Limits |
| --- | --- | --- | --- |
| [CLI command / action or noted unexecuted] | [Authoritative source] | [Actual output; if unexecuted, do not write exit code 0] | [Artifact location and boundaries] |

## 2. Preparation and Behavioral Parity

- Implementation plan / acceptance matrix and environment dossier: source and version:
- Pre-code readiness conditions: timestamps and verified empirical evidence:
- Target parity baseline (production or approved architectural design): remaining discrepancies, impacts, and accepted decisions:
- Test database fixtures, permissions, and mock isolation boundaries:

Document unverified items when historical evidence is lacking; never infer that procedures were executed correctly solely from current code state.

## Integration and Browser Evidence

- AC/test IDs → real user entry point/journey → UI/state → API/auth → persistence/reload assertions (or applicability rationale):
- Approved design/component/token revisions; missing contracts and blocked dependents:
- Mock inventory: location, boundary, purpose, environment, replacement condition; live third-party limits:
- Source/config/test snapshot including relevant dirty files; required checks and terminal command/tool results:
- Browser URL/environment/dataset/role, steps, expected/actual; exploratory findings and regressions:
- Artifact paths/hashes (runner/trace/network/console/data assertions); no secrets:
- IMPLEMENTED / VERIFIED / BLOCKED or NOT RUN; invalidated evidence and next owner/action:

Unit/build pass, HTTP 200, screenshot, tool-call count or background launch alone does not establish integrated behavior. Missing browser capability requires equivalent authorized tooling with evidence or a blocker.
