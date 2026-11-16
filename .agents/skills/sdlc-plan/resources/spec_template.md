# Specification: [Feature Name]

Status: DRAFT. Version: [Version]. Decision Maker: [Name / Role].

## 1. Objectives and Scope

- Target persona, core problem, and expected outcome:
- In-scope vs out-of-scope boundaries:
- Current state, known facts, documented assumptions, and open questions:

## 2. Behavior and Technical Design

- Happy path, error handling branches, authorization rules, and domain invariants:
- UX User Flow (Mermaid flowchart or ASCII box drawing): user touchpoints, branch conditions, and UI feedback states:
- Data models, components, API/event contracts, and machine-readable error codes:
- UI specifications (if applicable): project-tailored style, 5 mandatory interaction states (Ideal, Loading, Empty, Error, Disabled), and accessibility:
- Backward compatibility, database schema changes, rollback strategy, and linked architectural decisions:

## 3. Acceptance Criteria

| ID | Preconditions & User Action | Observable Result & Invariants | Verification Harness |
| --- | --- | --- | --- |
| AC-01 | [Data fixtures, permissions, triggering action] | [Observable response and immutable state] | [CLI test command or verification procedure] |

## 4. Operational Risks and Verification Strategy

- Business, security, data integrity, concurrency, or downstream dependency risks:
- Selected vs omitted verification tiers (Tiers 2–4) with technical justification:
- Verification tiers: Tier 1 (Foundational unit/integration), Tier 2 (Test suite quality & boundary coverage), Tier 3 (E2E & user experience), Tier 4 (Adversarial stress, chaos & load):
- Latency/load thresholds, execution environment, test data fixtures, and measurement method:
- Linked implementation tasks, dependencies, and design documentation:

## 5. Phase 1 Sign-off & Decisions

- Items confirmed by authorized stakeholders, timestamps, and versions:
- Unresolved decisions, blocked dependencies, and next steps:

Do not mark approvals or claim verification pass rates without verifiable evidence.

Rules and policies that remain proposals must be explicitly labeled as such in the criteria or tasks utilizing them; they cannot serve as binding implementation baselines. A generic DRAFT status does not substitute for citing decision sources and blocking dependent work.

## 6. Impact Analysis and Handoff

- Workflow stage, coordinating skill, and handoff recipient:
- Traceability matrix: Behavior/Criterion $\rightarrow$ Contract $\rightarrow$ Task $\rightarrow$ Verification Test:
- Requirement change delta: previous vs updated baseline, decision rationale, affected components, and invalidated test evidence:
- Unaffected modules and technical justification for retaining existing test results:

When embedding architectural design directly in this document, explicitly define contracts, authorization boundaries, data flows, and integration verification steps. Unresolved decisions must block downstream tasks.

## 7. Intent Provenance and Decomposition

- Authoritative intent reference, version, and baseline decision record:
- Document role: umbrella system spec vs feature spec; indexing and shared rules baseline:
- Feature catalog, priorities, detailed specs, and dependency topology (if decomposed):
- Traceability: Requirement $\rightarrow$ Intent/Decision $\rightarrow$ Architecture/Diagram $\rightarrow$ Acceptance Criteria (unique IDs across features):

For existing codebases, preserve authoritative documentation, fill gaps in place, and document semantic mappings. Verification outcomes belong in versioned verification dossiers, not self-certified within planning specifications.
