# Tooling & Subagent Dispatch in Phase 3

Guides agents in identifying activation triggers for specialized verification tools, subagents, and Model Context Protocol (MCP) servers across 4 verification layers and objective adversarial reviews.

## 1. Phase 3 Dispatch Matrix

| Verification Layer / Scenario | Recommended Capability / Tool | Calling / Recommendation Mechanism | Optimization Objective |
| --- | --- | --- | --- |
| **Axis 1 — UI/UX & Accessibility (Layer 3)** | Browser MCP (e.g., `chrome-devtools-mcp`) | MCP tools: `navigate_page`, `resize_page` (375px, 768px, 1280px), `take_screenshot`, `list_console_messages`, `lighthouse_audit` | Live browser interaction; multi-viewport responsive screenshots, WCAG AA accessibility audit, JavaScript console and network error capture. |
| **Axis 2 — Objective Code Review (Layer 1/2)** | Independent subagent (`Role='Adversarial Reviewer'`) | `invoke_subagent(TypeName='self', Role='Adversarial Reviewer', ...)` | Isolated adversarial review to scrutinize code, edge cases, invalid type casts, and Clean Architecture violations without developer bias. |
| **Axis 3 — Vulnerability & Attack Surface (Layer 4)** | Security tools (`run-security-scanner`, `determine-threat-model`, SAST) | Activate security skills or run static analysis via `run_command` | Automated detection of SQL Injection, XSS, hardcoded secrets, IDOR, and privilege escalation vulnerabilities. |
| **Axis 3 — Security Patch PoC Verification** | Exploit test generator (`run-poc`) | Activate `run-poc` skill | Generate attack proof-of-concept scripts to verify that security patches effectively remediate the flaw. |
| **Axis 4 — DB Performance, Indexing & N+1** | Database MCP (Postgres / SQLite MCP) | Query analysis via `EXPLAIN ANALYZE` | Early detection of sequential table scans, missing foreign key indexes, and N+1 query bottlenecks. |
| **Deep multi-perspective analysis** | `/boost` slash command | Recommend user type `/boost` | Activates deep reasoning budgets for high-complexity architectural and security challenges. |
| **Pre-review conversation cleanup** | `/compact` slash command | Recommend user type `/compact` | Compacts conversation context before feeding large diffs for evaluation. |

## 2. Context Isolation & Zero-Knowledge Review

### A. The Mechanism of AI Self-Rationalization
* **Confirmation Bias & Cognitive Lock-in**: When the same AI session writes code and then reviews it, the model retains its entire chain of thought, initial assumptions, and temporary technical compromises.
* **Consequence**: Encountering edge cases or hidden vulnerabilities, the AI rationalizes defects rather than acknowledging them:
  * *"This scenario is extremely rare in practice..."*
  * *"The specification did not explicitly forbid this pattern..."*
  * *"The client will never send payloads structured like this..."*
* This bias conceals critical defects (race conditions, IDOR, memory leaks) through Gate 3.

### B. Zero-Knowledge Review Protocol
To eliminate self-rationalization, Phase 3 evaluation must enforce context isolation:

1. **Clean Slate Context via Independent Subagent**:
   * Use a fresh-context subagent or a separate isolated session. For example, where supported: `invoke_subagent(TypeName='self', Role='Adversarial Reviewer', ...)`.
   * The subagent starts with a completely clean context, untainted by developer debug loops, trial-and-error attempts, or subjective rationales.
   * Inherits `Model: 'inherit'` by default. For complex security or concurrency audits, recommend the `/boost` command for maximum reasoning budget (`reasoning_effort: high`).
2. **Review Payload Contains ONLY Objective Facts**:
   * **PERMITTED**:
     1. Approved specification and acceptance criteria IDs (`docs/spec.md` or mapped brownfield source/version).
     2. Approved architecture and API contracts (`docs/design.md` or mapped brownfield source/version).
     3. Actual code diff and exact commit or file/hash manifest including relevant dirty/untracked files; compare the reviewed snapshot, not only committed branch diff.
     4. Automated test results (exit codes, test logs, coverage reports).
   * **STRICTLY FORBIDDEN**:
     * FORBIDDEN to pass developer chat transcripts or history.
     * FORBIDDEN to pass developer justifications, promises, or explanations of "why I coded it this way".
3. **Mandatory Adversarial Persona**:
   Prompt the subagent with an explicit adversarial posture:
   > *"You are an independent security and code auditor. You are NOT the author of this code and have zero incentive to defend it. Your sole objective is to scrutinize, challenge assumptions, uncover unhandled edge cases, logic bugs, architectural violations, and security flaws. Distrust claims; accept assertions only when proven by hard test evidence."*

### C. Hard Evidence Over Narrative
* Assertions like *"Code looks good"* or *"Securely handled"* are **VOID** without:
  1. Specific terminal command executed (`run_command`).
  2. Verified exit code (`Exit code 0`).
  3. Adversarial test case or PoC script proving defect resolution.
* Never mentally simulate fixes and carry forward prior pass conclusions. Every code modification requires re-executing verification on the new commit.

## 3. Fallback Principles

* **No Browser MCP**: Discover an authorized equivalent browser controller (for example Playwright CLI/Cypress). Exercise actual navigation/actions and retain assertions/artifacts against the real UI and applicable backend/persistence. Vitest/pytest alone do not replace browser interaction. If required capability or permission is unavailable, mark BLOCKED/NOT RUN and continue only independent scope.
* **No Security Scanner**: Execute open-source linters (`bandit`, `eslint-plugin-security`, `cargo audit`, `npm audit`, `pip-audit`) via `run_command` combined with manual review against the [Four-Axis Checklist](four_axis_audit_checklist.md).
* **No Database MCP**: Use native CLI clients via `run_command` (e.g., `docker compose exec postgres psql -U ... -c "EXPLAIN ANALYZE <query>"`).
* **No Subagent Runtime**: Hand off baseline, criteria, diff, and test logs to a separate isolated review session without implementation transcripts. The primary agent may run preliminary checks, but changing persona does not isolate context or satisfy G3. Without independent review, mark G3-dependent work `blocked`; continue unrelated authorized tasks.
