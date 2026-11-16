# Handover: `ENV-01` (Gate 2 Readiness & RED Behavioral Suite) — `2026-11-16T19:37:00+07:00`

- **Mục tiêu nhiệm vụ (`ENV-01`), tài liệu nguồn & tiêu chí áp dụng:**
  - Thiết lập môi trường thực thi, nhánh nhiệm vụ `feat/mvp-slice-1`, scaffold chính thức (`FastAPI` + `Vite React TS` + `rl`), Day-0 CI, dịch vụ phụ trợ Docker Compose (`PostgreSQL 16` + `Redis 7` healthy với named volumes) và quan sát bộ **RED behavioral tests** cho `PL-AUTH-01`, `PL-CONTENT-01`, `PL-QUIZ-01`, `PL-PROGRESS-01`, `PL-REC-01`, `PL-REC-02`, `PL-RL-01`, `PL-E2E-01` trước khi viết business logic.
  - Tài liệu nguồn đã duyệt (`D-01`–`D-15`): [intent.md](../intent.md) (`v1.0.0`), [spec.md](../spec.md) (`v1.0.0`), [design.md](../design.md) (`v1.0.0`), [ui-design-system.md](../ui-design-system.md) (`v1.2.0`), [research/RL_PLAN.md](../research/RL_PLAN.md) (`v1.0.0`), [plan.md](../plan.md) (`v1.0.0`), [decisions.md](../decisions.md) (`v1.1.0`), [environment.md](../environment.md) (`v1.0.0`).
- **Phạm vi đã hoàn tất:**
  - Nhánh Git: `feat/mvp-slice-1` (chưa commit theo đúng quy tắc phân quyền Gate 4; bảo toàn toàn bộ file trên working tree).
  - Khởi tạo `.python-version` (`3.12`), `.nvmrc` (`22`), `.env.example`, `.env.local` (gitignored), `docker-compose.yml`, `.github/workflows/ci.yml` và `scripts/ci_check.sh`.
  - Khởi tạo `backend/` (`FastAPI` + `SQLAlchemy` + `psycopg` + `redis` + `argon2-cffi` + `PyJWT` + `pytest` + `ruff` + `mypy`), `rl/` (`gymnasium` + `stable-baselines3` + `torch==2.15.0+cpu` + `numpy`), `frontend/` (`Vite` + `React 19` + `TypeScript` + `Tailwind CSS` + `lucide-react` + `Vitest` + `Testing Library` + `ESLint`).
- **Bằng chứng nạp Skill:**
  - Đã đọc trực tiếp `.agents/skills/sdlc-code/SKILL.md` cùng các references (`codebase_and_git_workflow.md`, `planning_and_readiness.md`, `local_environment_and_docker_setup.md`) và templates (`implementation_plan_template.md`, `environment_readiness_template.md`, `handoff_template.md`) từ snapshot Direwolf `40742d2`.

---

## 1. Bảng Lệnh Kiểm Chứng Thực Thi (`Executed Verification Commands`)

| Lệnh Kiểm chứng Đã Chạy | Môi trường / Phiên bản | Exit Code & Kết quả Quan sát Thực tế | Đường dẫn Bằng chứng & Ranh giới |
| --- | --- | --- | --- |
| `git checkout -b feat/mvp-slice-1 && git branch --show-current` | Git trên Linux | Exit `0`: `feat/mvp-slice-1` | Working tree giữ nguyên không commit khi chưa có quyền G4 |
| `docker compose --env-file .env.local up -d --wait && docker compose ps` | Docker Compose `v5.1.3` | Exit `0`: `plumora-postgres` (`postgres:16-alpine`, `127.0.0.1:5432`) `Up (healthy)` và `plumora-redis` (`redis:7-alpine`, `127.0.0.1:6379`) `Up (healthy)` | [`docker-compose.yml`](../../docker-compose.yml), [`docs/environment.md`](../environment.md) |
| `./scripts/ci_check.sh` | Python `3.12.16` (`uv 0.13.7`), Node `v22.22.3` (`npm 10.9.8`) | Exit `0`:<br>1. `ruff check .` (`backend`, `rl`) & `npm run lint` (`frontend`): `All checks passed!`<br>2. `mypy` (`backend`, `rl`) & `tsc --noEmit` (`frontend`): `Success: no issues found`<br>3. Smoke tests: `backend` (`2 passed`), `rl` (`1 passed`), `frontend` (`1 passed`)<br>4. `npm run build`: `built in 1.75s` | [`scripts/ci_check.sh`](../../scripts/ci_check.sh), [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) |
| `cd rl && uv run pytest tests/red --tb=short` | `pytest 9.2.0` trên `plumora-rl` | Exit `1` (**Observed RED**): `3 failed` với `NotImplementedError: RL-01 StudentSimulatorEnv.reset() is not implemented yet.` | [`rl/tests/red/test_rl01_simulator_and_eval_red.py`](../../rl/tests/red/test_rl01_simulator_and_eval_red.py) (`PL-RL-01`) |
| `cd backend && uv run pytest tests/red --tb=short` | `pytest 9.2.0` trên `plumora-backend` | Exit `1` (**Observed RED**): `6 failed` với `404 Not Found` cho các route `/api/v1/auth/*`, `/api/v1/roadmap`, `/api/v1/concepts/*`, `/api/v1/recommendations` | [`backend/tests/red/test_slice1_behavioral_red.py`](../../backend/tests/red/test_slice1_behavioral_red.py) (`PL-AUTH-01`..`PL-REC-02`) |
| `cd frontend && npm run test:red` | `vitest 3.2.7` trên `plumora-frontend` | Exit `1` (**Observed RED**): `3 failed` do chưa hiện thực hóa các màn hình `SCR-01`, `SCR-02`, `SCR-04` | [`frontend/src/__tests__/red_slice1.test.tsx`](../../frontend/src/__tests__/red_slice1.test.tsx) (`PL-AUTH-01`, `PL-CONTENT-01`, `PL-QUIZ-01`, `PL-REC-01`) |

---

## 2. Trạng thái Tiêu chí Nghiệm thu (`Criteria Status` tại mốc `ENV-01`)

- **Đã kiểm chứng `GREEN` (Readiness & Infrastructure Smoke):**
  - Hạ tầng `PostgreSQL 16` + `Redis 7` healthy với named persistent volumes (`plumora_pgdata`, `plumora_redisdata`).
  - Endpoint `GET /api/v1/health` kết nối thật tới PostgreSQL & Redis và gắn đầy đủ các HTTP Security Headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `CSP`, `Permissions-Policy`).
  - Toàn bộ chuỗi Day-0 CI (`Lint`, `Typecheck`, `Smoke Tests`, `Build`) xanh 100%.
- **Đã quan sát `RED` đúng kỳ vọng (Sẵn sàng cho TDD ở `RL-01` và `SLICE-01`):**
  - `PL-RL-01`: Đã có bộ test RED tại `rl/tests/red/test_rl01_simulator_and_eval_red.py`.
  - `PL-AUTH-01`, `PL-CONTENT-01`, `PL-QUIZ-01`, `PL-PROGRESS-01`, `PL-REC-01`, `PL-REC-02`, `PL-E2E-01`: Đã có bộ test RED tại `backend/tests/red/test_slice1_behavioral_red.py`, `frontend/src/__tests__/red_slice1.test.tsx` và `frontend/e2e/golden_journey.spec.ts`.

---

## 3. Manifest SHA-256 của Snapshot Hiện Tại (`feat/mvp-slice-1`, No-Commit Work)

| Đường dẫn tương đối | Mã băm `SHA-256` |
| --- | --- |
| `.env.example` | `49d7b3e7b4acf524284d203e87155b3d1f7f6d770fef3441101aa4bd3c43f5e2` |
| `.github/workflows/ci.yml` | `b1c975430e0aa483196b97d5aef467066e36216c31c8fee7b8fe37616ab4c370` |
| `.gitignore` | `a3e38562706aa44faee7e8de5ad971bb26ed05b7a71be7a40d34b0ffa0285837` |
| `.nvmrc` | `f14b4987904bcb5814e4459a057ed4d20f58a633152288a761214dcd28780b56` |
| `.python-version` | `7b55f8e67b5623c4bef3fa691288da9437d79d3aba156de48d481db32ac7d16d` |
| `backend/app/__init__.py` | `925271c2a868c224f9db01a02ae80d30a2a77e17c694fb16548b14c687e503ca` |
| `backend/app/config.py` | `aa34a825d48bf88f7c50891dec3be5f23a0379b9fe1c52f7fddaf44bef79ea92` |
| `backend/app/main.py` | `d64f7e8ac345396679e9c13c327996065a002f7cad21cccdfeae6fafc0dfe8ff` |
| `backend/pyproject.toml` | `b05dae6e5cb7f430da2a5e6311b9a05b3e07e516aecd8fe691eae195e93e8b66` |
| `backend/requirements.lock` | `3dd35de1f708f28d5dbde812dce58f5f09875dc5c815384dd58207e08b0add4e` |
| `backend/tests/red/test_slice1_behavioral_red.py` | `8691bbefee1a7228acb7cb0ec98fc1d58778dc7c6bdcdf01992feb07db4dde01` |
| `backend/tests/smoke/test_env_smoke.py` | `edd1f0ffc3955ec27f8273bb1efd5fdc1a32193601fb00a602f8048a5047ae1d` |
| `backend/uv.lock` | `f3903a9f8f647817bbc2cdb6cc473e33f88308f1e6df38f54908143f1fe190e6` |
| `docker-compose.yml` | `92c64d189aa122e762c6900ac3c23c33c86c5d2c832577af15197700b0b77f4b` |
| `docs/environment.md` | `6ff4187009c5ec5f461f798f7cc470683958dee71963d2cfe417b7c79a7b47ae` |
| `docs/plan.md` | `fba18a15b29f5beede842bd33f5a7dc22e3858706e28a00a33a7bbbb9c5a42aa` |
| `frontend/e2e/golden_journey.spec.ts` | `d31d688d1f024265f45f236388a96b168dcc102dc9f4f41e0baee62663b5f6c6` |
| `frontend/eslint.config.js` | `dc00c7db700d03834d04a172ea709593ae5ef1bc750eb55dfc521a60d9e1baa0` |
| `frontend/package-lock.json` | `d8702d9b14cd904a15cf7ba383864425637d405384153df5f9022438c1ad3519` |
| `frontend/package.json` | `4879a4f131fb9f2f0a2130c85c5997c783ea74c2a8446fb57e49ae67c55029d8` |
| `frontend/src/App.tsx` | `71a42443ed6b95aa940a6923772660ee8f1c373f2be1e8e98aa7449119583f08` |
| `frontend/src/__tests__/red_slice1.test.tsx` | `25a0532b1d272bfb73144dd0099dd8e9b27f3a32aebd8743013d32b815da147a` |
| `frontend/src/__tests__/smoke.test.tsx` | `bba53d95aeee4b76e931953c362304dc8d837739ca1694a17a21dafd45381b76` |
| `frontend/src/setupTests.ts` | `977afde26bba6a51325908cd7713cbfdc87d18f06b78b237c8f364c44864b7de` |
| `frontend/tsconfig.app.json` | `0b9be453cf6ba3a88391d66f98a4c51bd1a456a2393b33cd508d99f9d33cb818` |
| `frontend/tsconfig.node.json` | `a85b7b94e946767a9d320fbba73b354bbce5176f378ad8e1a7d23caa9b1f55c0` |
| `frontend/vite.config.ts` | `1769781c396c377b281fd6e0649691c958bfe2758ef33017d18b76f3937eda01` |
| `rl/pyproject.toml` | `6fe695c23a34d8c949ba070c057a671b8fbf440b293d65ff094652080dba0959` |
| `rl/requirements.lock` | `fc45210ba6ddbef9313bb5a52475aaeb4f411ac0f2bc1b4cc10db07ea20bab8d` |
| `rl/src/plumora_rl/__init__.py` | `f4e8f02e7f8739879f1132460077618b855cb1acb2077eb83649df9dd80679c5` |
| `rl/src/plumora_rl/config.py` | `ad4d83bc0d0e40492c1203a09f8b886280ce5448d6df3e1a1ab3ead19c294a0f` |
| `rl/src/plumora_rl/simulator.py` | `00b15e18dc2161d28f81cd63b4cad11fcfb740f692bfe5ffc6c2eabd0fde64c6` |
| `rl/tests/red/test_rl01_simulator_and_eval_red.py` | `423333dae18e9f2b77ab8c9856d26ca8362d8a868b35c7b8d7dfb0d929647669` |
| `rl/tests/smoke/test_rl_env_smoke.py` | `1dc8994018ca46121ebf39c4c34b2b1988219f5c3c9d46a486c09279cfa25506` |
| `rl/uv.lock` | `e24c01ab80360f127d082dc6a533983c8652eb2b7f241b15eab96eed07484d3c` |
| `scripts/ci_check.sh` | `deed421915873c8d500517ae7e83f1ad3079b7e81ebc8d88f5e99fe5d97ee249` |

---

## 4. Các Dịch vụ Đang Chạy & Bước Tiếp theo (`Next Step`)

- **Dịch vụ nền đang chạy:** `plumora-postgres` (`127.0.0.1:5432`, `healthy`) và `plumora-redis` (`127.0.0.1:6379`, `healthy`).
- **Người nhận bàn giao & Bước tiếp theo:** Chuyển sang thực thi nhiệm vụ **`RL-01`** (đang ở trạng thái `ready` trong [`docs/plan.md`](../plan.md)) bằng `sdlc-code` để hiện thực hóa `StudentSimulatorEnv`, 3 Baselines (`B1`, `B2`, `B3`), huấn luyện `DQN` trên `train_seeds=[101, 202, 303]`, chọn model trên `val_seed=999`, đánh giá trên `eval_seed=2026` (`500` episodes) và làm xanh bộ test `rl/tests/red/test_rl01_simulator_and_eval_red.py` (`PL-RL-01`).
