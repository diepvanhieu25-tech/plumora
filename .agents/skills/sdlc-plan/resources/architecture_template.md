# Architecture Design: [Feature Name]

Status: DRAFT. Version: [Version]. Referenced Requirements: [Document and version].

## 1. Current State and Architectural Decisions

- Existing components and modified system boundaries:
- Selected architectural approach, technical rationale, trade-offs, and discarded alternatives:
- New technologies, frameworks, or dependencies with concrete justifications:

## 2. Workflows and Interfaces

- Data flow, API/event payloads, input/output contracts, and machine-readable error codes:
- Data models, entity ownership, database constraints, and transaction boundaries:
- Authentication, authorization, sensitive data (PII/secrets), and trust boundaries:
- User interface architecture, component hierarchy, and design token references (if applicable):

## 3. Implementation and Verification Strategy

- Backward compatibility, database migrations, and rollback procedures:
- Performance budgets and security hypotheses requiring measurement, thresholds, and test environments:
- Task dependency DAG, cross-component integration steps, and verification procedures:
- Confirmed stakeholder decisions, approver identities, and open questions:

Sections not applicable must state the technical justification; an architectural design does not prove runtime behavior.

## 4. Contract Specification & Implementation Verifiability

| Criterion | Entry Point / Component | Data Ownership & Permissions | Success / Error & Invariants | Verification Harness |
| --- | --- | --- | --- | --- |
| [AC-ID] | [Execution flow across system] | [Identity source, owner, constraints] | [Response payload and preserved state] | [CLI test command / verification] |

- Retry policies, idempotency mechanisms, and concurrency conflict handling:
- Legacy client compatibility, deployment rollout ordering, and rollback limits:
- Spike tasks required to validate unknowns: core questions, scope, and termination conditions:
- Actionable inputs for UI, backend development, and quality assurance:

## 5. System Analysis and Environmental Topology

- Functional and domain decomposition, participating actors, and data pipelines:
- Architectural pattern evaluation (Monolith, Modular Monolith, Microservices, Event-Driven, Hexagonal) and tech stack trade-offs:
- Software design patterns applied (Factory, Adapter, Strategy, Circuit Breaker, Transactional Outbox) and problem addressed:
- Diagram inventory (use the Architecture & Contracts reference for content requirements):

| ID / Purpose | Core or conditional view / applicability | Parent / Scope | Source / Revision / Status | AC / ADR / Contract / Task | Approver / Decision | Render command / Exit / Artifact |
| --- | --- | --- | --- | --- | --- | --- |
| [D-ID] | [C4 Context/Container; Component when needed, Code optional; sequence; entity relationships; deployment; conditional trigger or N/A rationale] | [Owning system/container/environment] | [Editable source and exact identity] | [Stable cross-view IDs] | [Approval or pending blocker] | [Actual result or NOT RUN] |

- Cross-view audit: message→contract; write→entity/transaction; component→container; container instance→deployment node. Critical failure paths, trust boundaries and logical/physical data models:
- Workload, units, latency/throughput/availability/cost budgets, RTO/RPO; assumptions vs measurements and validation tasks:
- Cache key/TTL/invalidation/failure behavior; gateway/HA need and alternatives:
- Contextual UI styling strategy and mapping of the 5 mandatory UX interaction states (Ideal, Loading, Empty, Error, Disabled):
- Traceability: Diagrams $\rightarrow$ Acceptance Criteria, versions, and rationale for omitted views:
- Target production environment: service versions, credentials, networking, configuration, and packaging:
- Local parity requirements, operational hypotheses, and empirical feasibility checks:

## 6. Linked Design System and Slice Readiness

- Design System source/version/approval; headless non-applicability rationale:
- Persona/journey, content/IA, semantic token source, component props/variants and responsive/a11y rules:
- Representative journey/component feasibility; token→component→code mapping and accepted deviations:

| AC / Journey / Slice | Screen / Real entry point | Component / Five states / Token revision | API / Auth / Transition / Persistence / Error | Task / Dependency / Assertion | Ready or blocked / Decision owner |
| --- | --- | --- | --- | --- | --- |
| [IDs] | [Route/action] | [Approved reuse or missing design] | [Contract and authoritative source] | [Executable verification] | [Evidence and unblock condition] |

Maintain overview and detail for the next slice. New design decisions return for approval; upstream changes mark affected diagrams/contracts/tasks/evidence stale. P2 checks implementation, P3 consistency/assertions, P4 actual topology.
