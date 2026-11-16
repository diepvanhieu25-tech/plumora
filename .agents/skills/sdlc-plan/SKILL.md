---
name: sdlc-plan
description: "Clarify project intent, decompose feature specifications, design system architecture, and plan DAG tasks; define acceptance criteria before coding."
---

# Phase 1 — Requirements Analysis & System Design

Transforms ambiguous briefs into structured, implementation-ready specifications. Inputs: project briefs, instructions, existing codebase, and authoritative baselines. Business analysis, architecture, and UI design represent specialized activities, not mandatory multi-agent swarms.

## Context Loading

Start with the current brief, approved baseline, and this entrypoint. Read only references for the active step: discovery for unresolved intent, contracts for design changes, UI/Stitch only for UI work, DAG rules only for task planning. Do not load every linked reference or phase standard. For small changes, a mapped consolidated intent/spec/design is sufficient when explicitly approved.

## Execution Steps & Specialized Skills

| Step | Actions & Competencies | References / Deliverables |
| --- | --- | --- |
| 1.1 — Intake & Intent | Survey codebase/docs, conduct 5-dimension project elicitation (vision, target personas, MVP scope, constraints, KPIs), clarify decision baselines | [Project Discovery](references/project_discovery_and_elicitation.md), [Intent & Decomposition](references/intent_and_decomposition.md), [Tooling & Subagent Dispatch](references/tooling_and_subagent_dispatch.md), [Intent Template](resources/intent_template.md); record questions if decisions are missing |
| 1.2 — Spec & UX Flows | Decompose intent into behaviors, permissions, invariants, and acceptance criteria (`AC-ID`); model UX business flows and error branches; large projects maintain domain specs | [UI Style & UX Flows](references/ui_style_selection_and_ux_flows.md), [Adversarial Probing](references/adversarial_probing_guide.md), [Gherkin Criteria](references/gherkin_specification_rules.md); use [Spec Template](resources/spec_template.md) |
| 1.3 — Solution & Stack | Select architecture pattern, Tech Stack trade-offs, and Software Design Patterns; design components, data schemas, contracts, transactions, and system diagrams (Mermaid, ASCII, PlantUML) | [Architecture, Stack & Diagrams](references/tech_stack_selection_and_diagrams.md), [Software Design Patterns](references/software_design_patterns.md), [Architecture & Contracts](references/architecture_and_contracts.md); [Zero-Downtime DB](references/zero_downtime_database_guide.md) for migrations; [Architecture Template](resources/architecture_template.md) |
| 1.4 — UI Styling & States | When UI exists: define styling strategy based on device, user persona, and platform; construct 4-category Screen Inventory and 8-point Anatomy Checklist before Stitch generative calls; map 5 UX states (Ideal, Loading, Empty, Error, Disabled), accessibility (WCAG AA) | [UI Style & UX Flows](references/ui_style_selection_and_ux_flows.md), [Stitch UI/UX Protocol](references/stitch_uiux_blueprint_protocol.md), [Anti-Slop UI Rules](references/anti_slop_ui_rules.md), [Screen Inventory Template](resources/screen_inventory_template.md), [Design Tokens Template](resources/design_tokens_template.json); note non-applicability if headless |
| 1.5 — Task DAG / Gate 1 | Slice vertical work slices by outcome, dependencies, scope, criteria IDs, and risk-based verification layers | [DAG Task Slicing Rules](references/dag_task_slicing_rules.md), [Task Template](resources/task_template.md); [Task Plan JSON](resources/task_plan_template.json) |

Survey existing code before questioning. Ask only when missing decisions block progress; present structured trade-offs. The risk plan determines required verification layers (Layers 2–4), rationale for omissions, and measurement thresholds.

Verification layers retain consistent definitions: 1 — Baseline, 2 — Test Quality, 3 — End-to-End Experience, 4 — Adversarial/Load. Unit and integration tests belong to baseline Layer 1; do not repurpose them to alter Layer 2 definitions.

System Design and Design System are separate linked contracts; use the [Architecture & Contracts](references/architecture_and_contracts.md) guide for design roles, core/conditional diagrams and UI readiness. Scope task detail to the next vertical slice while retaining project dependencies and value.

## Gate 1 — Sufficient Implementation Baseline

- Intent $\rightarrow$ Specification $\rightarrow$ Architecture/Diagrams are traceable; versioned baselines, approved decisions, and residual assumptions are documented.
- Every acceptance criteria ID maps to an executable task with verification commands; initial tasks must not depend on unresolved decisions.
- Cross-reference open proposals against tasks: unapproved proposals do not constitute requirements or `ready` conditions. A `DRAFT` label across a file does not substitute for blocking dependent tasks.
- Handoff package records sources, versions, criteria, contracts, task plan, recipient, and next steps. Greenfield projects use `docs/intent.md`, `docs/spec.md`, `docs/design.md`; brownfield projects retain existing documentation with mappings. Phase 2 develops implementation plans and verifies environments prior to business logic.

## Rework, Changes & Continuity

When critical decisions are missing: block dependent tasks and proceed with independent scoped tasks. When requirements shift: document previous/updated versions, trace affected criteria $\rightarrow$ design $\rightarrow$ tasks $\rightarrow$ tests, and confirm changes with the user. Draft proposals do not unilaterally modify approved baselines.

Record state and open questions before long pauses; resume by verifying instructions, Git, and actual codebase state. Use sensible existing project structures without forcing redundant JSON overhead.
