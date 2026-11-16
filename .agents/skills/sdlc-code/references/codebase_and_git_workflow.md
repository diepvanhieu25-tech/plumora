# Codebase Discovery, Git Workflow Strategy & Project Layout

Guides agents in baselining codebase state, establishing Git workflow and branching conventions, documenting project directory layouts, and detailing tasks via Inputs-Outputs-Criteria in Step 2.1 of Phase 2.

---

## 1. Codebase Discovery & Baselining

Before writing code, agents must identify codebase classification and active state:

### A. Greenfield Projects (New Projects)
1. **Mandatory Token-Saving Scaffolding Rule**:
   * **Use official scaffolding CLIs**: Always initialize via the framework CLI approved in Phase 1 (e.g., `pnpm create next-app`, `cargo new --bin`, `go mod init`, `poetry new`, `flutter create`, `npx create-vite`).
   * **MANUAL DIRECTORY CREATION AND BOILERPLATE CONFIG WRITING ARE STRICTLY FORBIDDEN**:
     * *Consequences of manual creation*: Wastes 15,000–30,000 tokens and 20–30 tool calls (`run_command`, `write_file`), risks session timeouts, and frequently omits critical config items (`tsconfig.json` path aliases `@/*`, linter plugins, test runners, lockfiles).
   * **Two-Step Token-Optimized Scaffolding Procedure**:
     * *Step 1 (Single command)*: Execute official scaffolding CLI to generate standard layout and build toolchains.
     * *Step 2 (Single bash command with brace expansion)*: Create architecture folders and Direwolf documentation directories:
       ```bash
       mkdir -p src/{domain,application,infrastructure,presentation} tests/{unit,integration,e2e} docs
       ```
   * Set up toolchain version locking files (`.nvmrc`, `.python-version`, `toolchain.toml`) immediately.
2. **Git Initialization & Day-0 GitHub Actions CI/CD Pipeline**:
   * **Why Day-0 CI/CD is Mandatory with AI Coding Agents**:
     * *Real-world problem*: AI agents in local context are prone to hallucinations, missing typecheck/lint errors, and causing silent regressions in untouched modules.
     * *Role of GitHub Actions*: CI/CD serves as an **External Automated Quality Gate** completely independent of the agent. Every AI commit and pull request must pass this external gate before acceptance.
   * **Day-0 Setup Sequence**:
     * *Git Init*: Run `git init`, set default branch to `main`.
     * *Standard `.gitignore`*: Strictly block accidental commits of `node_modules/`, `venv/`, `.env*`, `dist/`, `build/`, `*.pyc`, `target/`, logs, and caches.
     * *Conventional Commits*: Standard formatting (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`).
     * *Day-0 CI Workflow (`.github/workflows/ci.yml`)*: Implement 4 mandatory quality checkpoints:
       1. **Check 1: Lint & Format** (`npm run lint` / `ruff check` / `cargo clippy`).
       2. **Check 2: Type Check** (`tsc --noEmit` / `pyright` / `mypy`).
       3. **Check 3: Automated Tests** (`npm test` / `pytest` / `cargo test`) with service containers (Postgres, Redis) if needed.
       4. **Check 4: Build Verification** (`npm run build` / `cargo build` / `go build`).
   * **Standard CI Workflow Reference (`.github/workflows/ci.yml`)**:
     ```yaml
     name: CI Pipeline

     on:
       push:
         branches: [main]
       pull_request:
         branches: [main]

     jobs:
       verify:
         runs-on: ubuntu-latest
         steps:
           - name: Checkout code
             uses: actions/checkout@v4

           - name: Setup Runtime
             uses: actions/setup-node@v4
             with:
               node-version-file: '.nvmrc'
               cache: 'pnpm'

           - name: Install dependencies
             run: pnpm install --frozen-lockfile

           - name: 1. Lint & Format Check
             run: pnpm run lint

           - name: 2. Type Check
             run: pnpm run typecheck

           - name: 3. Run Tests
             run: pnpm test

           - name: 4. Build Verification
             run: pnpm run build
     ```

### B. Brownfield Projects (Existing Codebases)
1. **Entrypoint Discovery**: Identify application bootstrap files (`src/main.ts`, `app/main.py`, `cmd/server/main.go`).
2. **Build System & Scripts Survey**: Inspect package manifests (`package.json`, `pyproject.toml`, `Cargo.toml`, `Makefile`) to identify standard scripts: `build`, `test`, `lint`, `dev`.
3. **Baseline Check**: Run existing test suites and linters before editing code. Document pre-existing test failures or lint warnings to avoid misattributing legacy issues to new features.

---

## 2. Git Workflow Strategy & Branching Standards

### A. Failure Patterns of AI Coding Agents with Git
* **Classic Error**: Agents often commit directly to `main` or pile all tasks (features, bugfixes, refactoring, configs) onto a single open branch.
* **Severe Consequences**:
  1. Pollutes `main` with unverified code, making rollbacks hazardous.
  2. Creates massive merge conflicts across agents or human developers.
  3. Shreds Git history with meaningless commits (`update`, `fix bug`, `wip`), destroying `git bisect` and root cause analysis capabilities.

---

### B. Inviolability of the `main` Branch
1. **Sacred Production Baseline**: `main` must always remain buildable, stable, and pass all CI checks 100%.
2. **ABSOLUTE PROHIBITIONS**:
   * Direct commits to `main` are FORBIDDEN.
   * Direct pushes to `main` from local environments are FORBIDDEN.
   * Merging into `main` without Phase 3 review and green CI is FORBIDDEN.

---

### C. Branch Naming Conventions
Every task in the implementation plan (`docs/plan.md`) requires a dedicated branch branched from latest `main`: `<type>/<identifier-or-short-name>`:

| Branch Type | Usage | Pattern | Example |
| :--- | :--- | :--- | :--- |
| `feat/` | New feature implementation from Phase 1 spec | `feat/<name>` | `feat/user-jwt-auth`, `feat/booking-calendar` |
| `fix/` | Bugfix identified in production or Phase 3 | `fix/<issue-id>` | `fix/bb-01-race-condition`, `fix/null-invoice-total` |
| `refactor/` | Internal restructuring preserving behavior | `refactor/<module>` | `refactor/payment-gateway-adapter` |
| `test/` | Adding unit, integration, or adversarial tests | `test/<scope>` | `test/concurrency-slot-booking` |
| `docs/` | Documentation or specification updates | `docs/<topic>` | `docs/api-v1-swagger`, `docs/threat-model` |
| `chore/` | Tooling, build config, dependency upgrades | `chore/<task>` | `chore/github-actions-ci`, `chore/upgrade-node20` |

---

### D. Branch Lifecycle & Workflow

```
[main] (Production-ready baseline)
  │
  ├──> git checkout -b feat/user-auth (Branch from latest main)
  │      │
  │      ├──> TDD Implementation + Atomic Commits when authorized
  │      │
  │      ├──> Local Verification: Lint, Typecheck, Test, Build (All Green)
  │      │
  │      ├──> Inspect upstream; sync/rebase only within authority
  │      │
  │      └──> Gate 2 Handoff ──> Phase 3 Independent Review
  │                               │
  └──<── Merge to main (Squash / Rebase after Green CI & APPROVED) <──┘
       (Delete branch only with cleanup authority)
```

1. **Branch Initialization** (example for an authorized clean checkout; preserve dirty user changes before switching/integrating):
   ```bash
   git checkout main && git pull origin main
   git checkout -b feat/feature-name
   ```
2. **Atomic Commits**:
   * Each commit addresses exactly one meaningful change with testable boundaries.
   * Standard format: `<type>(<scope>): <concise description>`:
     * `feat(auth): implement jwt token generation and validation`
     * `test(booking): add unit tests for double-booking conflict`
     * `fix(billing): correct vat calculation for discounted items`
   * Generic messages (`git commit -m "fix"`, `git commit -m "update code"`) are FORBIDDEN.
3. **Continuous Rebase & Conflict Resolution**:
   * Before Phase 3, inspect upstream changes. Rebase/integrate only within granted scope and after preserving user changes; any changed snapshot requires re-verification. Do not force history changes merely to hand off.
4. **Repository Hygiene**:
   * Remove only owned scratch artifacts within authority. Preserve uncommitted user changes and report dirty state honestly; without commit authority, hand off baseline plus immutable hashes for relevant tracked/untracked files.
   * Verify clean state:
     ```bash
     git status --short  # Record exact state; pair dirty files with snapshot hashes
     ```
   * Post-merge, delete feature branches only within explicit cleanup authority.

---

## 3. Project Directory Layout

Document directory structures in `docs/environment.md` or `docs/plan.md`, segregating architectural responsibilities:

```text
project-root/
├── .env.example             # Environment template (zero real secrets)
├── .gitignore               # Standard git exclusion list
├── README.md                # Project overview and runbooks
├── docker-compose.yml       # Local backing services (DB, Redis, Mailhog)
├── docs/                    # Direwolf SDLC artifacts (intent, spec, design, plan, environment)
├── scripts/                 # Automation scripts (seed, migrate, build, CI)
├── src/                     # Core application source code
│   ├── domain/              # Entities, value objects, domain logic (ZERO dependencies)
│   ├── application/         # Use cases, DTOs, business orchestration
│   ├── infrastructure/      # Database repositories, external API adapters, cache
│   └── presentation/        # API controllers, routers, CLI commands, UI components
└── tests/                   # Multi-tier test suites
    ├── unit/                # Isolated unit tests (mocked boundaries)
    ├── integration/         # Integration tests (live test database/services)
    └── e2e/                 # End-to-end user journey tests
```

---

## 4. Task Specification Matrix: Inputs, Outputs & Acceptance Criteria

Every task in the implementation plan (`docs/plan.md`) must define 3 concrete elements:

| Component | Specification Requirement | Concrete Example |
| :--- | :--- | :--- |
| **1. Inputs** | - Referenced specification & criteria ID.<br>- Applicable API contracts / DTOs.<br>- Source files to read or modify.<br>- Prerequisite environment state. | - Ref: `docs/spec.md` (AC-BOOK-01).<br>- Contract: `POST /api/bookings` in `docs/design.md`.<br>- Target file: `src/domain/booking.ts`.<br>- Environment: Test database migrated and healthy. |
| **2. Outputs** | - New or modified source code files.<br>- Accompanying automated test files.<br>- Documentation or configuration updates. | - Source: `src/application/create_booking_use_case.ts`.<br>- Test: `tests/unit/create_booking_use_case.test.ts`.<br>- Router update: `src/presentation/routes.ts`. |
| **3. Acceptance Criteria & Verification** | - Exact terminal commands to execute.<br>- Expected exit code (`Exit code 0`).<br>- Observable assertion outcomes.<br>- Abort conditions upon failure. | - Command: `pnpm test tests/unit/create_booking_use_case.test.ts`.<br>- Expectation: Exit code 0, 5/5 tests passed.<br>- Assertion: Booking created with status `PENDING`, returns `booking_id`.<br>- Abort condition: If lock contention fails, halt and regress to Phase 1. |
