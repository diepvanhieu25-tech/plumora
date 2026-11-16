# Intent Elicitation and Specification Decomposition

Read during Steps 1.1–1.2 upon receiving a raw brief, user request, or complex multi-feature project. The objective is to establish an authoritative baseline and produce actionable specifications before any business code is written.

## 1. Clarifying and Documenting Intent

Review available briefs and existing documentation: identify users, underlying problems, desired outcomes, in-scope vs out-of-scope boundaries, business priorities, and operational constraints. Document the provenance of facts; separate assumptions, recommendations, and decisions confirmed by authorized stakeholders. Research codebase facts prior to asking questions; focus queries strictly on decision points that alter outcomes.

Use the [Intent Template](../resources/intent_template.md) to generate `docs/intent.md` for new projects. Unresolved questions may remain in draft status, with dependent tasks explicitly blocked. Never invent business policies, deadlines, or security models, and never self-approve `APPROVED` status. Drafting authority does not convey decision-making authority.

If illustrating architectural options, label concrete values explicitly as recommendations within specs, acceptance criteria, and tasks. Do not inject silent defaults for business limits, retries, or roles and then merely ask whether the user wants to alter them. Skills provide methodology, not business decisions. Adapters and mocks can isolate external systems, but they cannot resolve missing business policy decisions.

Existing detailed specification files can serve as the authoritative intent baseline; preserve original sources and document the mapping. For existing codebases, append missing context into logical locations rather than renaming or reorganizing authoritative files. Minor bugfixes based on valid baselines may reference existing intent without re-interviewing the entire system.

## 2. Specification Decomposition

From the clarified intent, identify functional domains, actors, state, permissions, primary flows, error handling, entity lifecycles, and domain invariants. Assign unique acceptance criterion IDs (`AC-ID`) with concrete `Input $\rightarrow$ Action $\rightarrow$ Expected Outcome` examples. Non-functional requirements (NFRs) require verifiable measurement conditions; unmeasured metrics must be labeled as hypotheses. Every requirement must trace directly to the intent baseline or an authorized decision record.

Small projects utilize a single `docs/spec.md`. For multi-domain systems with divergent lifecycles or ownership:

- `docs/spec.md`: maintains high-level objectives, feature catalog, shared invariants, priority dependencies, and links to detailed domain specifications in `docs/specs/`.
- Detailed specs (`docs/specs/*.md`): maintain scope, version provenance, feature-prefixed criterion IDs, permissions/data models, contracts, dependencies, and acceptance procedures.
- Every business rule must have exactly one authoritative source; other documents reference it without duplicating. Trace cross-feature workflows (e.g., cancel appointment $\rightarrow$ release time slot $\rightarrow$ revoke notification reminder).
- Slice tasks vertically by business outcome; avoid separating into frontend/backend/database silos without an overarching end-to-end integration verification step. Do not force an arbitrary file count.

## 3. Analysis, Design, and Diagrams

A specification describes *what* behavior is required; design defines *how* the system achieves it. They may be combined for brief changes but must cleanly separate business decisions from technical implementation details. Refer to the [Contracts Guide](architecture_and_contracts.md) and [Architecture Template](../resources/architecture_template.md).

| Architectural Dimension | Required Analysis / Diagram | Verification Focus |
| --- | --- | --- |
| Multiple actors / third-party services | System Context & Trust Boundaries | Caller identities, sensitive data crossing boundaries |
| Distributed components & environments | Component & Deployment Diagram | Services, runtime versions, connection credentials baseline |
| Multi-step business / data pipelines | Activity / Data Flow Diagram | Error branches, external side effects, invariant states |
| Relational data models | Entity-Relationship Diagram (ERD) | Ownership, foreign key constraints, audit logs, PII |
| Critical interactions, retries, concurrency | Sequence Diagram | Transaction boundaries, locks, partial failures, idempotency |
| Stateful entities with lifecycles | State Machine Diagram | Valid transitions, transition guards, temporal timeouts |

Colocate diagrams with their respective analytical sections and cite relevant criteria/versions; do not draw diagrams purely for ceremonial completeness. If a pattern is not applicable, document the justification. Use Mermaid or existing repository tooling; do not install new diagramming tools by default.

## 4. Phase 1 Pre-Flight Audit

Reconcile the full chain: Intent $\rightarrow$ Specifications $\rightarrow$ Architecture/Contracts $\rightarrow$ Acceptance Criteria/Tests $\rightarrow$ Task DAG. Scrutinize permissions, timing, idempotent retries, and race conditions (e.g., "only hashed tokens stored in DB" must match the API payload returning raw tokens to clients). Document contradictions and block downstream tasks until resolved.

Trace backward from every `ready` task to its authoritative baseline: if a task still depends on an open question or unconfirmed assumption, downgrade it to `draft` or `blocked`. Drafting exploratory spikes is acceptable while blocking production code. Keep only independent, fully grounded tasks marked ready.

Phase 1 handoff packages contain authoritative versions, confirmed decisions, clarified scope, dependency sequences, and feasible verification strategies. Phase 2 proceeds to execution planning and environment preparation; passing Phase 1 does not grant permission to bypass readiness gates prior to writing code.
