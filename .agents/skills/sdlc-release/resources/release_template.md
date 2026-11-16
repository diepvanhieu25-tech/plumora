# Release Dossier: [Version and Target Environment]

- Integrated source baseline & version; Phase 3 (G3) sign-off evidence:
- Release artifact / image digest / build hash (if applicable):
- Behavioral changes, schema migrations, configuration changes, and external dependencies:
- Deployment authorizations, decision maker identity, and permitted rollout scope:
- Build/deployment commands and database migration procedures:
- Rollback triggers, circuit breaker thresholds, and recovery limits:
- Post-deployment smoke test suite, execution environment, and observed outputs:
- Active production version, telemetry/log endpoints, and soak monitoring window:
- Release status: `prepared` / `approved` / `deploying` / `monitoring` / `stable` / `rolled_back` / `blocked` / `undeployed`:
- Outstanding issues, designated owners, and next operational steps:

A successful build or package artifact does not prove live deployment success. Mark stable or rolled back only when backed by verified telemetry.

## 1. Operational Runbook

| Step | Entry Preconditions | Project-Specific Command / Action | Anticipated Impact | Verification Method | Rollback / Abort Trigger |
| --- | --- | --- | --- | --- | --- |
| [Step] | [Version, credentials, state] | [Concrete command or noted undefined] | [Impact] | [Verification check] | [Threshold / abort action / authority] |

- Execution credentials and operation IDs required before initiating retries:
- Baseline metrics, alarm thresholds, soak duration, and sample counts:
- Backward compatibility of older code and read/write availability during database migrations:
- Recovery strategy: rollback application code, hotfix forward, or restore database backup:
- Empirical recovery verification, completion timestamp, and verifying engineer:
- Operations handover recipient and open operational tickets:

When environments, credentials, or commands are unverified, document them explicitly as preflight gaps; an unfilled table does not constitute an actionable runbook.

## 2. Clean Environment and Source Verification

- Environment readiness dossier from development, target production architecture, and observed variances:
- Active Phase 3 approval status vs evidence invalidated by post-review code commits:
- Execution commands derived strictly from clean source checkouts, verified container images, and observed business outcomes:
- Compilation & static config check vs test run vs live deployment: require independent empirical evidence for each stage:

## 3. Candidate Identity and Operational Handoff

| AC / Operation | Reviewed source snapshot / G3 reference | Build config / Dependencies | Artifact digest | Target / Serving version | Authority reference / Scope | Smoke evidence / Terminal result | Telemetry / Window / Threshold | Status / Gap / Owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [IDs] | [Commit or manifest including dirty inputs] | [Exact inputs] | [Hash] | [Actual target or absent] | [Authorized decision] | [Command/output/data assertions] | [Actual observation or missing] | [Prepared/deployed/observing/stable/blocked/not-deployed] |

- Changed upstream inputs/artifact since review; affected approvals/checks and valid surviving evidence:
- Retry safety: operation/process/migration state, duplicate side effects and reconciliation before rerun:
- Recipient, pending blockers, next authorized action and rollback/fix-forward/data restoration evidence:

Without target record not-deployed; without authority block live changes; without adequate telemetry remain observing/blocked. Separate build/static checks from runtime smoke and production observations.
