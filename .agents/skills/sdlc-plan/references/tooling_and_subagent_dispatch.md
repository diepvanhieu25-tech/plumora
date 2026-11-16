# Tooling and Subagent Dispatch in Phase 1

This reference guides agents in recognizing trigger conditions for auxiliary tools, subagents, and slash commands to optimize context window efficiency and requirement/design fidelity.

## 1. Phase 1 Dispatch Matrix

| Scenario / Task | Recommended Capability / Tool | Invocation / Recommendation Mechanism | Optimization Value |
| --- | --- | --- | --- |
| Broad exploration of large codebases or external library docs | `research` subagent | `invoke_subagent(TypeName='research', ...)` | Scans dozens of files within a read-only sandbox, returning only synthesized findings; reduces primary-context exposure; quantify savings only with measurements. |
| Ambiguous requirements or architectural trade-offs requiring user alignment | Slash commands: `/grill-me` or `/plan` | Recommend user run `/grill-me` or `/plan` | Interactive structured interview to clarify objectives; prevents turning assumptions into requirements. |
| Researching latest external framework/library documentation | Slash command: `/browser` or search tools | Recommend `/browser` or execute `search_web` if permitted | Ingests latest technology versions, avoiding hallucinations from stale training data. |
| UI & Wireframe Design (Step 1.4) | Design MCP servers (e.g., `StitchMCP`) | Call `call_mcp_tool` with configured design server | Visualizes screens, component hierarchies, and shared design tokens. |
| In-depth UI/UX design knowledge base (colors, typography, responsive layouts) | Supplementary skill [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | Install via `npx skills i nextlevelbuilder/ui-ux-pro-max-skill` or configure in `.agents/skills.json` | Provides production-ready UI design templates, palettes, and responsive layouts. |

## 2. Guidelines for `research` Subagents

1. **When to Dispatch a `research` Subagent**:
   * Scanning repository trees larger than 20 files or reading voluminous source files to reconstruct existing system architectures.
   * Surveying legacy specifications, historical logs, or API contracts without polluting the parent planning session's context window with raw file contents.
2. **When NOT to Dispatch a Subagent**:
   * Inspecting 1–3 target files with known paths (use direct `read_file`).
   * Quick keyword lookups or single symbol/function definitions.

## 3. Model-Agnostic & Reasoning Effort Invariants

* All subagents default to `Model: 'inherit'`, dynamically using the user's active session model. Never hardcode specific model tiers.
* Based on task `complexity` (`low`, `medium`, `high`, `critical`) and `reasoning_effort` (`low`, `medium`, `high`) in `task_plan.json`, recommend appropriate user slash commands (`/plan` for complex multi-tier architectural decomposition, `/fast` for rapid diagnostic checks).

## 4. Graceful Tool Fallback

* If the CLI runtime lacks subagent capabilities or design MCP servers, fall back to native primitives: `read_file`, `run_command` (leveraging `git grep`, `find`), and generate standardized Markdown design artifacts in `docs/`.
* Never abort an SDLC workflow solely due to the absence of optional auxiliary tooling.
