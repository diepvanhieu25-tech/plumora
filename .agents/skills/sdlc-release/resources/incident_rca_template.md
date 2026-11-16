# Incident RCA: [Incident ID and Symptoms]

Status: `investigating` / `mitigated` / `recovered_and_verified`.

## 1. Incident Context & Triage

- Incident onset timestamp, incident commander, target environment, and running version:
- Customer impact, affected user transactions, and data integrity exposure:
- Sanitized logs, metrics, distributed traces, and missing observability sources:

## 2. Investigation and Mitigation

- Incident timeline, failure hypotheses, and supporting vs falsifying evidence:
- Immediate mitigation actions taken, required credentials, and abort thresholds:
- Recovery verification results; limits of data recovery or external side-effects:

## 3. Remediation and Verification

- Did the incident expose an invalid specification or require returning to Phase 1 (G1)?
- Deterministic reproduction steps, pre-fix vs post-fix verification, and regression test results:
- Changed files and commit hashes, Phase 2/3 sign-off, and Phase 4 deployment:

## 4. Root Cause and Preventative Measures

- Empirical root cause backed by hard evidence; unproven hypotheses:
- Contributing factors, systemic flaws, and observability detection gaps:
- Preventative action items, assigned owners, resolution deadlines, and verification procedures:
- Post-incident retrospective findings and policy proposals requiring stakeholder sign-off:

Do not force an arbitrary "5 Whys" if the failure is straightforward; maintain investigating status until the root cause is conclusively proven.

## 5. Hypothesis Falsification and Closure

| Hypothesis | Predicted Symptom | Diagnostic Test | Empirical Evidence (Supporting / Refuting) | Status |
| --- | --- | --- | --- | --- |
| [Potential failure mechanism] | [Observable symptom if true] | [Test to confirm/isolate] | [Evidence source and timestamp] | [Untested / Inconclusive / Supported / Refuted] |

- Mitigation status: actions taken, observed reduction in error rate, and known constraints:
- Recovery verification: active version, data integrity checks, and user flow health:
- Conclusive root cause confirmed vs continuing investigation:
- Closure criteria, approving authority, and open tracking tickets:

Incident states advance independently; cessation of symptoms does not automatically prove root causes or close preventative action items.
