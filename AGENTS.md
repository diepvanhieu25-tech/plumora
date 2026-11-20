# Working in Plumora

Plumora is a graduation project: adaptive personalized learning-path recommendation and management using reinforcement learning. Read [project intent](docs/intent.md) for business context.

## Start and route

- Check `git status --short` and read `.direwolf_memory/ACTIVE_SESSION.md` before work. Preserve user changes.
- Read `docs/README.md`, then only the authoritative sources needed for the task. The original brief is `docs/brief/project-direction.md`; scope and open decisions are mapped in `docs/decisions.md`.
- Installed Direwolf skills have a single local source in `.agents/skills/`: `sdlc-plan`, `sdlc-code`, `sdlc-review`, `sdlc-release`. Read the applicable `SKILL.md`, then only triggered references. Provenance: `.agents/direwolf-source.json`.
- Start CLI sessions at the repository root. Do not assume instructions in descendant folders are discovered by Antigravity.
- Questions do not authorize implementation. Documentation/configuration setup is authorized; application behavior awaits approved criteria and design. The brief supplies direction, not complete contracts or gate approval.

## Project boundaries

- Phase 1 MVP (`v1.0.0` — `D-01`..`D-15`) is completed and verified across Gates 1–4 (`ENV-01`, `RL-01`, `SLICE-01`, `REVIEW-01`, `DEFENSE-01`). The project is now expanding toward the Phase 3 graduation target under **Gate 1 Baseline (`v2.0.0` — APPROVED at `D-16`..`D-26`)** across 4 vertical slices (`P3-SLICE-1`..`P3-SLICE-4`).
- Approved stack & scope:
  - Phase 1 MVP (`v1.0.0`): 12 Backend concepts (4-tier DAG), 4-question MCQ quizzes, Gymnasium 24-dim simulator, Stable-Baselines3 `DQN`, FastAPI modular monolith, PostgreSQL 16 (SSoT), Redis 7 (State Cache), and React SPA (`Vite` + `TypeScript` + `Tailwind CSS v4` + `lucide-react`, `SCR-01`..`SCR-08`).
  - Phase 3 Expansion (`v2.0.0` — `D-16`..`D-26`): Multi-domain Knowledge Graph (`backend` 12 nodes, `frontend` 10 nodes, `devops` 9 nodes + `heldout_data_eng_graph` 10 nodes), 2-mode automated depth assessment (*Adaptive Placement* + *5-Depth Probing State Machine*), isolated Code Sandbox (`<= 3000ms`), LLM Rubric Adapter & AI Tutor (with deterministic offline fallback), Ebbinghaus memory decay $R(t) = e^{-\Delta t/S}$, `GNN-PPO` + `Safe Micro-batch Online RL` (`Policy Guardrail`, `Safety Evaluation Gate`, `1-Click Rollback`), 4 Microservices behind API Gateway with 4 isolated PostgreSQL schemas (`auth_svc`, `content_svc`, `assess_svc`, `rec_ai_svc`) & `Transactional Outbox` / `Redis Streams`, Kubernetes manifests (`k8s/`), and 12 new Stitch screens (`SCR-09`..`SCR-20`, 20 screens total).
- Never silently add unapproved scope outside `D-01`..`D-26` or bypass the 4-slice DAG sequence (`P3-SLICE-1` $\rightarrow$ `P3-SLICE-4`).
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
