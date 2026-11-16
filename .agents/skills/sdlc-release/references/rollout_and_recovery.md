# Rollout Execution & Recovery Runbooks

Invoked during Steps 4.1–4.3. Inputs: Gate 3 evidence, packaged artifacts, target environment, active permissions, and data requirements. Prepare candidates if permissions to impact live environments are missing.

## 1. Actionable Deployment Runbooks

Can be maintained within the [Release Template](../resources/release_template.md) or a dedicated runbook.

| Element | Required Information |
| --- | --- |
| Target & Identifiers | Target environment, source commit, artifact digest/tag, verification command for active version |
| Entry Criteria | Verified Gate 3 pass, validated configs, dependencies, IAM permissions, pre-migration backups |
| Execution Steps | Exact command sequence, designated operator, expected blast radius, verification checkpoints |
| Abort Thresholds | Command failure, version mismatch, error rates exceeding limits, unresolved data corruption |
| Recovery Plan | Application rollback, fix-forward patch, or database restoration; authorized operator and limitations |
| Target Verification | Version probe, critical path smoke test, database connectivity, telemetry health check |
| Final State | Status, on-call owner, residual operational risks, and monitoring schedule |

Never document speculative commands as tested. If destructive actions or unproven commands exist, pause and clarify; never ask users to approve undefined operations.

## 2. Proportional Deployment Strategies

Standard single-service deployments can be manual: prepare $\rightarrow$ verify configs/data $\rightarrow$ execute authorized commands $\rightarrow$ three-barrier smoke test $\rightarrow$ observe telemetry $\rightarrow$ confirm stability or rollback. Advanced infrastructure (Kubernetes, canary controllers, dedicated staging) is not required unless project scope demands it.

When using rolling, blue-green, or canary rollouts: document traffic splitting ratios, baseline comparison windows, sample sizes, and abort automation. Without live telemetry, maintain observing status; never presume stability.

## 3. Version and Data Integrity

- Artifacts must originate from the exact G3-reviewed commit or immutable source manifest. Record build/config/dependency identity and artifact digest; rebuilding or changing inputs requires checking evidence validity, even when the commit is unchanged.
- For container images, use content digests (`@sha256:...`) or immutable version tags. Standard semantic tags alone do not guarantee immutability.
- For database migrations, document dual-write capabilities, point-of-no-return thresholds, pre-migration snapshots, and restore procedures.
- Never output secrets into logs or runbook artifacts. CI pipeline credentials do not transfer to local agent environments.

## 4. Execution & Observability

1. Cross-reference destination, image tags, data state, and permissions before execution. Log step timestamps, outputs, and operation IDs.
2. If commands hang or timeout, inspect process state, migration locks, or external APIs before retrying; prevent duplicate side-effects.
3. Verify the live serving version and trace a live user journey. Check database connectivity, credentials, and data integrity rather than merely process existence.
4. Monitor telemetry against approved thresholds. For small projects, structured logs and smoke test probes suffice; document limitations if production load is absent.
5. Record accurate state: prepared / approved / deploying / observing / stable / rolled-back / blocked / not-deployed. Without live target environments, mark "not deployed"; never claim a deployment pass.

## 5. Recovery Selection & Verification

| Scenario | Evaluated Remediation Path |
| --- | --- |
| Application defect, database schema backward-compatible | Application rollback: switch traffic or deployment image to prior version; verify version and core paths |
| Incompatible data written that prior code cannot parse | Contain blast radius; evaluate roll-forward patch, data transformation, or point-in-time restore |
| Partial database migration or interrupted external API side-effects | Reconcile live database state and transaction logs before attempting reruns |
| Telemetry inconclusive or recovery outcomes unverified | Maintain observing/blocked status; escalate to incident triage; never declare recovery prematurely |

Rolling back traffic does not undo external payment transactions, dispatched emails, or database mutations. Recovery is verified only when expected data states pass inspection. Active operational failures transition to [Incident Investigation](incident_investigation_and_5whys.md); code fixes require Phase 2/3 verification before redeployment.
