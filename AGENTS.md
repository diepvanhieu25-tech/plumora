# Working in Plumora

Plumora is a graduation project: adaptive personalized learning-path recommendation and management using reinforcement learning. Read [project intent](docs/intent.md) for business context.

## Start and route

- Check `git status --short` and read `.direwolf_memory/ACTIVE_SESSION.md` before work. Preserve user changes.
- Read `docs/README.md`, then only the authoritative sources needed for the task. The original brief is `docs/brief/project-direction.md`; scope and open decisions are mapped in `docs/decisions.md`.
- Installed Direwolf skills have a single local source in `.agents/skills/`: `sdlc-plan`, `sdlc-code`, `sdlc-review`, `sdlc-release`. Read the applicable `SKILL.md`, then only triggered references. Provenance: `.agents/direwolf-source.json`.
- Start CLI sessions at the repository root. Do not assume instructions in descendant folders are discovered by Antigravity.
- Questions do not authorize implementation. Documentation/configuration setup is authorized; application behavior awaits approved criteria and design. The brief supplies direction, not complete contracts or gate approval.

## Project boundaries

- Deliver the brief's Phase 1 MVP first. Its Phase 2/3 are product roadmap horizons, not Direwolf workflow phases or current implementation tasks.
- Baseline direction: Backend learning concepts, MCQ lessons, Gymnasium simulator, DQN/Stable-Baselines3, FastAPI modular monolith, PostgreSQL and Redis. React versus Next.js, exact versions and component contracts remain open.
- Never silently add code grading, AI Tutor, spaced repetition, microservices, online RL, PPO or GNN to the MVP.
- Do not inherit Plumule code, credentials, test results, approvals or infrastructure without explicit review and authorization.
- Keep RL claims traceable to actual training, checkpoint hashes, evaluation and serving. Simulated outcomes are not proof of real-world learning efficacy. Read `.agents/rules/rl-evidence.md` for RL work.

## Authority and gates

- The user owns business, architecture, UI, merge and production decisions. Continue within approval already granted; do not ask again for routine steps inside that scope.
- G1: before changing source behavior anywhere, require approved AC IDs and design/contracts, with version and approval evidence in `docs/decisions.md`. `docs/spec.md` and `docs/design.md` currently remain DRAFT; block dependent application implementation.
- G2: before business logic, establish a task branch, applicable Day-0 CI, healthy backing services via Docker Compose with named persistent volumes and healthchecks, and observed RED behavioral tests. Record readiness before logic, self-test/handoff afterward. Service-free documentation setup does not require an app or database; do not waive applicable checks.
- G3: independent four-axis review (UI/UX, code quality, security, database) on the exact version in a fresh-context subagent or separate isolated session. Document non-applicability. Self-checks cannot pass G3. Changes invalidate affected evidence.
- G4: production changes require verified G3 plus explicit user authorization. No commit/push/merge/deploy without granted scope.
- Default to sequential work. Only independent review delegates by default; other parallel agent work requires user authorization. Context isolation does not isolate files, ports or data.

## Execution and evidence

- Communicate and write business intent/spec/design/AC in Vietnamese with technical terms in parentheses. Core instructions and engineering references use concise English. Code and commits follow ecosystem conventions and Conventional Commits.
- Inherit the user's model/settings. Never hardcode models, change permissions, enable hooks, install plugins or launch remote agents as a shortcut. Verify command availability for the installed platform; do not use obsolete `/fast` or `/planning` on Antigravity.
- Use task branches (`feat/`, `fix/`, `refactor/`, `chore/`), official scaffolding CLIs after stack approval, and `mkdir -p` for directory setup. Do not invent application scaffolds before G1.
- Never fake the SUT, inject a replacement DOM, weaken tests, use privileged demo bypasses or relabel heuristics as learned policies.
- Current repository is documentation/configuration only. Local whitespace check: `git diff --check`; include untracked files in content audits. No app lint/typecheck/test/build, DB or browser runtime is configured yet. Add real commands and CI with the approved stack before logic; never report missing checks as passed.
- Use `docs/engineering/WORKFLOW.md` for evidence fields and handoff. Update `.direwolf_memory/ACTIVE_SESSION.md` at milestones and session boundaries; retain links to historical evidence.
