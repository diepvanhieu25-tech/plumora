# Kế hoạch khởi động và phát triển (Task DAG)

Phiên bản: `1.0.0` — **APPROVED (Gate 1 Baseline — Chủ dự án duyệt tại `D-14` / `O-10` ngày 2026-11-16)**. Khung thời gian mục tiêu đã chốt tại `D-04` (`O-01`) là **4–5 tuần** (4 tuần phát triển sản phẩm & thực nghiệm RL, 1 tuần hoàn thiện báo cáo & chuẩn bị bảo vệ); không gán ngày lịch giả định. Toàn bộ 10 quyết định (`O-01`–`O-10`) đã được chốt tại `D-04`–`D-14`. Chế độ điều phối mặc định của dự án: `execution_mode = sequential` (chạy tuần tự theo [AGENTS.md](../AGENTS.md)).

## 1. Bảng phân rã nhiệm vụ theo DAG (`Task DAG`)

| Nhiệm vụ | Phụ thuộc (`depends_on`) | Độ phức tạp / Nỗ lực (`complexity` / `effort`) | Kết quả bàn giao & Tiêu chí (`AC-ID`) | Lớp kiểm chứng (Verification Layers) | Trạng thái & Điều kiện mở khóa |
| --- | --- | --- | --- | --- | --- |
| `BOOT-01` | — | `low` / `low` | Tiếp nhận brief, bộ luật, skills cố định, hướng dẫn CLI và prompt | File & whitespace checks (`docs/verification/BOOTSTRAP.md`) | `accepted` (trong phạm vi hồ sơ bootstrap) |
| `PLAN-01` | `BOOT-01` | `high` / `high` | Giải quyết `O-01`–`O-10` (`D-04`–`D-14`), hoàn thiện `intent.md` (`v1.0.0`), `spec.md` (`v1.0.0`), `design.md` (`v1.0.0`), `ui-design-system.md` (`v1.0.0`), `plan.md` (`v1.0.0`) | Traceability check: Intent $\rightarrow$ Spec (`AC-ID`) $\rightarrow$ System Design $\leftrightarrow$ Design System $\rightarrow$ DAG | `accepted` — **Đã duyệt Gate 1 (`D-14` / `O-10`)** |
| `PLAN-02` | `BOOT-01` | `high` / `high` | Chốt hợp đồng `Student Simulator` 24 chiều và thiết kế thực nghiệm `DQN` vs `B1/B2/B3` (`D-07`, `D-08`) | Kiểm tra hợp đồng RL (`docs/research/RL_PLAN.md` v1.0.0) | `accepted` — **Đã duyệt Gate 1 (`D-14` / `O-10`)** |
| `ENV-01` (`is_foundation: true`) | `PLAN-01`, `PLAN-02` | `medium` / `medium` | Nhánh task (`feat/mvp-slice-1`), scaffold chính thức (`FastAPI` + `Vite React TS` + `rl` theo `D-09`), Day-0 CI, Docker Compose (`PostgreSQL` + `Redis` với volumes & healthchecks theo `D-04`, `D-10`) và bộ **RED behavioral tests** cho `PL-AUTH-01`, `PL-CONTENT-01`, `PL-QUIZ-01`, `PL-PROGRESS-01`, `PL-REC-01`, `PL-REC-02`, `PL-RL-01` | **Gate 2 Readiness (Layer 1):** Container healthchecks xanh, lint/typecheck chạy thật, RED tests quan sát được trước khi viết business logic | **`verifying` — Đã hoàn tất thực thi & bàn giao tại [`docs/verification/HANDOFF_ENV_01.md`](verification/HANDOFF_ENV_01.md)** |
| `RL-01` | `ENV-01` | `high` / `high` | Hiện thực hóa `Student Simulator` 24 chiều, 3 Baselines (`B1`, `B2`, `B3`), huấn luyện `DQN` trên `train_seeds=[101,202,303]`, chọn model trên `val_seed=999` và đánh giá độc lập trên `eval_seed=2026` (`500` episodes); xuất `checkpoint.zip`, `SHA-256`, `training_log`, `evaluation_report` (`PL-RL-01`) | **Layer 1 & 2:** Unit/integration tests cho Simulator invariants (unlock, reward, terminal, no leakage); tái lập kết quả đánh giá và kiểm tra `invalid_action_rate < 5%` | **`verifying` — Đã hoàn tất thực thi, đạt chuẩn `PL-RL-01` (`invalid_action_rate = 0.00%`, vượt `B2`) & bàn giao tại [`docs/verification/HANDOFF_RL_01.md`](verification/HANDOFF_RL_01.md)** |
| `SLICE-01` | `ENV-01`, `RL-01` | `critical` / `high` | Lát cắt dọc đầu tiên (Golden Journey): Xác thực & 3 tài khoản Seed thật (`PL-AUTH-01`) $\rightarrow$ Bản đồ DAG 12 khái niệm & Demo Presets (`PL-CONTENT-01`) $\rightarrow$ Học lý thuyết & Nộp Quiz 4 câu trong ACID Tx + Idempotency + Redis sync (`PL-QUIZ-01`, `PL-PROGRESS-01`) $\rightarrow$ Khuyến nghị `DQN` nạp đúng checkpoint + Graceful Fallback (`PL-REC-01`, `PL-REC-02`) $\rightarrow$ Hành trình E2E trên `SCR-01`..`SCR-08` với hệ màu Chồi Cây Non & 100% SVG icons (`PL-E2E-01`) | **Layer 1, 2, 3, 4:** Backend `pytest` + Frontend `Vitest` (Layer 1–2); Full-Stack E2E trên hệ thống thật (Layer 3); kiểm thử nộp trùng `submission_id`, tắt Redis để xác nhận `postgres_fallback`, hỏng checkpoint để xác nhận `fallback_rule`, và chống IDOR (Layer 4) | **`verifying` — Đã hoàn tất thực thi, đạt chuẩn toàn bộ `PL-AUTH-01`..`PL-E2E-01` & bàn giao tại [`docs/verification/HANDOFF_SLICE_01.md`](verification/HANDOFF_SLICE_01.md)** |
| `REVIEW-01` | `RL-01`, `SLICE-01` | `high` / `high` | Review độc lập 4 trục (UI/UX, Code Quality, Security, Database) trên đúng commit snapshot trong phiên tách biệt (`isolated_subagent`) (**Gate 3**) | **Gate 3 Verification:** Bằng chứng độc lập trên cả 4 trục và đối chiếu chuỗi bằng chứng RL | **`verified` — Đạt chuẩn Gate 3 (`APPROVED`) & lập hồ sơ tại [`docs/verification/VERIFICATION_GATE3.md`](verification/VERIFICATION_GATE3.md)** |
| `DEFENSE-01` | `REVIEW-01` | `medium` / `medium` | Đóng gói bản chạy Demo Local Docker Compose (`docker-compose.demo.yml`), kịch bản bảo vệ đồ án 8 bước ([`docs/defense/DEMO_RUNBOOK.md`](defense/DEMO_RUNBOOK.md)), báo cáo thực nghiệm RL ([`docs/defense/RL_EXPERIMENTAL_REPORT.md`](defense/RL_EXPERIMENTAL_REPORT.md)), cập nhật README và hồ sơ phát hành Gate 4 ([`docs/verification/RELEASE_GATE4.md`](verification/RELEASE_GATE4.md)) | Kiểm tra đóng gói Docker Compose 4 container, probe sức khỏe, và chuỗi commit nguyên tử trên `feat/mvp-slice-1` | **`accepted` — Đã hoàn tất đóng gói Gate 4 (`RELEASE_GATE4.md`) & sẵn sàng bảo vệ** |

## 2. Đặc tả Baseline chi tiết cho Lát cắt dọc đầu tiên (`ENV-01` $\rightarrow$ `RL-01` $\rightarrow$ `SLICE-01`)

### 2.1. Truy vết Giá trị (Value & Traceability Mapping)
- **Năng lực / Miền (Capability/Domain):** Quản lý lộ trình học Backend 12 khái niệm DAG và khuyến nghị bài học cá nhân hóa bằng `DQN`.
- **Hành trình người dùng (Golden Journey):** Học viên đăng nhập (hoặc chọn tài khoản Seed mẫu / Demo Preset) $\rightarrow$ Xem bản đồ 12 khái niệm 4 tầng DAG và bài học được `DQN` khuyến nghị $\rightarrow$ Đọc bài lý thuyết Markdown $\rightarrow$ Làm bài Quiz 4 câu Single-choice $\rightarrow$ Hệ thống chấm điểm trong ACID transaction, cập nhật `mastery = max(old, score)` và đồng bộ Redis $\rightarrow$ Xin khuyến nghị bài tiếp theo từ `DQN` $\rightarrow$ Tải lại trang vẫn bảo toàn tiến độ.
- **Tài liệu nguồn & Phiên bản làm căn cứ (Gate 1 Baseline `v1.0.0`):**
  - [brief/project-direction.md](brief/project-direction.md) (Bản gốc Giai đoạn 1: `B-01`–`B-04`)
  - [decisions.md](decisions.md) (`v1.0.0`: `D-01`–`D-14`, đã phê duyệt Gate 1)
  - [intent.md](intent.md) (`v1.0.0`), [spec.md](spec.md) (`v1.0.0`), [design.md](design.md) (`v1.0.0`), [ui-design-system.md](ui-design-system.md) (`v1.0.0`), [research/RL_PLAN.md](research/RL_PLAN.md) (`v1.0.0`)

### 2.2. Ranh giới Phạm vi và Tệp tin mục tiêu (`target_files`)
- **Trong phạm vi (In-scope):**
  - `ENV-01`: `docker-compose.yml`, `.github/workflows/ci.yml` (hoặc script kiểm tra CI cục bộ), `backend/pyproject.toml`, `backend/requirements.lock`, `frontend/package.json`, `frontend/package-lock.json`, `rl/pyproject.toml` (hoặc workspace chung), và các file test RED ban đầu trong `backend/tests/`, `frontend/src/__tests__/`, `rl/tests/`.
  - `RL-01`: `rl/plumora_rl/simulator.py`, `rl/plumora_rl/baselines.py`, `rl/plumora_rl/train.py`, `rl/plumora_rl/evaluate.py`, `rl/artifacts/` (`checkpoint.zip`, `manifest.json`, `evaluation_report.json`), `rl/tests/test_simulator_and_eval.py`.
  - `SLICE-01`: `backend/app/` (modules `auth`, `content`, `assessment`, `recommendation`, `db/migrations`, `seed/backend_12_concepts.json`), `frontend/src/` (`pages/AuthPage.tsx`, `pages/RoadmapDagView.tsx`, `pages/LessonReaderView.tsx`, `pages/QuizFeedbackView.tsx`, `components/`), `frontend/e2e/golden_journey.spec.ts`.
- **Ngoài phạm vi / Bị chặn (Out-of-scope & Blocked):**
  - Không làm màn hình Admin CRUD CMS (`D-05`).
  - Không làm Code auto-grader, Spaced Repetition, AI Tutor (Giai đoạn 2 — `B-04`).
  - Không làm Microservices/Kubernetes, Online RL, PPO/Actor-Critic, GNN (Giai đoạn 3 — `B-04`).
  - Không commit/push/merge/deploy lên môi trường ngoài khi chưa có phê duyệt Gate 4 (`G4`).

### 2.3. Điều kiện dừng (Stop Conditions) và Quản lý Rủi ro / Nợ kỹ thuật
- **Điều kiện dừng khẩn cấp (Stop Conditions):**
  1. Nếu `Student Simulator` hoặc `DQN` vi phạm bất biến `INV-RL-01` (lộ biến ẩn $\alpha$ vào Observation hoặc gán nhãn heuristic là `dqn`) $\rightarrow$ dừng ngay và sửa lại đúng hợp đồng `D-07`.
  2. Nếu `DQN (Unmasked)` không đạt `invalid_action_rate < 5%` sau khi huấn luyện trên 3 seeds $\rightarrow$ không ngụy tạo số liệu; kiểm tra lại lịch giảm `exploration_fraction` / `learning_rate` trong phạm vi `D-07`/`D-08` và báo cáo trung thực.
  3. Nếu dịch vụ `PostgreSQL` hoặc `Redis` trong Docker Compose không đạt trạng thái `healthy` ở `ENV-01` $\rightarrow$ không viết business logic trước khi sửa xong môi trường (Gate 2).
- **Chủ sở hữu quyết định & Đóng nợ kỹ thuật:** Chủ dự án (`Project Owner`) giữ quyền phê duyệt cuối cùng tại mỗi Gate (`G1` $\rightarrow$ `G4`).

## 3. Phân bổ khung 4–5 tuần đề xuất (`D-04`)

- **Tuần 1:** Đóng Gate 1 $\rightarrow$ Thiết lập `ENV-01` (Gate 2: Scaffold, Docker Compose PostgreSQL/Redis, CI, RED tests) $\rightarrow$ Hoàn thành `RL-01` (`Student Simulator`, Baselines `B1/B2/B3`, huấn luyện & đánh giá `DQN`, xuất gói artifact chuẩn).
- **Tuần 2:** Phát triển Backend cho `SLICE-01` (Migrations, Seed 12 khái niệm DAG + 3 tài khoản mẫu, Auth, Quiz ACID + Idempotency, Redis State Cache + Fallback, API tích hợp checkpoint `DQN`).
- **Tuần 3:** Phát triển Frontend React SPA cho `SLICE-01` (3 màn hình `Roadmap DAG View`, `Lesson Reader View`, `Quiz & Mastery Feedback View`, đủ 5 trạng thái UX, chuẩn `WCAG AA`) và kiểm thử tích hợp.
- **Tuần 4:** Kiểm thử E2E (`Playwright`), kiểm thử chịu lỗi (Adversarial/Fallback tests), thực hiện **Gate 3 Independent Review (`REVIEW-01`)** và xử lý triệt để mọi phát hiện.
- **Tuần 5:** Đóng gói `DEFENSE-01`, hoàn thiện quyển báo cáo đồ án, biểu đồ thực nghiệm RL, kịch bản Demo Local Docker Compose và slide bảo vệ.

## 4. Nguyên tắc thực thi

Mỗi lát cắt đi qua bốn pha Direwolf: phân tích/thiết kế (`G1`) $\rightarrow$ môi trường/triển khai TDD (`G2`) $\rightarrow$ review độc lập 4 trục (`G3`) $\rightarrow$ bàn giao/phát hành theo quyền (`G4`). Giai đoạn sản phẩm 2–3 trong brief tiếp tục deferred.
