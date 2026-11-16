# Incident Investigation, OODA Loop & Lessons Learned

Invoked during Step 4.4 upon active symptoms or alert triggers. The OODA loop (Observe-Orient-Decide-Act) is executed by the human coordinator and agent; it does not assume continuous autonomous self-healing daemons.

## 1. Observe: Establish the Crime Scene

Record incident ID, timestamp (with timezone), incident commander, observed symptoms, and blast radius. Identify deployed versions, target environments, recent changes, and affected data partitions. Collect available telemetry (logs, metrics, distributed traces) within granted permissions; sanitize secrets and personally identifiable information (PII) before storage.

Document missing telemetry sources rather than fabricating metrics. Preserve ephemeral evidence before executing destructive mitigation when feasible; however, do not delay authorized blast-radius containment solely to collect logs.

## 2. Orient: Formulate & Test Hypotheses

Construct a timeline of deployments, configuration shifts, data migrations, and dependency changes; correlate symptoms with suspect events. Use an evidence matrix:

| Hypothesis | Expected Prediction if True | Verification Test within Scope | Supporting / Refuting Evidence | Status |
| --- | --- | --- | --- | --- |
| [Suspected root cause] | [Observable signal] | [Query / command / probe] | [Source and timestamp] | Untested / Supported / Refuted / Inconclusive |

Temporal correlation does not prove causation. For example, a failing task update might stem from schema divergence, permission drift, or environment timeouts. Design tests capable of isolating competing hypotheses rather than blindly repeating the failed operation.

## 3. Decide: Select Remediation Action

Evaluate blast radius, granted permissions, data state, and reversibility. Execute approved runbooks; see [Rollout & Recovery](rollout_and_recovery.md) for rollback vs fix-forward decisions. Define expected impact, abort conditions, verification criteria, and designated owner.

If permissions for restarts, scaling, or rollbacks are insufficient, hand off specific commands requiring human sign-off; never tamper with permission policies. Authorized mitigation can proceed ahead of permanent code patches.

## 4. Act: Contain Blast Radius & Verify

Log every command, operation ID, timestamp, output, and post-action version. If interrupted, verify live state before retrying. Validate symptoms, core user paths, and data integrity; maintain observing status until signals stabilize.

For code fixes: verify that original criteria remain valid, construct a reproducible test case with sanitized fixtures, keep the patch minimal, and route through Phase 2 $\rightarrow$ Phase 3 $\rightarrow$ Phase 4. Architectural or requirements shifts regress to Phase 1. Never bundle unrelated refactorings into emergency hotfixes; avoid rigid time quotas for root cause conclusions.

## 5. Root Cause Analysis (RCA) & Incident Closure

Using the [Incident RCA Template](../resources/incident_rca_template.md), link symptoms $\rightarrow$ verified failure mechanisms $\rightarrow$ contributing factors $\rightarrow$ detection/prevention gaps. The 5-Whys methodology is an analytical aid, not a rigid quota for exactly five levels.

Distinguish three distinct operational states: **Mitigated**, **Verified Restored**, and **Root Cause Determined**. Systems may be restored before the root cause is isolated; never close an active investigation merely because symptoms dissipated.

Record lessons learned in markdown or optional [Lessons JSON](../resources/lessons_template.json). Document preventive actions, owners, deadlines, and verification tests; a lesson does not unilaterally create policy. `.direwolf_memory/lessons.json` is an optional convention.

If stalled: hand off the current scene, evaluated hypotheses, missing authorizations, and recommended next steps. Autonomous self-healing requires dedicated infrastructure, bounded permissions, loop prevention, and verification checkpoints.
