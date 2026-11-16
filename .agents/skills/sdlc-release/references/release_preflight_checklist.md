# Release Preflight Checklist

Select items applicable to the target environment and deployment model. Every item records pass / fail / unexecuted / not-applicable with explicit rationale and evidence.

- Source version and packaged artifact match verified Gate 3 evidence; container images use content digests or immutable tags (`vX.Y.Z-commit_sha`). Using `:latest` in production is STRICTLY FORBIDDEN.
- Execution runbooks, mandatory environment variables, service permissions, and network routes verified; templates contain zero real secrets.
- Container packaging: enforces multi-stage builds, non-root runtime users (`USER node`/`appuser`), minimal `.dockerignore`, and hardened base images. See [Packaging Standards](production_packaging_and_safe_rollout.md).
- Database migrations: enforces Expand & Contract pattern for zero downtime; snapshot backups verified prior to migration. See [Safe Migrations](production_packaging_and_safe_rollout.md).
- Three-Barrier Post-Deployment Smoke Test prepared (`/healthz` probe, critical business path API test, SSL/TLS and security headers audit). See [Smoke Test Protocol](production_packaging_and_safe_rollout.md).
- Three-pillar observability operationalized (Structured JSON Logs, RED Method metrics, scheduled health verification via `/schedule`), alert thresholds defined, and on-call owner designated.
- Deployment authorizations verified; if permissions for live production changes are missing, hand off the prepared release candidate with specific commands requiring human sign-off.

Canary rollouts require dedicated traffic infrastructure and verified metrics thresholds. Missing telemetry does not imply stability. Automated CI/CD is not mandatory for controlled manual deployments.

## From Environment Design to Verified Artifact

Cross-reference target matrices against live environments: runtime versions, configuration bindings, IAM permissions, database schema versions, and ingress routing. Architecture designs do not prove that production is running. If Gate 3 evidence changes, invalidate downstream artifacts and re-verify before deployment.

Execute runbooks against clean workspaces: packaging commands must exist, artifacts must contain required assets, initialization/migration sequence must be correct, and endpoints must be accessible. Static config audits do not substitute for live execution; health checks do not substitute for critical business path testing. Without authorization, hand off preparation bundles; never deploy unilaterally.

## Source-to-Target Evidence Chain

Record source commit or immutable file manifest (including relevant dirty inputs), build configuration/dependency identity, artifact digest, G3 reviewed identity, target identity and explicit operation authority. Every link needs actual command/output or a named gap; a prepared artifact is not deployed. Changed source/config/build inputs or artifact bytes require impact analysis and re-verification; an unchanged source hash alone does not validate a rebuilt artifact. Carry only evidence that remains valid for the actual candidate.

Link post-deploy critical-path assertions to AC, serving artifact/version, environment and time. Confirm auth/data/persistence where applicable; process health alone is insufficient. Missing target means not-deployed; missing authority blocks live steps; missing telemetry/window/sample coverage leaves observing or blocked, not stable. Keep preparation checks, CI, runtime smoke and production observations separate. Record recipient, operation IDs, limitations and next authorized action.
