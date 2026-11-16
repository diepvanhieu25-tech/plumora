# Task Decomposition and Dependencies

By default, use the [Markdown Task Template](../resources/task_template.md). Each task must specify tangible acceptance deliverables, inputs, explicit dependencies, file scope, and verification steps. Prefer vertical behavioral slices; horizontal tasks (e.g., pure database schema or UI layout) are permissible only when coupled with an integration step that validates end-to-end functionality.

## Optional DAG (Directed Acyclic Graph)

Use the [JSON Task Plan Template](../resources/task_plan_template.json) when automated pipeline ingestion is required. This is Direwolf project planning metadata, not an external JSON Schema or CLI tool config.

- `depends_on`: references existing, unique task IDs with zero circular dependencies. Legacy `dependencies` field, if present, must stay synchronized with `depends_on`.
- `target_files`: defines anticipated write boundaries without spoofing filesystem permissions.
- Project `execution_mode` owns scheduling: absent/`sequential` runs tasks serially; `parallel` permits concurrent ready nodes only within existing authorization.
- Task mode omitted inherits project scheduling. `isolated_subagent` requests a fresh context and follows project scheduling; it does not itself grant parallel execution or isolate files, data, ports, or permissions.
- A task explicitly marked `parallel` under an absent/`sequential` project is invalid; explicitly `sequential` under `parallel` is also invalid. Keep the project sequential for a serial plan, or use DAG dependencies to express ordering in an authorized parallel plan. Diagnostics name the conflicting task; no implicit rescheduling.
- Unordered parallel tasks must avoid overlapping `target_files` and external shared state (locks, database fixtures). Validation checks declared file strings, not physical path aliases, runtime scheduling, or permissions.
- `complexity` & `reasoning_effort`: classify tasks into `low`, `medium`, `high`, or `critical` complexity, matching proportional reasoning effort (`low`, `medium`, `high`).
- `max_diff_lines`: optional positive integer boundary configured per project conventions.
- `is_foundation`: marks prerequisite environment, infrastructure, or scaffold tasks when real setup is needed; do not force a dummy `TASK-00` when the environment is already stable.

A valid DAG schema does not guarantee filesystem write permissions, execution concurrency safety, or successful test runs.

## Pre-Handover Plan Reconciliation

For every acceptance criterion, map the implementing task and the end-to-end verification step. For each task, verify inputs, readiness preconditions, and clear ownership handoffs. If a cross-cutting task like a schema migration is required, include an downstream integration task verifying that application consumers function properly against the new schema.

When requirements evolve, mark affected criteria and dependent tasks as dirty; never use sequencing schedules to conceal unresolved business decisions. Blocked tasks must state the blocking reason, resolution owner, and unblock trigger; independent, unblocked tasks may proceed.

## Value and Readiness

Keep a project capability/dependency overview; detail the next vertical slice, not every future task. Trace capability/domain → journey → slice → task → AC/assertion. The first slice must demonstrate core value with real auth/data/persistence when applicable; do not postpone the whole golden journey behind horizontal scaffolding. Record effort/rationale, decision owner, input/output, stop conditions and debt owner/closure. UI tasks require the approved screen/state/API mapping in the architecture contract; unresolved decisions block only dependent work.
