# Risk-Based Adversarial Probing Guide

Ask clarifying questions only when missing information fundamentally alters system behavior or architectural design. Survey codebase state and relevant lessons learned before querying; avoid arbitrary question quotas.

| Risk Dimension | Core Probing Focus |
| --- | --- |
| **Concurrency & Race Conditions** | What invariants are broken if two operations contend for the same resource? Who owns state mutation decisions? |
| **Partial Failure & Network Drops** | How are downstream timeouts reconciled before client retries? Are mutations idempotent? |
| **Authorization & Tenant Isolation** | Can User A read or mutate User B's resources? Where are authorization checks enforced? |
| **Data Boundaries & Edge Cases** | What are the explicit system responses for empty payloads, extremes, duplicates, and malformed inputs? |
| **Data Recovery & Inversion** | Is state remediable via forward fixes, application rollbacks, or point-in-time snapshot restores? |

Frame questions concisely with structured trade-off analysis. Idempotency guarantees are applied where duplicate execution causes side-effects; avoid blanket key/TTL mandates across read-only APIs. Map approved decisions into acceptance criteria; record unresolved questions as blocked dependencies.

## From Inquiry to Baseline Decision

For each ambiguity: gather existing facts $\rightarrow$ articulate specific risk $\rightarrow$ present concrete options and trade-offs $\rightarrow$ record decision or active proposal $\rightarrow$ link to criteria and task DAG. If the codebase or contract already defines behavior, cite authoritative sources rather than re-asking.

Example: Can User B edit User A's task? If not, formulate criteria that B's request is rejected with `403 Forbidden` while A's data remains untouched. System design specifies middleware checks; task plan includes multi-tenant test suites. If business rules are unresolved, dependent authorization code remains blocked.
