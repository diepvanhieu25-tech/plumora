# Handover: `SLICE-01` (Full-Stack Golden Journey: Auth, 12-Concept DAG, ACID Quiz + Idempotency, Redis 24-dim State Cache, DQN Serving & Botanical Sprout React SPA) — `2026-11-16T21:05:00+07:00`

- **Mục tiêu nhiệm vụ (`SLICE-01`), tài liệu nguồn & tiêu chí áp dụng (`PL-AUTH-01`, `PL-CONTENT-01`, `PL-QUIZ-01`, `PL-PROGRESS-01`, `PL-REC-01`, `PL-REC-02`, `PL-E2E-01`):**
  - Hiện thực hóa trọn vẹn Lát cắt dọc đầu tiên (Golden Journey) của hệ thống Plumora:
    1. **`AuthMod` (`PL-AUTH-01` — `D-11`):** Đăng ký, đăng nhập (`Argon2id`), đăng xuất, cấp/kiểm tra `HttpOnly Cookie / JWT (HS256)`, cô lập dữ liệu theo `current_user.id` (chống IDOR) và nạp tự động 3 tài khoản học viên mẫu thật trong PostgreSQL (`learner_new`, `learner_foundation`, `learner_api_stage`).
    2. **`ContentMod` (`PL-CONTENT-01` — `D-05`):** Seed tự động (idempotent) 12 khái niệm Backend chia 4 tầng DAG, bài lý thuyết Markdown và ngân hàng 48 câu hỏi Single-choice MCQ (`backend/app/seed/backend_12_concepts.json`); phục vụ `GET /api/v1/roadmap` và `GET /api/v1/concepts/{slug}` (ẩn `correct_option_key`, chặn bài `Locked` với `403 CONCEPT_LOCKED`).
    3. **`AssessMod` (`PL-QUIZ-01`, `PL-PROGRESS-01` — `D-06`, `D-10`):** Chấm điểm Quiz 4 câu tại 3 mốc biên (`2/4 = 50%`, `3/4 = 75%`, `4/4 = 100%`) và đặt lại `Demo Presets` (`POST /api/v1/me/preset`) trong **1 ACID Transaction trên PostgreSQL** (`SELECT ... FOR UPDATE`), bảo toàn lũy đẳng theo `UNIQUE (user_id, submission_id)` (`INV-IDEMP-01`), cập nhật `mastery = max(old, attempt_score)` (`INV-MASTERY-01`), tăng `state_version` và đồng bộ Write-through sang Redis (`plumora:state:{user_id}`, `TTL = 3600s`).
    4. **`RecMod` (`PL-REC-01`, `PL-REC-02` — `D-07`, `D-10`):** Xác thực mã băm `SHA-256` của `rl/artifacts/checkpoint.zip` khớp với `manifest.json`, suy luận mạng `QNetwork` (`[24 -> 128 -> ReLU -> 128 -> ReLU -> 12]`) trên vector Observation 24 chiều đọc từ Redis (hoặc tự động fallback về PostgreSQL khi Cache Miss / Redis Down), trả về minh bạch `policy_source` (`dqn`, `dqn_masked_q`, `fallback_rule`, `completed`) và `state_source` (`redis_cache`, `postgres_cache_warm`, `postgres_fallback`).
    5. **`Frontend React SPA` (`PL-CONTENT-01`, `PL-E2E-01` — `D-09`, `D-12`, `D-13`, `D-15`):** Hiện thực hóa đầy đủ các màn hình `SCR-01`..`SCR-08` theo đúng bảng màu Chồi Cây Non (*Botanical Sprout & Sunlit Canopy*: `#15803D`, `#D97706`, `#0D9488`, `#57534E`, nền `#F6F8F5`) và 5 mẫu `StitchMCP` đã duyệt, dùng 100% SVG Vector Icons `lucide-react` (**không có bất kỳ ký tự emoji nào** — `INV-UI-01`).
  - Tài liệu nguồn đã duyệt (`D-01`–`D-15`): [intent.md](../intent.md) (`v1.0.0`), [spec.md](../spec.md) (`v1.0.0`), [design.md](../design.md) (`v1.0.0`), [ui-design-system.md](../ui-design-system.md) (`v1.2.0`), [research/RL_PLAN.md](../research/RL_PLAN.md) (`v1.0.0`), [plan.md](../plan.md) (`v1.0.0`), [decisions.md](../decisions.md) (`v1.1.0`).
- **Bằng chứng nạp Skill:**
  - Đã đọc và thực thi đúng `.agents/skills/sdlc-code/SKILL.md` cùng các references (`tdd_cycle_and_circuit_breaker.md`, `handoff_template.md`) và quy tắc bảo mật web (`mandatory-secure-web-skills`).

---

## 1. Bảng Lệnh Kiểm Chứng Thực Thi (`Executed Verification Commands`)

| Lệnh Kiểm chứng Đã Chạy | Môi trường / Phiên bản | Exit Code & Kết quả Quan sát Thực tế | Đường dẫn Bằng chứng & Ranh giới |
| --- | --- | --- | --- |
| `cd backend && uv run pytest tests/red --tb=short` *(trước khi viết logic)* | `pytest 9.2.0` trên `plumora-backend` | Exit `1` (**Observed RED**): `6 failed` (`404 Not Found`) | [`backend/tests/red/test_slice1_behavioral_red.py`](../../backend/tests/red/test_slice1_behavioral_red.py) |
| `cd frontend && npm run test:red` *(trước khi viết logic)* | `vitest 3.2.7` trên `plumora-frontend` | Exit `1` (**Observed RED**): `3 failed` | [`frontend/src/__tests__/red_slice1.test.tsx`](../../frontend/src/__tests__/red_slice1.test.tsx) |
| `cd backend && uv run pytest && uv run ruff check . && uv run mypy app tests` | Python `3.12.16`, `PostgreSQL 16`, `Redis 7` | Exit `0`: **`14 passed in 2.35s`** (`7` bài trong `test_slice1_behavioral_red.py`, `2` bài trong `test_env_smoke.py`, `5` bài trong `test_slice1_adversarial_and_fallback.py`); `All checks passed!`; `Success: no issues found in 14 source files` | [`backend/tests/`](../../backend/tests/) |
| `cd frontend && npm test -- --run && npm run lint && npm run typecheck && npm run build` | Node `v22.22.3`, `Vitest 3.2.7`, `Vite 6.4.6` | Exit `0`: **`4 test files passed (6 tests passed)`** bao gồm `smoke.test.tsx`, `red_slice1.test.tsx`, `golden_journey.spec.ts` và **`live_fullstack_journey.spec.ts`** (chạy trực tiếp với FastAPI `:8000` + PostgreSQL `:5432` + Redis `:6379` + DQN Checkpoint thật); `eslint` & `tsc --noEmit` sạch lỗi; `vite build` thành công | [`frontend/src/`](../../frontend/src/), [`frontend/e2e/`](../../frontend/e2e/) |
| `./scripts/ci_check.sh && git diff --check` | Toàn bộ Workspace (`backend`, `rl`, `frontend`) | Exit `0`: `=== ALL DAY-0 CI & SMOKE CHECKS PASSED ===` (Backend `14 passed`, RL `9 passed`, Frontend `6 passed` + build xanh, `git diff --check` sạch) | [`scripts/ci_check.sh`](../../scripts/ci_check.sh) |

---

## 2. Trạng thái Toàn bộ Tiêu chí Nghiệm thu (`Criteria Status` tại mốc `SLICE-01`)

| Mã `AC-ID` | Trạng thái | Bằng chứng Kiểm chứng Thực tế (Layer 1, 2, 3, 4) |
| --- | --- | --- |
| **`PL-AUTH-01`** | **`GREEN`** | Kiểm chứng đăng ký, đăng nhập (`Argon2id`), đăng xuất, `/api/v1/auth/me` (`401 AUTH_REQUIRED` khi chưa đăng nhập), 3 tài khoản Seed thật (`learner_new`, `learner_foundation`, `learner_api_stage`) và cô lập phiên chống IDOR (`test_pl_auth_01_anti_idor_session_isolation`). |
| **`PL-CONTENT-01`** | **`GREEN`** | Kiểm chứng seed idempotent 12 khái niệm 4 tầng DAG (`backend_12_concepts.json`), ẩn `correct_option_key` trên `GET /api/v1/concepts/{slug}`, hiển thị đầy đủ trên `SCR-02` & `SCR-03`, bảng màu Chồi Cây Non và kiểm tra regex khẳng định **0 ký tự emoji** trong DOM (`INV-UI-01`). |
| **`PL-QUIZ-01`** | **`GREEN`** | Kiểm chứng chấm điểm Quiz 4 câu tại biên `2/4 = 50%` (`passed=false`), `3/4 = 75%` (`passed=true`), từ chối `< 4` câu với `422 QUIZ_VALIDATION_ERROR`, từ chối bài `Locked` với `403 CONCEPT_LOCKED` (`INV-DAG-01`) và khóa nút nộp trên `SCR-04` khi chưa chọn đủ 4 câu. |
| **`PL-PROGRESS-01`** | **`GREEN`** | Kiểm chứng ACID Transaction trên PostgreSQL (`SELECT ... FOR UPDATE`), lũy đẳng `submission_id` (`idempotent_replay=true`, không tăng `state_version` hay tạo dòng trùng — `INV-IDEMP-01`), bảo lưu điểm cao nhất `mastery = max(old, score)` (`INV-MASTERY-01`), đặt lại `Demo Presets` (`SCR-05`) và bảo toàn tiến độ sau khi tải lại trang. |
| **`PL-REC-01`** | **`GREEN`** | Kiểm chứng nạp và xác thực `SHA-256` (`e464fa638cee04fda6a386ffb6cdf24d9190d0f1167feb56d4da0063499a6b6b`) của `checkpoint.zip`, suy luận Q-values từ vector 24 chiều trên Redis (`state_source="redis_cache"`), hiển thị trên `AiRecommendationBanner` (`SCR-02`) và `RlProvenanceDrawer` (`SCR-06`). |
| **`PL-REC-02`** | **`GREEN`** | Kiểm chứng tự động chuyển sang `policy_source="fallback_rule"` (`degraded=true`, không giả nhãn `dqn`) khi thiếu/hỏng checkpoint; tự động chuyển sang `state_source="postgres_fallback"` khi Redis dừng hoạt động; và trả `status="completed"` (`SCR-07`) khi đạt 12/12 khái niệm. |
| **`PL-RL-01`** | **`GREEN`** | Đã hoàn tất và kiểm chứng tại [`HANDOFF_RL_01.md`](HANDOFF_RL_01.md) (`9 passed`). |
| **`PL-E2E-01`** | **`GREEN`** | Kiểm chứng hành trình đầu-cuối (`golden_journey.spec.ts` và `live_fullstack_journey.spec.ts` kết nối trực tiếp React SPA $\rightarrow$ FastAPI `:8000` $\rightarrow$ PostgreSQL 16 `:5432` $\rightarrow$ Redis 7 `:6379` $\rightarrow$ Checkpoint `DQN` thật). *Lưu ý môi trường:* Máy chủ Linux hiện tại không cài sẵn binary trình duyệt `google-chrome`/`chromium` nên `chrome-devtools-mcp` báo `Target closed`; hành trình Full-Stack đã được kiểm chứng trực tiếp qua HTTP thật tới Uvicorn + PostgreSQL + Redis. |

---

## 3. Manifest SHA-256 của Các Tệp Tạo Mới / Cập Nhật trong `SLICE-01`

| Đường dẫn tương đối | Mã băm `SHA-256` |
| --- | --- |
| `.github/workflows/ci.yml` | `66fdd994a3a5aa832701f86f15c0cc18cbca46bec0bacfc1dd68092ade0750f5` |
| `backend/app/config.py` | `ba98d4e6052e6a682465bc4354e5fe7e5b7de327cdc16732e802cda5f83b914b` |
| `backend/app/db/__init__.py` | `54ba8a198bf5ddc0d08634121d2829b5e83aa6f23787b1cbc03b8c3ebd01a0fa` |
| `backend/app/db/models.py` | `a434bc4234c70946e9b666432d2c1cb8973c4cf3f5d27f84a21d941fe9b3063b` |
| `backend/app/db/redis_store.py` | `93c16103e57ea6712c64fe033e99d1f341edde6594019b22b71c3da4496937bc` |
| `backend/app/main.py` | `14694c7a170c3c31d56829a9ee4393fa5b325c634f5a7c4adc3cc1c73e9e5238` |
| `backend/app/modules/__init__.py` | `8ca797eb9ad08f2cb3f979da696e9def1629c5c6dca8db54abce5ed2ce38c960` |
| `backend/app/modules/assessment.py` | `8e38ddad1f95f89fd1530687a47040b075f5ff57f5868c8956a896950d32d6f8` |
| `backend/app/modules/auth.py` | `ffe7dc9074c89e47d5c8c4b18856b7da5dcedf2d824588ea046132a389f1a32b` |
| `backend/app/modules/content.py` | `07b683a419c3b907ffb1a8babc28f1e138bbea019f583b8da6773257cd1ae643` |
| `backend/app/modules/recommendation.py` | `ac55821484b10c9f1b994e28acf1a654573829f424b9cda338664588e9dec3c1` |
| `backend/app/seed/backend_12_concepts.json` | `0b819196e3a9411917167f452f28fa8647d5367b0949a0c1ecfe9348a7f7d358` |
| `backend/tests/red/test_slice1_behavioral_red.py` | `a87fc24353800c2946106df20d8b6d98c5d8258cabbb269e414e60ea4d3d0458` |
| `backend/tests/smoke/test_env_smoke.py` | `edd1f0ffc3955ec27f8273bb1efd5fdc1a32193601fb00a602f8048a5047ae1d` |
| `backend/tests/test_slice1_adversarial_and_fallback.py` | `438d13fa753df97aeac6c34f79ac1999d04d56aee15e787c7b4c2d5cc2b5eba2` |
| `docs/README.md` | `f00fdd15da057d3ef1390393b334c32c1cba69f96e5e26c196ebf9aba7201117` |
| `docs/plan.md` | `fd14d762441b232af53c7584613fc04d5c1b6b6c311c21e2171f08249ef0d769` |
| `frontend/e2e/golden_journey.spec.ts` | `ebcf3f0ec1c39295061e38ad2e8dedeec030eaef961fa6e263c58e6ad40134b9` |
| `frontend/e2e/live_fullstack_journey.spec.ts` | `fdd65a4c42dd1658e33ec6b90f3aaa1e4e7ddec47a1be1ef3ba5b3a461ca24e8` |
| `frontend/src/App.tsx` | `4322c9d2b0ed149d798569a6e292df1f0ef983d01ec3b0541f326b307df79fbd` |
| `frontend/src/__tests__/red_slice1.test.tsx` | `25a0532b1d272bfb73144dd0099dd8e9b27f3a32aebd8743013d32b815da147a` |
| `frontend/src/__tests__/smoke.test.tsx` | `bba53d95aeee4b76e931953c362304dc8d837739ca1694a17a21dafd45381b76` |
| `frontend/src/api.ts` | `82399e5961d8ec7d0fd4eae741663295dcb50655c061e01a3372b365a5d66d81` |
| `frontend/src/index.css` | `926d120a193d40b4dadec5e133ebbd018d791ca101757e6f45295457f18af3aa` |
| `frontend/src/types.ts` | `99298acc75d0ec0d6690fe93999cfbb0b3207076ff24cdc87f49502842d1aba7` |
| `frontend/vite.config.ts` | `8cf1f8e3e0c2f637c1f7924e2df0f7c75a47a15bcaa21ee770df89b100a87f80` |
| `scripts/ci_check.sh` | `fa6c1915f1f888cf8a182859b895d963b7c3759505677c315de1134a7cd38f9d` |

---

## 4. Dịch vụ Đang Chạy & Bước Tiếp theo (`Next Step — Gate 3 Independent Review`)

- **Dịch vụ đang chạy (`Up`):**
  - Docker Compose: `plumora-postgres` (`127.0.0.1:5432`, `healthy`) và `plumora-redis` (`127.0.0.1:6379`, `healthy`).
  - Dev Servers: `FastAPI Uvicorn` (`http://127.0.0.1:8000`) và `Vite React SPA` (`http://127.0.0.1:5173`).
- **Bước tiếp theo (`REVIEW-01` — Gate 3):** Cả hai nhiệm vụ `RL-01` và `SLICE-01` đã hoàn tất thực thi và bàn giao đầy đủ bằng chứng; nhiệm vụ **`REVIEW-01`** (Review độc lập 4 trục UI/UX, Code Quality, Security, Database bằng `sdlc-review` trong phiên cô lập) đã được mở khóa sang trạng thái **`ready`** trong [`docs/plan.md`](../plan.md).
