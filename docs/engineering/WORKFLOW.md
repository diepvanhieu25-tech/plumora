# Plumora engineering workflow

## Source authority

The original brief is preserved in `docs/brief/project-direction.md`. `docs/decisions.md` distinguishes user decisions, brief direction and unresolved contracts. Draft analysis is not implementation approval. The installed Direwolf snapshot provenance is `.agents/direwolf-source.json`; edit upstream packages only through an explicit framework update, not inside feature work.

## Four phases per vertical slice

1. `sdlc-plan`: intent, behavior/AC, architecture/contracts and a bounded task plan. Resolve dependencies; record user approval with source versions.
2. `sdlc-code`: implementation plan, branch, Day-0 CI, applicable healthy services and observed RED tests; then logic, self-tests and handoff.
3. `sdlc-review`: fresh-context review on the exact snapshot, against original requirements. Inspect UI/UX, code quality, security, database; justify N/A. Self-tests never grant G3.
4. `sdlc-release`: prepare artifacts, reproducible demo, runbook and rollback. Actual production, merge and remote publishing require explicit authorization.

Read only the current skill and triggered references. Do not confuse the brief's product Phase 1/2/3 with these four workflow phases.

## Current verification applicability

Established in `ENV-01` (`docs/environment.md` & `docs/verification/HANDOFF_ENV_01.md`):
- **Day-0 CI & Full Local Verification Suite:** `./scripts/ci_check.sh` (runs `ruff check .` & `mypy` in `backend/` and `rl/`, `npm run lint` & `npm run typecheck` & `npm run build` in `frontend/`, and environment smoke tests against live `PostgreSQL 16` + `Redis 7`).
- **Backing Services Health:** `docker compose --env-file .env.local ps` (`plumora-postgres` and `plumora-redis` must report `Up (healthy)` on `127.0.0.1:5432` and `127.0.0.1:6379`).
- **Smoke vs RED Behavioral Suites:**
  - Smoke (`GREEN`): `cd backend && uv run pytest tests/smoke`, `cd rl && uv run pytest tests/smoke`, `cd frontend && npm run test:smoke`.
  - Behavioral Product Suites (`RED` prior to `RL-01` / `SLICE-01` logic; `GREEN` after implementation): `cd rl && uv run pytest tests/red`, `cd backend && uv run pytest tests/red`, `cd frontend && npm run test:red`.

## Handoff record

Record scope/AC, approved source paths+versions+approval evidence, exact source/config/test snapshot (including untracked relevant files), commands and exit codes, durable logs/artifacts, findings, limitations, recipient and next action. Readiness is recorded before logic; self-test handoff after logic. Hashes identify content, not approval authenticity.

For no-commit work, use a sorted relative-path/SHA-256 manifest. Review findings apply only to that snapshot; keep previous evidence as history when files change. Do not expose secrets in logs. Update `.direwolf_memory/ACTIVE_SESSION.md` with current decisions and a link to evidence.

## Platform boundaries

Prompts/rules/skills guide behavior; tool permissions, OS sandbox and CI provide separate controls. Shell success does not prove a policy claim or product acceptance. Do not configure hooks, remote execution, multi-agent swarms, global settings or a different model merely because a feature exists.
