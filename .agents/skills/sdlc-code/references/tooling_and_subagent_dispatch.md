# Tooling & Subagent Dispatch in Phase 2

Guides agents in identifying activation triggers for specialized tools, subagents, and slash commands across implementation planning, local environment bootstrapping, and TDD engineering.

## 1. Phase 2 Dispatch Matrix

| Task / Scenario | Recommended Capability / Tool | Calling / Recommendation Mechanism | Optimization Objective |
| --- | --- | --- | --- |
| Adding new library or package dependency | Dependency scanner (`scan_dependencies`, `npm audit`, `pip-audit`) | Run security audit via `run_command` before updating package manifest | Prevent supply chain attacks, malicious packages, or known CVE vulnerabilities. |
| Authorized complex or risky experimental PoC | Subagent in an isolated checkout, where supported | Discover actual runtime delegation/worktree capabilities | Isolate file edits; separately isolate ports, data and external state. A branch alone does not isolate these. |
| Long-running tasks with multi-step test loops | `/goal` slash command | Recommend user type `/goal` with target objective | Enables persistent execution across debugging iterations until all tests pass green. |
| Conversation history growing large | `/compact` slash command | Recommend user type `/compact` | Compacts prior context, freeing token space for subsequent implementation steps. |
| Test environment with backing services | Isolated container or mock adapter | Run dedicated test container or apply `external_adapter_pattern.md` | Guarantees test data isolation, preventing accidental writes to production databases. |
| **Backend**: DB schema, foreign keys & migrations | Database MCP (e.g., `postgres-mcp`, `sqlite-mcp`) | Direct schema queries via MCP tool | Verify table constraints, relations, and indexes directly without custom scripts. |
| **Frontend**: Component & token extraction from designs | Design MCP (e.g., `StitchMCP`, `Figma MCP`) | Query design specs, layouts, screens, and tokens | Generate pixel-perfect components matching Phase 1 designs without guessing spacing or colors. |
| **Frontend**: Live debugging, CSS, console errors | Browser MCP (e.g., `chrome-devtools-mcp`, Puppeteer) | Tools: `take_screenshot`, `list_console_messages`, styles | Catch CSS layout breaks, console errors, or SSR hydration mismatches during dev. |

## 2. Technical Engineering Standards

During Step 2.3 implementation, agents must adhere to the engineering standards detailed in [Backend Standards](backend_engineering_standards.md) and [Frontend Standards](frontend_engineering_standards.md):
* **Backend**: Clean Architecture (Domain zero dependencies, use cases, repository interfaces, controller validation), strict Zod/Pydantic schema validation, standardized API response envelopes, ACID transactions, concurrency locking (pessimistic/optimistic), centralized error handling, and structured JSON logging.
* **Frontend**: Feature-driven component architecture, dumb/smart component separation, strict separation of Server State (TanStack Query) and Client State (Zustand), complete 5 UX states implementation, semantic HTML, keyboard accessibility (WCAG AA), and schema-driven form validation.

## 3. Tool Invariants & Model Strategy

1. **Verify Tool Existence**:
   - Before invoking tools or subagents, confirm availability in the active environment; never invent fictitious tool names.
2. **Strict Permission Scopes**:
   - Spawning subagents or scanners must respect platform permission boundaries; never bypass sandboxes or suppress security checks.
3. **Model Inheritance & Reasoning Effort**:
   - Subagents default to `Model: 'inherit'`, using the user's active session model.
   - For long-running or planning-heavy tasks, recommend `/goal` or `/plan`; for rapid micro-tasks, recommend `/fast`.

## 4. Fallback Principles

* **No Dependency Scanner**: Run standard ecosystem CLI commands (`npm audit`, `pip check`, `cargo audit`) via `run_command`.
* **No Database MCP**: Use native CLI clients via `run_command` (`docker compose exec postgres psql -U ... -c "..."` or migration CLIs).
* **No Design MCP**: Use approved design sources and components; missing new UI/business decisions block dependent work and return to P1.
* **No Browser MCP**: Discover an authorized equivalent browser controller (for example Playwright CLI). Exercise the actual UI and retain behavioral evidence. Unit/integration tests alone cannot replace required browser interaction. If no equivalent capability or permission exists, record BLOCKED/NOT RUN and continue only independent authorized work.
* **Core Principle**: Always prioritize local **TDD cycles** (RED $\rightarrow$ GREEN $\rightarrow$ REFACTOR); missing MCP transport does not waive required verification or unresolved design/API dependencies.
