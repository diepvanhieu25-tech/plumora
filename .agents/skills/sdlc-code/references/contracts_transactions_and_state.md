# Contracts, Transactions & State in Implementation

Invoked in Step 2.3 when behaviors span multiple components, persist state, execute retries, or handle concurrent requests. Adheres to authoritative specifications and architecture designs; if strategies for preserving invariants are missing, regress to Phase 1 design before modifying dependent code.

## End-to-End Producer and Consumer Verification

Trace operations from request payload $\rightarrow$ query parameters $\rightarrow$ responses/errors $\rightarrow$ database state $\rightarrow$ background domain events $\rightarrow$ user notification. Maintain identical field names, types, units, timezones, and semantics across boundaries. Enforce shared schemas with runtime boundary validation; identical declarations across disconnected services do not guarantee correct integration.

Example: If an appointment service produces an event with `newStartAt` while an email service parses `startAt`, permissive payloads may bypass compile-time checks while breaking runtime notifications. Tests must verify the pipeline from producer payload to rendered email output; verifying message insertion into a queue table alone is insufficient.

## Invariant Preservation in Transactions

- Validate ownership, permissions, and state transition guards within the actual mutation transaction. All create, update, or cancel paths must preserve shared business invariants (scheduling windows, working hours, capacity constraints).
- Read-then-write patterns by identifier introduce race windows. Use optimistic concurrency checks (`version` increments) or pessimistic locks (`SELECT ... FOR UPDATE`) per design; verify affected row counts and conflict responses (`409 Conflict`).
- Multi-table mutations, audit trails, and transactional outbox events must execute atomically. Database role permissions must enforce constraints (such as append-only audit tables); test using the real application role.
- Idempotency keys must survive retries of the same intent even after network drops; handle concurrency when idempotency records do not yet exist. Unique background job deduplication keys must allow legitimate subsequent updates without collision.
- Test concurrency semantics using live multi-connection tests against the target database engine. Sequential test executions do not demonstrate concurrency safety.

## Lifecycle Regression Scenarios

Select high-risk scenario combinations: state $\times$ role $\times$ time $\times$ iteration $\times$ concurrency. Examples: duplicate mutations; cancellation immediately following reschedule; concurrent updates on identical versions; parallel requests with the same idempotency key; server commits but client loses response; midnight boundaries across differing client and server timezones.

Assert final state across tables, outbox events, and notifications, including assertions that untouched entities remain unmodified upon transaction failure. Mock external boundaries only at well-defined interfaces, keeping the System Under Test (SUT) real.
