# Architecture and Contracts

Read during Step 1.3 when requirements modify system components, data schemas, or interfaces. The goal is to produce verifiable implementation contracts, preserve sound architectural boundaries, and avoid unauthorized tech-stack churn.

## 1. Determining Design Depth

| Scope of Change | Required Architectural Documentation |
| --- | --- |
| Documentation or local bugfix without behavioral change | Scope boundary, authoritative source, and verification method; do not draw system diagrams |
| Modifying an existing system behavior | Entry points, pre/post-conditions, data contracts, error semantics, and affected integrations |
| Multi-component feature addition | Boundaries, data flow, authorization, dependencies, implementation sequence, and end-to-end verification |
| Major data, security, or architectural overhaul | Architectural options & trade-offs, backward compatibility, operational risks, rollback paths, and user approval |

If feasibility evidence is lacking, define a targeted spike task (delegate only with authority) defining the core question, scope, evaluation criteria, and termination condition. A spike report does not constitute an approved architectural decision.

## 2. From User Behavior to Components

1. Pick an acceptance criterion: trace actor $\rightarrow$ entry point $\rightarrow$ business logic $\rightarrow$ external persistence/services $\rightarrow$ response. On errors, record the stop point and invariant data state.
2. Identify existing components versus modified components: establish data ownership, trust boundaries, and database transaction scopes. Never assume a chain of HTTP/RPC calls possesses atomic properties.
3. Model failure modes: timeouts, retries, duplicate requests, and concurrency edge cases that could violate domain invariants. Choose proportionate mitigations or record pending user decisions.
4. Record chosen approaches, discarded alternatives, and constraint justifications. Introducing new technologies requires concrete justification and compatibility checks against current runtime versions.

Example: updating personal tasks must derive identity directly from an authenticated session token, verifying ownership and record versioning inside the database update; UI state does not prove server-side authorization.

## 3. Actionable Implementation Contracts

| Contract Dimension | Key Verification Questions |
| --- | --- |
| Inputs | Mandatory vs optional fields, identity provenance, format/size bounds, handling of missing/empty values |
| Outputs | Data structure, HTTP status/success payload, point of guaranteed persistence |
| Error Semantics | Error condition $\rightarrow$ machine-readable error code $\rightarrow$ resulting data state $\rightarrow$ client handling guidance |
| Authorization | Which principal may execute this action on which resource; handling of unauthenticated vs unauthorized requests |
| State Machine | Valid state transitions, pre/post-conditions, invariants, and concurrent update conflict handling |
| External Side Effects | Idempotency guarantees, ambiguity resolution upon timeout, retries, and compensating transactions |
| Compatibility | Backward compatibility for older clients, deployment sequencing, and migration scripts |

Use machine-readable contracts (OpenAPI, JSON Schema, Protobuf) when required by integrations or established repository tooling. When written documentation and executable contracts conflict, escalate to Phase 1 decision makers rather than adopting the path of least resistance.

## 4. Data, Security, and UI Integration

- Consult the [Zero-Downtime Database Guide](zero_downtime_database_guide.md) when altering storage: assess backward compatibility, nullable columns, defaults, lock durations, and rollback plans. Do not enforce dual-write patterns unless strictly necessary.
- Identify sensitive data (PII, tokens), enforce authorization at the authoritative execution layer, and redact sensitive attributes from logs. Test fixtures must never contain real user data or production secrets.
- Consult the [Anti-Slop UI Rules](anti_slop_ui_rules.md) when building user interfaces. Map every user interaction to an explicit API contract, especially permission errors, validation failures, conflicts, and offline recovery states.
- Service Level Objectives (SLOs) and performance budgets must specify measurement conditions, synthetic/real load profiles, data volumes, test environments, and acceptable error rates. Unmeasured claims must be marked as hypotheses with associated verification tasks.

## 5. Architectural Pre-Flight Checklist

Use the [Architecture Template](../resources/architecture_template.md) (or embed into the feature spec for small changes). Verify:

- Every acceptance criterion maps to a concrete implementation touchpoint, contract, and test suite.
- Every contract/schema change has identified dependent consumers, migration order, and rollback mechanisms.
- An end-to-end integration task validates cross-component behavior rather than relying solely on isolated unit tests.
- High-impact business and architectural assumptions are explicitly approved or gated behind dependency blocks with documented decision references and versions.

The Phase 1 handover package consists of designs, contracts, decisions, risks, open questions, and linked implementation tasks. An architectural document specifies structural intent but does not substitute for runtime proof of security or performance under load.

## 6. System Design and Design System

System Design owns domain boundaries, module/data ownership, workload assumptions, security, infrastructure, API/event contracts and failure semantics. Use `docs/design.md` or mapped approved sources. Choose the simplest architecture meeting evidenced needs; DDD does not require microservices. Record ADR alternatives and reconsideration triggers. Budgets state units, assumptions and measurement plans: latency/throughput, availability, RTO/RPO and cost. Cache requires key/TTL/invalidation/failure behavior; gateways and HA require a concrete need, not a default stack. Validate uncertain platform capabilities with bounded spikes before dependent tasks.

Design System owns visual/interaction rules in linked `docs/ui-design-system.md` or mapped sources: persona/journeys, information architecture, content, semantic tokens, typography, spacing, responsive layout, accessibility and component variants. Map props, focus/keyboard, validation and Ideal/Loading/Empty/Error/Disabled states to approved token sources and code. Prove one representative journey/component before expanding. Headless projects record why UI design is inapplicable.

The shared contract is AC → journey → screen/action → component/state → API/event → authorization → state transition → persistence → UI result/error. Identify the authoritative data source. UI tasks need approved routes, real entry points, representative layout/component reuse, states and interaction/API mapping. Missing new business/UI decisions block dependent tasks and return to P1; approved component reuse need not generate every screen combination.

## 7. Diagram Inventory and Lifecycle

Review four core views for the affected system/slice; record evidence-based non-applicability instead of inventing databases or services. Keep project overview broad and detail the next ready slice. Formats and rendering choices: [Diagramming](tech_stack_selection_and_diagrams.md).

| View | Minimum analysis |
| --- | --- |
| C4 architecture | Context: actors/system/external relationships. Container: applications/stores, responsibilities, technology and protocol. Component: only when slice interfaces/ownership remain unclear; each belongs to a container. Code: optional, preferably generated. Do not confuse C4 containers with Docker containers or mix levels in one view. |
| Sequence | Critical use cases across actor/UI/API/service/store; auth/transaction boundaries, sync/async, success and applicable timeout/retry/duplicate/conflict/compensation paths; link messages to contracts/assertions. |
| Entity relationships | Ownership, PK/FK, cardinality/optionality and uniqueness; link types, constraints, indexes, concurrency, retention and sensitive data to dictionary/schema/migration/tests. NoSQL explains embedded/reference and consistency. Distinguish logical from physical models. |
| Deployment/infrastructure | Map application/container instances to runtime nodes for local/test/target; network/trust boundaries, storage, failure domains and observability. Link capacity assumptions, recovery/runbook and deployment configuration; proposed HA is not measured HA. CLI/library models the actual host process. |

| Conditional view | Trigger |
| --- | --- |
| State machine | Nontrivial lifecycle or forbidden/concurrent transitions |
| Activity/business process | Branches, roles, approvals or compensation obscure the journey |
| Data flow | Multi-step processing/ETL/ML, lineage or sensitive data: sources/processes/stores, retention/deletion/provenance; distinguish training/evaluation/serving to prevent leakage |
| Network/security | Public ingress, multiple trust zones, privileged access or untrusted code: zones, ports/protocols, TLS, identity, ACL/firewall, secrets access and admin/isolation paths; link threat model and denied-access tests |

Every diagram records ID, purpose, source path, parent/scope, revision, draft/approved/stale status, approver and AC/ADR/contract/task references. Use consistent actor/module/entity/message IDs. Check message→contract, write→entity/transaction, component→owning container and container instance→deployment node across environments. Render with available tooling and inspect the output; retain command/exit code and artifact. Source syntax alone is not design correctness; unavailable rendering is NOT RUN, not passed.

P1 hands over overview plus ready-slice detail. P2 compares implementation/schema/config against views; architecture changes return for design approval. P3 checks cross-view consistency and assertions. P4 compares topology with actual deployment. Upstream changes mark affected diagrams/tasks/evidence stale; preserve old versions. Reject orphan components, mixed C4 levels, missing critical failure paths and inconsistent entity/message/deployment identities. Exceptions require rationale and authorized approval.
