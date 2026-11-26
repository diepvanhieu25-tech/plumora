# Working in Plumora

Plumora is a graduation project: adaptive personalized learning-path recommendation and management using reinforcement learning. Read [project intent](docs/intent.md) for business context.

## Start and route

- Check `git status --short` and read `.direwolf_memory/ACTIVE_SESSION.md` before work. Preserve user changes.
- Read `docs/README.md`, then only the authoritative sources needed for the task. The original brief is `docs/brief/project-direction.md`; scope and open decisions are mapped in `docs/decisions.md`.
- Installed Direwolf skills have a single local source in `.agents/skills/`: `sdlc-plan`, `sdlc-code`, `sdlc-review`, `sdlc-release`. Read the applicable `SKILL.md`, then only triggered references. Provenance: `.agents/direwolf-source.json`.
- Start CLI sessions at the repository root. Do not assume instructions in descendant folders are discovered by Antigravity.
- Questions do not authorize implementation. Documentation/configuration setup is authorized; application behavior awaits approved criteria and design. The brief supplies direction, not complete contracts or gate approval.

## Project boundaries

- Phase 1 MVP (`v1.0.0` — `D-01`..`D-15`), Phase 3 Expansion (`v2.0.0` — `D-16`..`D-26` across `P3-SLICE-1`..`P3-SLICE-4`), and the `v3.0`/`v3.1` Microservices & RL Hardening Baseline (`D-27`..`D-30`, `REM-01`..`REM-04`) are approved in `docs/decisions.md`.
- Approved stack & scope:
  - Phase 1 MVP (`v1.0.0` historical foundation): 12 Backend concepts (4-tier DAG), 4-question MCQ quizzes, Gymnasium 24-dim simulator, Stable-Baselines3 `DQN`, PostgreSQL 16 (SSoT), Redis 7, and React SPA (`SCR-01`..`SCR-08`). Legacy v1 sync writes (`redis_store.py`, `_sync_v2_to_mvp_if_backend`, removed v1 routes) are retired per `D-28`; only `/api/v1/auth/*` and `/api/v1/health` remain active alongside legacy ORM tables preserved without `DROP TABLE`.
  - Unified `v3.1` Architecture (`D-16`..`D-30`): Multi-domain Knowledge Graph (`backend` 12 nodes, `frontend` 10 nodes, `devops` 9 nodes + `heldout_data_eng_graph` 10 nodes), sequential learning invariants (`INV-SEQ-01..04`: Playbook $\rightarrow$ 5-Depth Probing $\rightarrow$ Isolated Python/JS/SQL Code Sandbox `<= 3000ms`), LLM Rubric Adapter & Socratic AI Tutor (with deterministic offline fallback), Ebbinghaus memory decay $R(t) = e^{-\Delta t/S}$, shared Zero-Torch `plumora_rl` kernel + `GNN-PPO` + `Safe Micro-batch Online RL` (`Policy Guardrail`, `Safety Evaluation Gate`, `1-Click Rollback` with persistent `plumora_rl_candidates` volume), unified `docker-compose.yml` running **4 Microservices + API Gateway + `db-migrate-seed` + non-root Nginx Frontend** (`backend/app/main.py` retained solely as an internal `pytest` harness; `k8s/` maintained as an *Experimental Production Blueprint* outside current acceptance scope), and Dual-Portal React 19 UI (`LearnerAppShell` & `BackOfficeAppShell`, `SCR-09`..`SCR-20`).
- Never silently add unapproved scope outside `D-01`..`D-30`.
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
- Full-stack runtime (`backend/`, `frontend/`, `rl/`, `docker-compose.yml`) and automated verification suite (`./scripts/ci_check.sh` covering Ruff, ESLint, Mypy, TSC, Pytest, Vitest, Frontend Build, Live Fullstack Integration, and Real Chromium Browser Audits) are active. Local whitespace check: `git diff --check`; include untracked files in content audits. Never report missing checks as passed.
- Use `docs/engineering/WORKFLOW.md` for evidence fields and handoff. Update `.direwolf_memory/ACTIVE_SESSION.md` at milestones and session boundaries; retain links to historical evidence.
