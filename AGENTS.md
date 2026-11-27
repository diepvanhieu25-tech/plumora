# Working in Plumora

Plumora is a graduation project: adaptive personalized learning-path recommendation and management using reinforcement learning. Read [project intent](docs/intent.md) for business context.

## Start and route

- Check `git status --short` and read `.direwolf_memory/ACTIVE_SESSION.md` before work. Preserve user changes.
- Read `docs/README.md`, then only the authoritative sources needed for the task. The original brief is `docs/brief/project-direction.md`; scope and open decisions are mapped in `docs/decisions.md`.
- Installed Direwolf skills have a single local source in `.agents/skills/`: `sdlc-plan`, `sdlc-code`, `sdlc-review`, `sdlc-release`. Read the applicable `SKILL.md`, then only triggered references. Provenance: `.agents/direwolf-source.json`.
- Start CLI sessions at the repository root. Do not assume instructions in descendant folders are discovered by Antigravity.
- Questions do not authorize implementation. Documentation/configuration setup is authorized; application behavior awaits approved criteria and design. The brief supplies direction, not complete contracts or gate approval.

## Project boundaries

- Phase 1 MVP (`v1.0.0` — `D-01`..`D-15`), Phase 3 Expansion (`v2.0.0` — `D-16`..`D-26` across `P3-SLICE-1`..`P3-SLICE-4`), the `v3.1` Microservices & RL Hardening Baseline (`D-27`..`D-30`, `REM-01`..`REM-04`), and the `v4.0.0` Final Clean Baseline (`D-31`..`D-36`) are approved in `docs/decisions.md`.
- Approved stack & scope:
  - Unified `v4.0.0` Architecture (`D-16`..`D-36`): Multi-domain Knowledge Graph (`backend` 12 nodes with 5-part Playbooks, `frontend` 10 nodes, `devops` 9 nodes + `heldout_data_eng_graph` 10 nodes; 220 rotating questions), sequential learning invariants (`INV-SEQ-01..04`: Playbook $\rightarrow$ 5-Depth Probing $\rightarrow$ Isolated Python/JS/SQL Code Sandbox `<= 3000ms`, dual-pillar `1.00 Mastery`), LLM Rubric Adapter (`8.0s` default timeout) & Socratic AI Tutor (with deterministic offline fallback), Ebbinghaus memory decay $R(t) = e^{-\Delta t/S}$, shared Zero-Torch `plumora_rl` kernel + `GNN-PPO` (`60k` steps/seed, `dt=0.25d`, 30% prior-state reset) + `Safe Micro-batch Online RL` (TD Critic Advantage, Trust-Region KL guard, `Policy Guardrail`, `Safety Evaluation Gate`, `1-Click Rollback` with persistent `plumora_rl_candidates` volume), unified `docker-compose.yml` running **4 Microservices + API Gateway (with `X-Request-ID` & Redis sliding-window rate limit) + `db-migrate-seed` + non-root Nginx Frontend** (`backend/app/main.py` retained solely as an internal `pytest` harness; `k8s/` synced to `v4.0.0`), and Dual-Portal React 19 UI (`LearnerAppShell` & `BackOfficeAppShell`, `SCR-09`..`SCR-20`). Legacy v1 ORM models & 5 legacy v1 DB tables (`concepts`, `concept_prerequisites`, `quiz_questions`, `user_concept_mastery`, `quiz_attempts`) are retired via `_migration_0011`.
- Never silently add unapproved scope outside `D-01`..`D-36`.
- Do not inherit Plumule code, credentials, test results, approvals or infrastructure without explicit review and authorization.
- Keep RL claims traceable to actual training, checkpoint hashes, evaluation and serving. Simulated outcomes are not proof of real-world learning efficacy. Read `.agents/rules/rl-evidence.md` for RL work.

## Authority and gates

- The user owns business, architecture, UI, merge and production decisions. Continue within approval already granted; do not ask again for routine steps inside that scope.
- G1: before changing source behavior anywhere, require approved AC IDs and design/contracts, with version and approval evidence in `docs/decisions.md`. Both MVP (`v1.0.0` — `D-14`, `D-15`) and Phase 3 (`v2.0.0` — `D-16`..`D-26`) Gate 1 Baselines are **APPROVED** (`P3-SLICE-1` is `ready`). Any new scope outside `v2.0.0` requires explicit G1 approval first.
- G2: before business logic, establish a task branch, applicable Day-0 CI, healthy backing services via Docker Compose with named persistent volumes and healthchecks, and observed RED behavioral tests. Record readiness before logic, self-test/handoff afterward. Service-free documentation setup does not require an app or database; do not waive applicable checks.
- G3: independent four-axis review (UI/UX, code quality, security, database) on the exact version in a fresh-context subagent or separate isolated session. Document non-applicability. Self-checks cannot pass G3. Changes invalidate affected evidence.
- G4: production changes require verified G3 plus explicit user authorization. No commit/push/merge/deploy without granted scope.
- Default to sequential work. Only independent review delegates by default; other parallel agent work requires user authorization. Context isolation does not isolate files, ports or data.

## Execution and evidence

- Communicate and write business intent/spec/design/AC in Vietnamese with technical terms in parentheses. Core instructions and engineering references use concise English. Code and commits follow ecosystem conventions and Conventional Commits.
- Inherit the user's model/settings. Never hardcode models, change permissions, enable hooks, install plugins or launch remote agents as a shortcut. Verify command availability for the installed platform; do not use obsolete `/fast` or `/planning` on Antigravity.
- Use task branches (`feat/`, `fix/`, `refactor/`, `chore/`), official scaffolding CLIs after stack approval, and `mkdir -p` for directory setup. Do not invent application scaffolds before G1.
- Never fake the SUT, inject a replacement DOM, weaken tests, use privileged demo bypasses or relabel heuristics as learned policies.
- Keep implementations minimal (KISS/YAGNI): if a requirement takes ~10 lines, write ~10 clear lines; do not invent speculative abstractions, wrapper classes, unused fallbacks, or future-proofing config. Introduce an abstraction only when 2–3 real call sites need it (Rule of Three) or an approved design requires it.
- Write only what the requested feature needs: never add unrequested features, dead dual-mode branches, or unrelated refactors. Before finishing, prune any line whose removal leaves behavior and tests intact.
- Split files by responsibility, not by habit: create a dedicated service/hook/component module for a distinct new use-case or when an existing file approaches ~400–500 lines or high complexity, instead of endlessly appending into a monolith service/page file; conversely, never over-fragment a small 10–20 line helper across multiple files.
- Full-stack runtime (`backend/`, `frontend/`, `rl/`, `docker-compose.yml`) and automated verification suite (`./scripts/ci_check.sh` covering Ruff, ESLint, Mypy, TSC, Pytest, Vitest, Frontend Build, Live Fullstack Integration, and Real Chromium Browser Audits) are active. Local whitespace check: `git diff --check`; include untracked files in content audits. Never report missing checks as passed.
- Use `docs/engineering/WORKFLOW.md` for evidence fields and handoff. Update `.direwolf_memory/ACTIVE_SESSION.md` at milestones and session boundaries; retain links to historical evidence.
