# Hồ sơ Môi trường và Sẵn sàng Thực thi (Environment & Readiness Dossier): `ENV-01`

Phiên bản: `1.0.0` — **VERIFIED (Gate 2 Readiness cho `ENV-01`)**.
- **Nhánh Git & Phiên bản tài liệu làm căn cứ:**
  - Nhánh task: `feat/mvp-slice-1` (tách từ `chore/bootstrap`, chưa commit theo quy tắc phân quyền Gate 4).
  - Baseline đã duyệt (`D-01`–`D-15`): [intent.md](intent.md) (`v1.0.0`), [spec.md](spec.md) (`v1.0.0`), [design.md](design.md) (`v1.0.0`), [ui-design-system.md](ui-design-system.md) (`v1.2.0`), [research/RL_PLAN.md](research/RL_PLAN.md) (`v1.0.0`), [plan.md](plan.md) (`v1.0.0`), [decisions.md](decisions.md) (`v1.1.0`).
- **Đối chuẩn tương đương hành vi (Target Parity Baseline):** Kiến trúc mục tiêu đã duyệt tại `D-04`, `D-09`, `D-10`, `D-11` trong [design.md](design.md) (`v1.0.0` — Modular Monolith trên Local Docker Compose).
- **Môi trường cục bộ đã cấp phát (Không chứa secret thật):**
  - `.env.example` (mẫu cấu hình chuẩn trong Git) và `.env.local` (đã loại trừ trong `.gitignore`).
  - Toàn bộ cổng dịch vụ (`PostgreSQL 16`, `Redis 7`, `FastAPI`, `Vite`) chỉ lắng nghe trên `127.0.0.1` (tuân thủ quy tắc bảo mật không mở `0.0.0.0`).

---

## 1. Môi trường Cục bộ, Hạ tầng Docker và Day-0 CI/CD

- **Kiểm soát phiên bản Git & Day-0 CI/CD:**
  - `.gitignore` chuẩn hóa loại trừ `.env*` (trừ `.env.example`), `.venv/`, `node_modules/`, `dist/`, `build/`, caches.
  - Workflow GitHub Actions [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) và script kiểm tra đồng bộ cục bộ [`scripts/ci_check.sh`](../scripts/ci_check.sh) thực thi đủ **4 chốt kiểm định bắt buộc**:
    1. **Lint Check:** `ruff check .` (`backend`, `rl`) và `npm run lint` (`eslint` trên `frontend`).
    2. **Type Check:** `mypy --strict` (`backend`, `rl`) và `tsc --noEmit` (`frontend`).
    3. **Environment Smoke Tests:** `pytest tests/smoke` (`backend`, `rl`) và `vitest run src/__tests__/smoke.test.tsx` (`frontend`).
    4. **Build Verification:** `tsc -b && vite build` (`frontend`).
- **Kết quả 5 bước khởi tạo môi trường cục bộ (5-Step Local Bootstrapping):**
  1. **Step 1 — Runtime & Lockfiles:** `Python 3.12.16` (`uv 0.13.7`) với `backend/uv.lock` + `backend/requirements.lock` và `rl/uv.lock` + `rl/requirements.lock`; `Node.js v22.22.3` (`npm 10.9.8`) với `frontend/package-lock.json`.
  2. **Step 2 — Biến môi trường (`.env.local`):** Khởi tạo từ `.env.example`, cấu hình `DATABASE_URL` (`postgresql+psycopg://...@127.0.0.1:5432/plumora_dev`) và `REDIS_URL` (`redis://127.0.0.1:6379/0`).
  3. **Step 3 — Dịch vụ phụ trợ Docker-First (`docker-compose.yml`):**
     - `plumora-postgres` (`postgres:16-alpine`, named volume `plumora_pgdata`, port `127.0.0.1:5432:5432`, healthcheck `pg_isready`) $\rightarrow$ Trạng thái: **`Up (healthy)`**.
     - `plumora-redis` (`redis:7-alpine`, named volume `plumora_redisdata`, port `127.0.0.1:6379:6379`, healthcheck `redis-cli ping`) $\rightarrow$ Trạng thái: **`Up (healthy)`**.
  4. **Step 4 — Schema & Seed:** Đã chuẩn bị cấu trúc thư mục `backend/app/db/migrations` và `backend/app/seed` cho `SLICE-01`; kiểm tra kết nối truy vấn trực tiếp `SELECT 1` trên `PostgreSQL 16` và `PING` trên `Redis 7`.
  5. **Step 5 — Environment Smoke Test:** Toàn bộ smoke tests của `backend`, `rl` và `frontend` đều vượt qua (`PASSED`, exit code `0`).

---

## 2. Ma trận Tương đương Hành vi (Behavioral Parity Matrix)

| Thành phần / Dịch vụ | Baseline Mục tiêu (`design.md` v1.0.0) | Trạng thái Cục bộ Thực tế | Lệnh Kiểm chứng & Kết quả | Độ lệch & Tác động Hành vi | Quyết định Vận hành |
| --- | --- | --- | --- | --- | --- |
| **Python Runtime & Package Lock** | `Python 3.11/3.12` + lockfile (`D-09`) | `CPython 3.12.16` + `uv.lock` & `requirements.lock` | `uv run python --version` $\rightarrow$ `Python 3.12.16` (Exit `0`) | Không có độ lệch (`1:1 Parity`) | Chấp thuận cho `RL-01` & `SLICE-01` |
| **Node.js Runtime & Frontend Lock** | `Node.js 22 LTS` + `package-lock.json` (`D-09`) | `Node.js v22.22.3`, `npm 10.9.8` + `package-lock.json` | `node --version && npm --version` (Exit `0`) | Không có độ lệch (`1:1 Parity`) | Chấp thuận cho `SLICE-01` |
| **PostgreSQL SSoT** | `PostgreSQL 16` với ACID transaction (`D-10`) | Container `plumora-postgres` (`postgres:16-alpine`), volume `plumora_pgdata` | `docker compose ps` $\rightarrow$ `Up (healthy)` trên `127.0.0.1:5432` | Không dùng SQLite thay thế; tương đương 100% kiểu dữ liệu/ACID/locking | Chấp thuận |
| **Redis State Cache** | `Redis 7` lưu vector 24 chiều (`TTL=3600s`, `D-10`) | Container `plumora-redis` (`redis:7-alpine`), volume `plumora_redisdata` | `docker compose ps` $\rightarrow$ `Up (healthy)` trên `127.0.0.1:6379` | Không có độ lệch (`1:1 Parity`) | Chấp thuận |
| **RL Engine (`Gymnasium` + `SB3` + `PyTorch`)** | `Gymnasium` + `Stable-Baselines3 DQN` trên CPU (`D-04`, `D-07`) | `gymnasium==1.4.0`, `stable-baselines3==2.9.2`, `torch==2.15.0+cpu` | `cd rl && uv run pytest tests/smoke` (Exit `0`) | Không có độ lệch (`1:1 Parity`) | Chấp thuận cho `RL-01` |

---

## 3. Bộ khung Kiểm thử (Test Harness) và Phân loại Trạng thái Kiểm thử (`SMOKE GREEN` vs `PRODUCT RED`)

1. **Smoke Tests (Kiểm tra hạ tầng & bộ khung chạy — Bắt buộc `GREEN` ở `ENV-01`):**
   - `cd backend && uv run pytest tests/smoke`: Kiểm tra `GET /api/v1/health` kết nối thật tới `PostgreSQL 16` (`up`) và `Redis 7` (`up`) cùng các HTTP security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `CSP`).
   - `cd rl && uv run pytest tests/smoke`: Kiểm tra `StudentSimulatorEnv` khởi tạo đúng không gian `Box(0.0, 1.0, (24,), float32)` và `Discrete(12)`, kiểm chứng 12 node DAG không chu trình.
   - `cd frontend && npm run test:smoke`: Kiểm tra `Vitest` + `React Testing Library` render component `<App />` với SVG `<Sprout />` của `lucide-react`.
2. **Behavioral Product Tests (Kiểm tra hành vi nghiệp vụ — Quan sát trạng thái `RED` đúng kỳ vọng trước khi viết business logic):**
   - `cd rl && uv run pytest tests/red`: `3 failed` với `NotImplementedError` cho `PL-RL-01` (vì chưa viết logic `reset()` và `step()` của `StudentSimulatorEnv` — sẽ hiện thực ở `RL-01`).
   - `cd backend && uv run pytest tests/red`: `6 failed` với `404 Not Found` cho `PL-AUTH-01`, `PL-CONTENT-01`, `PL-QUIZ-01`, `PL-PROGRESS-01`, `PL-REC-01`, `PL-REC-02` (vì chưa viết các endpoint nghiệp vụ — sẽ hiện thực ở `SLICE-01`).
   - `cd frontend && npm run test:red`: `3 failed` cho `SCR-01`, `SCR-02`, `SCR-04` (vì chưa viết giao diện chi tiết của các màn hình — sẽ hiện thực ở `SLICE-01`).

---

## 4. Quyết định Sẵn sàng trước khi viết Business Logic (`Pre-Code Decisions`)

- **Phạm vi đã mở khóa (`Unblocked Scope`):** Nhiệm vụ `ENV-01` đã hoàn tất toàn bộ yêu cầu Gate 2 Readiness. Nhiệm vụ tiếp theo **`RL-01` (`Student Simulator` & huấn luyện/đánh giá `DQN`)** chính thức chuyển sang trạng thái **`ready`**.
- **Phạm vi còn chờ theo thứ tự DAG:** `SLICE-01` chờ `RL-01` xuất gói artifact chuẩn (`checkpoint.zip` + `manifest.json` + `evaluation_report.json`) để nạp vào `FastAPI` Serving.
