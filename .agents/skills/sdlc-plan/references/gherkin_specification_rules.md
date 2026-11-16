# Writing Verifiable Acceptance Criteria

Every acceptance criterion must define a unique ID, preconditions, user/system actions, and observable outcomes. Use Gherkin (`Given/When/Then`) when structured behavior is beneficial; structured tables or unambiguous prose are equally acceptable.

```gherkin
Scenario: AC-ORDER-02 — Reject order exceeding available inventory
  Given product inventory is 1 unit and the customer has checkout authorization
  When the customer requests an order for 2 units
  Then the system responds with an OUT_OF_STOCK error contract
  And product inventory and charged balance remain unchanged
```

- Isolate test fixtures and test state to ensure deterministic, reproducible test runs; never rely on implicit execution ordering across scenarios.
- Specify exact observable results and domain invariants; avoid subjective terms like "fast", "reliable", or "secure" without measurable operational thresholds.
- Cover happy path, input validation boundaries, authorization failures, external service timeouts, and concurrency conflicts based on operational risk profile.
- A written specification scenario does not automatically become an executable automated test; document the exact test command or verification harness that validates it.
