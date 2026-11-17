# Verification Dossier: Independent Gate 3 Four-Axis Review (MVP Hardening)

- **Requirement reference & version:** Plumora Phase 1 MVP Baseline `v1.0.0` ([docs/decisions.md](../../docs/decisions.md) `D-01`–`D-15`, [docs/spec.md](../../docs/spec.md), [docs/design.md](../../docs/design.md), [docs/ui-design-system.md](../../docs/ui-design-system.md) `v1.2.0`).
- **Target Git branch & commit hash:** Branch `fix/mvp-quality-hardening`, Commit [`34d3736b333ee74199c1ac0b48e34b21f2342d8c`](file:///home/diepvanhieu/workspace/plumora).
- **Reviewer identity & audit scope:** Independent Adversarial Reviewer (Context-Isolated Session), Gate 3 Four-Axis Verification (UI/UX & A11y, Code Quality & Architecture, Security & Hardening, Database & Concurrency).
- **Test environment & dependencies:**
  - OS: Linux x86_64
  - Python: 3.12.16 (managed via Astral `uv`)
  - Node.js: v22.14.0 (managed via `npm` 10.9.2)
  - Database: PostgreSQL 16 Alpine (`127.0.0.1:5432`)
  - Cache: Redis 7 Alpine (`127.0.0.1:6379`)
  - Headless Browser: Chromium (Playwright v1.52.0)
- **Previous Review & Handoff References:**
  - Audit baseline: `/home/diepvanhieu/workspace/direwolf-agents/docs/reports/PLUMORA_HARDENING_REVIEW_2026-11-17.md`
  - Developer handoff: [`docs/verification/HANDOFF_MVP_QUALITY_HARDENING_FOLLOWUP.md`](HANDOFF_MVP_QUALITY_HARDENING_FOLLOWUP.md)
- **Selected Verification Tiers:**
  - Tier 1: Static Analysis, Linting, Formatting, and Type Checking (Backend Ruff & Mypy, RL Ruff & Mypy, Frontend ESLint & `tsc --noEmit`).
  - Tier 2: Unit & Behavioral Mock Tests (Pytest in Backend and RL, Vitest in Frontend).
  - Tier 3: Production Build & Live Fullstack Integration Tests (Vite build, live fullstack Golden Journey against live FastAPI, PostgreSQL, Redis, and DQN).
  - Tier 4: Real Headless Browser End-to-End Audit & Adversarial Negative Control Probing (Chromium E2E, viewport clipping, focus trap/restore, network abort resilience, negative-control injection).

---

## Bảng Tổng Hợp Kiểm Thử Tiêu Chí Nghiệm Thu (Criteria Verification Matrix)

| Tiêu Chí / AC-ID | Lệnh Kiểm Thử & Hành Vi Quan Sát Được | Kết Quả | Bằng Chứng / Ghi Nhận Thực Nghiệm |
| --- | --- | :---: | --- |
| **H1 / D-09 / PL-E2E-01** | `cd backend && uv run uvicorn app.main:app` & probe `/api/v1/health` & `cd frontend && npm run test:integration` | **PASS** | Backend phản hồi healthy sau 1s; Vitest live integration test hoàn tất Golden Journey (728ms, exit 0). |
| **H1 / Day-0 CI** | `./scripts/ci_check.sh` | **PASS** | 6/6 bước CI liên hoàn chạy thành công; tự động quản lý lifecycle uvicorn & vite preview với PID trap; exit code 0. |
| **H2 / D-06 / D-10** | `cd backend && uv run pytest -k "test_h2 or test_f4"` | **PASS** | 6/6 tests passed: test upgrade schema từ DB cũ, legacy attempt trả về `null` (không bịa version 1), lỗi migration bắn `RuntimeError`, replay giữ nguyên version, cross-concept reuse trả 409, 5 luồng PostgreSQL tuần tự hóa. |
| **H3 / F3 / Security** | `cd backend && uv run pytest -k "test_h3 or test_f3"` | **PASS** | 3/3 tests passed: `.env.local` ghi đè `.env`, process env ghi đè tất cả; khi `APP_ENV=production`, hệ thống từ chối khởi động nếu thiếu secret hoặc secret < 32 ký tự; không sinh ephemeral secret trong production. |
| **H4 / D-07 / UI** | `cd frontend && npm run test:unit -t "H4"` | **PASS** | Banner fallback hiển thị `KHUYẾN NGHỊ THEO QUY TẮC ĐỒ THỊ (TOPO FALLBACK)` và `Quy tắc thứ tự Topo`, không chứa từ khóa DQN hoặc "tối ưu nhất"; `LessonReader` hiển thị `KHÁI NIỆM TRONG LỘ TRÌNH HỌC`. |
| **H5 / F6 / Audit** | `node scripts/audit_mvp_hardening.cjs` | **PASS** | 15/15 checks đạt `allChecksPassed: true`, `errors: []`, dynamic path resolution không phụ thuộc máy cục bộ; exit code 0. |
| **H5 / Negative Control** | `node scripts/audit_mvp_hardening.cjs --negative-control` | **PASS** | Nhãn fallback bị inject chuỗi lừa đảo khiến assertion `fallbackLabelValid` thất bại; script trả về exit code **1**. |
| **H6 / D-13 / A11y** | Đo lường Chromium headless tại viewport 390x844 & Vitest `quality_hardening.test.tsx` | **PASS** | `scrollWidth = 390px` (0px horizontal overflow), `clippedCount = 0`; focus tự động vào modal/drawer khi mở, khóa Tab loop, Escape đóng và phục hồi focus về trigger element; badge unverified WCAG 2.1 AA đã gỡ khỏi README. |
| **H7 / rl-evidence** | `cd rl && uv run pytest` & kiểm tra văn bản `docs/defense/RL_EXPERIMENTAL_REPORT.md` | **PASS** | 9/9 RL tests passed; báo cáo thực nghiệm cập nhật trạng thái `Gate 3: In Review`, chuẩn hóa công thức simulator, giới hạn kết luận trong 500 episodes đánh giá, ghi rõ giới hạn môi trường giả lập đối với người thật. |

---

## 1. Kết Quả Thẩm Định Chi Tiết 7 Phát Hiện H1–H7 (Audit Findings Evaluation)

### H1: CI Workflow, Test Layering & Real Browser E2E
- **Mức độ nghiêm trọng trước sửa:** Cao (High).
- **Phân loại:** Test Defect & Environment Issue.
- **Thực trạng phát hiện trước đây:** File `.github/workflows/ci.yml` thiếu trigger `fix/**`, bước chạy frontend suite không khởi động backend uvicorn; `live_fullstack_journey.spec.ts` bị phụ thuộc cổng 8000 của máy dev; CI thiếu bước audit browser thật.
- **Biện pháp khắc phục đã xác minh tại commit `34d3736`:**
  1. File `.github/workflows/ci.yml` được bổ sung trigger `fix/**`.
  2. Phân tầng kiểm thử thành 4 cấp rõ ràng: (1) Unit & mock behavioral, (2) Khởi động uvicorn backend nền với vòng lặp thăm dò `/api/v1/health` (timeout 30s fail-fast), (3) Live fullstack test qua TCP thật trên port 8000, (4) Khởi động frontend preview (port 3000) và thực thi audit Chromium E2E headless thật kèm bước kiểm tra negative control.
  3. File `scripts/ci_check.sh` tích hợp hàm `cleanup()` bắt tín hiệu `EXIT` để thu dọn tiến trình backend/frontend nền, cho phép chạy độc lập trong runner sạch mà không cần tiến trình có sẵn.
- **Kết quả thẩm định độc lập:** Đạt (**CLOSED**). Chạy thực tế `./scripts/ci_check.sh` hoàn tất 6/6 bước, exit code 0.

### H2: Schema Migrations, Cột Nullable & Idempotent Replay Lịch Sử
- **Mức độ nghiêm trọng trước sửa:** Trung bình (Medium).
- **Phân loại:** Database & Data Integrity Defect.
- **Thực trạng phát hiện trước đây:** Cột `state_version` và `newly_unlocked_json` được tạo trong `seed_loader.py` bằng câu lệnh thô kèm `DEFAULT 1` và `DEFAULT '[]'::jsonb`; khi phát lại bài nộp cũ (legacy attempts) hệ thống trả về version 1 giả mạo; thiếu bảng kiểm soát migration có phiên bản; bắt `SQLAlchemyError` nhưng nuốt lỗi.
- **Biện pháp khắc phục đã xác minh tại commit `34d3736`:**
  1. Xây dựng module migration độc lập `backend/app/db/migrations.py` quản lý bảng `schema_migrations`, thực thi tuần tự các migration: `0001_initial_schema`, `0002_add_quiz_attempt_state_version_and_unlocked`, `0003_drop_legacy_attempt_defaults`.
  2. Xóa bỏ hoàn toàn giá trị `DEFAULT 1` và `DEFAULT '[]'`. Định nghĩa model `QuizAttemptModel.state_version` và `newly_unlocked_json` là `nullable=True, default=None`.
  3. Đơn vị công việc `execute_quiz_attempt_uow` trong `backend/app/modules/assessment/unit_of_work.py` khi phát lại bài nộp legacy sẽ bảo lưu trung thực `state_version: null` và `newly_unlocked_slugs: null`.
  4. Cơ chế chống trùng lặp chéo: Khi một `submission_id` đã dùng cho khái niệm này mà bị nộp cho khái niệm khác, hệ thống lập tức từ chối và trả về mã lỗi `409 Conflict` (`SUBMISSION_ID_REUSED_ACROSS_CONCEPTS`).
  5. Đã viết test `test_h2_schema_migration_upgrade_from_pre_hardening_schema` kiểm tra nâng cấp DB từ schema cũ không có cột, và `test_h2_legacy_attempt_replay_returns_null_and_no_fake_version`.
- **Kết quả thẩm định độc lập:** Đạt (**CLOSED**). Toàn bộ 6 tests cơ sở dữ liệu và đồng thời chạy thành công.

### H3: Cấu Hình Dotenv Precedence & Production Secret Resolution
- **Mức độ nghiêm trọng trước sửa:** Trung bình (Medium).
- **Phân loại:** Security & Configuration Defect.
- **Thực trạng phát hiện trước đây:** `config.py` đọc `os.getenv` trực tiếp trước khi khởi tạo `Settings`; sai thứ tự nạp file khiến `.env` ghi đè `.env.local`; khi `APP_ENV=production` trong `.env` nhưng biến môi trường process env chưa đặt, resolver âm thầm sinh ephemeral dev secret mà không chặn khởi động.
- **Biện pháp khắc phục đã xác minh tại commit `34d3736`:**
  1. Cấu hình pydantic-settings: `model_config = SettingsConfigDict(env_file=(".env", "../.env", ".env.local", "../.env.local"), extra="ignore")`. Đảm bảo thứ tự ưu tiên chuẩn xác: `process environment > .env.local > .env`.
  2. Đưa `jwt_secret_key` thành trường dữ liệu trực thuộc `Settings`.
  3. Hàm `resolve_jwt_secret(app_settings: Settings | None = None)` nhận đối tượng `Settings` làm nguồn chân lý duy nhất. Trong môi trường `production`, nếu secret chưa được cấu hình hoặc có độ dài $< 32$ ký tự, hàm lập tức ném ngoại lệ `RuntimeError`. Tuyệt đối cấm sinh ephemeral key khi `app_env == "production"`.
  4. Đã bổ sung 2 bài test kiểm chứng: `test_h3_settings_receives_production_from_dotenv_without_os_getenv_app_env` và `test_h3_env_local_overrides_env_base_and_process_env_overrides_all`.
- **Kết quả thẩm định độc lập:** Đạt (**CLOSED**). Cấu hình bảo mật hoạt động nhất quán, fail-secure chuẩn xác.

### H4: Nhãn Khuyến Nghị Trung Thực (Truthful Labeling)
- **Mức độ nghiêm trọng trước sửa:** Trung bình (Medium).
- **Phân loại:** UI/UX Integrity & Truthful AI Defect.
- **Thực trạng phát hiện trước đây:** Banner AI luôn mang nhãn `DQN POLICY` và tuyên bố "tối ưu nhất" kể cả khi chính sách là `fallback_rule` hoặc `degraded: true`; `LessonReader.tsx` hardcode nhãn `AI ĐỀ XUẤT TIẾP THEO (DQN POLICY)`; rò rỉ chuỗi kỹ thuật tiếng Anh trong UI.
- **Biện pháp khắc phục đã xác minh tại commit `34d3736`:**
  1. `AiRecommendationBanner.tsx` phân nhánh hiển thị chính xác theo `policy_source`:
     - `fallback_rule`: Hiển thị `KHUYẾN NGHỊ THEO QUY TẮC ĐỒ THỊ (TOPO FALLBACK)`, mô hình hiển thị `Quy tắc thứ tự Topo`.
     - `dqn_masked_q`: Hiển thị `KHUYẾN NGHỊ TỪ MÔ HÌNH DQN (MASKED Q)`.
     - `dqn`: Hiển thị `KHUYẾN NGHỊ TỪ MÔ HÌNH HỌC TĂNG CƯỜNG (DQN POLICY)`.
     - Khi `degraded: true`: Hiển thị thêm badge `Chế độ dự phòng`.
     - Thay thế toàn bộ cụm từ "tối ưu nhất" bằng "khái niệm phù hợp".
  2. Khi hoàn tất 12/12 bài, banner thông báo: "Hệ thống xác nhận trạng thái hoàn tất lộ trình" (không còn gán ghép DQN).
  3. `LessonReader.tsx` gỡ bỏ nhãn hardcode DQN, thay bằng nhãn trung lập: `KHÁI NIỆM TRONG LỘ TRÌNH HỌC`.
  4. `ProvenanceDrawer.tsx` hiển thị trạng thái `degraded` màu đỏ và diễn giải nguồn chính sách bằng tiếng Việt chuẩn mực.
  5. `QuizResultCard.tsx` hiển thị nhãn trung thực khi phát lại bài nộp cũ: `Phát lại bài nộp cũ (Bảo lưu nguyên trạng)`.
- **Kết quả thẩm định độc lập:** Đạt (**CLOSED**). Test Vitest H4 và audit Chromium headless xác nhận toàn bộ nhãn trung thực, không còn hiện tượng rò rỉ kỹ thuật hoặc phóng đại AI.

### H5: Độ Tin Cậy Của Audit Script & Negative Control
- **Mức độ nghiêm trọng trước sửa:** Trung bình (Medium).
- **Phân loại:** Test Harness Defect.
- **Thực trạng phát hiện trước đây:** `scripts/audit_mvp_hardening.cjs` tính biến `allChecksPassed` nhưng giá trị `false` không làm script trả exit code 1; cờ negative control bị giả lập bằng một nhánh boolean tĩnh không thông qua kiểm tra logic thật; hardcode đường dẫn tuyệt đối `/home/diepvanhieu`.
- **Biện pháp khắc phục đã xác minh tại commit `34d3736`:**
  1. Dynamic Resolution: Hàm `resolvePlaywright()` và `resolveChromiumExecutable()` tìm kiếm Playwright và Chromium động qua biến môi trường (`CHROME_PATH`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`), các đường dẫn hệ thống Linux chuẩn (`/usr/bin/google-chrome`, `/usr/bin/chromium`), và thư mục cache người dùng hiện tại (`os.homedir()`).
  2. Strict Exit Code: Nếu `!out.allChecksPassed || out.errors.length > 0`, script gán `process.exitCode = 1`.
  3. Genuine Negative Control: Khi chạy với `--negative-control`, script can thiệp vào dữ liệu phản hồi giả lập, chèn chuỗi cấm `CSDL Quan hệ (DQN POLICY: Khuyến nghị tối ưu nhất)`. Khi giao diện render chuỗi này, assertion `fallbackLabelValid` bắt được vi phạm từ khóa và trả về `false`, kích hoạt `allChecksPassed = false` và kết thúc với exit code 1.
  4. Quản lý Artifacts: Script tự động xuất dữ liệu kết quả JSON và ảnh chụp màn hình vào thư mục được quản lý `docs/verification/artifacts/`.
- **Kết quả thẩm định độc lập:** Đạt (**CLOSED**). Kiểm chứng chạy audit bình thường trả exit code 0 (`allChecksPassed: true`); chạy với `--negative-control` trả về exit code 1 do vi phạm assertion thật.

### H6: Mobile Responsiveness & WAI-ARIA Focus Management
- **Mức độ nghiêm trọng trước sửa:** Trung bình (Medium).
- **Phân loại:** UI/UX & Accessibility Defect.
- **Thực trạng phát hiện trước đây:** Màn hình mobile 390px xuất hiện chip checkpoint bị tràn mép phải `right ≈ 502px`; mở modal/drawer không chuyển focus vào bên trong dialog; thiếu focus trap khóa phím Tab; đóng dialog không trả lại focus cho nút kích hoạt; README chứa badge unverified `WCAG 2.1 AA`.
- **Biện pháp khắc phục đã xác minh tại commit `34d3736`:**
  1. Mobile Responsiveness: Rút gọn chip checkpoint hiển thị 12 ký tự hash kèm tooltip (`max-w-[180px] sm:max-w-xs truncate`); cô lập hiệu ứng radial blur trong container riêng có `overflow-hidden`. Đo lường bằng Chromium tại viewport 390px cho thấy `scrollWidth = 390px` (không có horizontal scrollbar), `clippedCount = 0` (không có phần tử bị cắt cụt).
  2. WAI-ARIA Focus Trap & Restore: Cài đặt hook chuẩn `frontend/src/utils/useFocusTrap.ts`:
     - Tự động lưu `document.activeElement` trước khi mở dialog.
     - Tự động chuyển focus vào phần tử có thể tương tác đầu tiên bên trong dialog (`drawerInitialFocusInside: true`, `modalInitialFocusInside: true`).
     - Bắt sự kiện bàn phím Tab / Shift+Tab để khóa vòng lặp tiêu điểm bên trong dialog (`modalTabTrapped: true`).
     - Bắt phím Escape để đóng dialog.
     - Tự động phục hồi focus về chính nút bấm đã mở dialog khi đóng (`drawerFocusRestored: true`, `modalFocusRestored: true`).
     - Sử dụng `onEscapeRef` để tránh hiện tượng re-attach listener gây giật tiêu điểm khi component cha re-render.
  3. Gỡ bỏ badge `WCAG 2.1 AA` chưa qua kiểm định đầy đủ khỏi `README.md`, thay bằng badge chuẩn xác: `Accessibility: Keyboard Accessible`.
- **Kết quả thẩm định độc lập:** Đạt (**CLOSED**). Đã kiểm chứng qua cả bài test Vitest chuyên biệt và probe Chromium headless thực tế.

### H7: Chuẩn Hóa Báo Cáo Thực Nghiệm RL (RL Evidence Calibration)
- **Mức độ nghiêm trọng trước sửa:** Thấp/Trung bình (Low/Medium).
- **Phân loại:** Documentation & Scientific Evidence Defect.
- **Thực trạng phát hiện trước đây:** File `docs/defense/RL_EXPERIMENTAL_REPORT.md` tự ghi `Gate 3 APPROVED`; suy rộng kết luận Q-value âm trên mọi trạng thái; tuyên bố thuật toán DQN hội tụ toán học và tiệm cận tối ưu toàn cục mà không có cơ sở lý thuyết chứng minh trên tập mẫu 500 episodes.
- **Biện pháp khắc phục đã xác minh tại commit `34d3736`:**
  1. Dòng 5: Cập nhật trạng thái thành `Gate 3: In Review`.
  2. Bổ sung công thức đầy đủ và chính xác của `StudentSimulatorEnv` gồm `base_competence`, `tier_difficulty`, và `cognitive_load_penalty`.
  3. Mục 7.1: Giới hạn nhận định Q-value âm cho các bài học bị khóa trong phạm vi phân phối và tập mẫu 500 episodes thử nghiệm (`eval_seed = 2026`).
  4. Mục 7.2: Loại bỏ giá trị $p < 0.01$ không có bằng chứng tính toán; nêu rõ mức cải thiện $\Delta = +0.7190$ điểm thưởng và giảm $6.9\%$ số bước so với $B_2$.
  5. Mục 7.3: Nêu rõ DQN đạt số bước tương đương thuật toán chuyên gia tham lam $B_3$ ($17.88$ so với $17.86$) trên không gian 12 khái niệm mô phỏng thay vì khẳng định "hội tụ toán học".
  6. Mục 8.1: Nhấn mạnh trung thực kết quả mô phỏng trong `Gymnasium` không đại diện cho bằng chứng lâm sàng về hiệu quả học tập trên người thật.
- **Kết quả thẩm định độc lập:** Đạt (**CLOSED**). Báo cáo khoa học tuân thủ nghiêm ngặt quy tắc [rl-evidence.md](../../.agents/rules/rl-evidence.md).

---

## 2. Đánh Giá Độc Lập Theo 4 Trục Kỹ Thuật (Four-Axis Assessment)

### Trục 1: UI/UX & Khả Năng Tiếp Cận (Accessibility)
- **Khả năng đáp ứng đa màn hình (Responsiveness):** Kiểm tra thực nghiệm trên trình duyệt Chromium headless ở viewport 390x844px (chuẩn iPhone 12/13/14) ghi nhận `scrollWidth: 390px`, `offsetWidth: 390px`. Toàn trang không có hiện tượng vỡ khung, tràn ngang, hoặc thanh cuộn ngang ngoài ý muốn. Không có phần tử văn bản hoặc nút tương tác nào bị cắt mép (`clippedCount = 0`).
- **5 Trạng thái UX (UX States):**
  - *Ideal State:* Bản đồ 12 node hiển thị trực quan theo 4 tầng DAG; banner AI hiển thị rõ ràng, nút CTA kích hoạt bài học mượt mà.
  - *Empty State:* Học viên mới vào có hiển thị `0 / 12 khái niệm (0%)`, không hiển thị tiến độ ảo.
  - *Loading State:* Spinner tải dữ liệu sạch sẽ, không có văn bản khẳng định mô hình "tối ưu".
  - *Error State:* Khi ngắt kết nối API `/roadmap` và `/recommendations`, giao diện hiển thị khung lỗi rõ ràng kèm nút "Thử lại" (`retry-roadmap-btn`), không bị crash ứng dụng và không giả lập dữ liệu ảo.
  - *Disabled State:* Các node bài học chưa mở khóa hiển thị biểu tượng ổ khóa, nền xám mờ, con trỏ `not-allowed`, và thông báo yêu cầu hoàn thành các bài tiên quyết.
- **WAI-ARIA & Phím điều hướng:** Cả Modal Hồ sơ Mẫu và Ngăn kéo Bằng chứng RL đều tuân thủ chặt chẽ tiêu chuẩn WAI-ARIA: bẫy phím Tab/Shift+Tab, đóng bằng phím Escape, tự động phục hồi tiêu điểm về nút kích hoạt.
- **Đánh giá Trục 1:** **ĐẠT (PASS)**.

### Trục 2: Chất Lượng Mã Nguồn & Kiến Trúc Phần Mềm (Code Quality & Architecture)
- **Kiến trúc Modular Monolith:** Backend chia tách rõ ràng thành các module độc lập (`auth`, `content`, `assessment`, `recommendation`) với ranh giới trách nhiệm mạch lạc. Frontend chia tách rõ components, hooks, utils và constants.
- **Tuân thủ Kiểm tra Tĩnh (Static Analysis):**
  - Backend Ruff: `All checks passed!` (0 lỗi, 0 cảnh báo).
  - Backend Mypy: `Success: no issues found in 34 source files` (Strict mode).
  - RL Ruff: `All checks passed!` (0 lỗi, 0 cảnh báo).
  - RL Mypy: `Success: no issues found in 9 source files`.
  - Frontend ESLint: `0 errors, 0 warnings`.
  - Frontend TypeScript (`tsc --noEmit`): Đạt 0 lỗi biên dịch.
  - Frontend Production Build (`npm run build`): Đóng gói Vite hoàn tất thành công trong 1.78s (dist: 330 kB JS gzip 93 kB, 36 kB CSS gzip 7.5 kB).
- **Phân tầng kiểm thử:** Kết hợp chặt chẽ giữa unit test, behavioral mock test, live fullstack integration test và E2E browser audit.
- **Đánh giá Trục 2:** **ĐẠT (PASS)**.

### Trục 3: An Toàn Thông Tin & Phòng Thủ Chiều Sâu (Security & Hardening)
- **Chống IDOR & Xác thực:** Toàn bộ API truy xuất tiến độ, nộp bài kiểm tra và lấy khuyến nghị đều trích xuất danh tính người dùng trực tiếp từ JWT Token đã được xác thực mã hóa HS256 (`test_pl_auth_01_anti_idor_session_isolation`). Mọi truy vấn không có token đều bị chặn bởi mã lỗi `401 Unauthorized`.
- **Quản lý Khóa Bí Mật & Fail-Secure:**
  - Thứ tự ưu tiên cấu hình `process environment > .env.local > .env` đã được chứng minh qua test.
  - Khởi động ở môi trường `production` bắt buộc phải có `JWT_SECRET_KEY` với độ dài $\ge 32$ ký tự, nếu vi phạm sẽ chặn đứng khởi động ứng dụng ngay lập tức.
  - Tuyệt đối không sinh ephemeral secret khi `APP_ENV=production`.
- **Bảo mật Hạ tầng & Header HTTP:**
  - Tất cả phản hồi HTTP đều đính kèm đầy đủ security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy`.
  - Docker Compose liên kết PostgreSQL và Redis nghiêm ngặt tại `127.0.0.1`, không phơi bày cổng ra Internet công cộng.
  - Mật khẩu lưu trữ bằng thuật toán băm Argon2id có salt ngẫu nhiên.
- **Đánh giá Trục 3:** **ĐẠT (PASS)**.

### Trục 4: Cơ Sở Dữ Liệu & Xử Lý Đồng Thời (Database & Concurrency)
- **Đồng bộ Đơn Vị Công Việc (Unit of Work Serialization):** Hàm `execute_quiz_attempt_uow` áp dụng cơ chế khóa bi quan (Pessimistic Row Lock) bằng câu lệnh `SELECT ... FOR UPDATE` trên bảng `users`. Test thực tế với 5 luồng đồng thời trên PostgreSQL 16 thật chứng minh các yêu cầu cập nhật tiến độ được tuần tự hóa an toàn, không xảy ra xung đột dữ liệu (Race Condition).
- **Quản lý Phiên Bản Schema (Schema Migrations):**
  - Hệ thống sở hữu bảng theo dõi `schema_migrations`.
  - Hỗ trợ tương thích đa phương ngữ (PostgreSQL & SQLite in-memory cho test suite).
  - Không sử dụng các giá trị fake defaults (`DEFAULT 1` hoặc `DEFAULT '[]'`).
  - Mọi lỗi thực thi migration đều ném ra ngoại lệ `RuntimeError`, không bao giờ nuốt lỗi.
- **Tính Bất Biến & Phát Lại Bền Vững (Idempotency & Replay Integrity):**
  - Phát lại một bài nộp hợp lệ bảo lưu nguyên trạng `state_version` và `newly_unlocked_slugs` tại thời điểm nộp bài ban đầu, ngay cả sau khi người học đã thực hiện các bài học xen kẽ khác (thao tác xen kẽ A $\rightarrow$ B $\rightarrow$ Replay A).
  - Phát lại bài nộp legacy (trước khi có versioning) trả về đúng `null`, không bịa đặt lịch sử.
  - Tái sử dụng `submission_id` của khái niệm này cho khái niệm khác bị từ chối với mã lỗi `409 Conflict`.
- **Đệm Dữ Liệu & Fallback Khả Dụng Cao:** Redis cache vector trạng thái 24 chiều với TTL 3600s. Khi Redis gặp sự cố, hệ thống tự động fallback đọc từ PostgreSQL (`state_source = "postgres_fallback"`) mà không làm gián đoạn người dùng.
- **Đánh giá Trục 4:** **ĐẠT (PASS)**.

---

## 3. Bằng Chứng Thực Nghiệm Trực Quan (Empirical Artifacts)

Toàn bộ artifacts thẩm định đã được tạo lập độc lập và lưu trữ có kiểm soát trong repository:
1. [`docs/verification/artifacts/audit_mvp_hardening_results.json`](artifacts/audit_mvp_hardening_results.json): Bản ghi JSON đầy đủ 15 assertions thực nghiệm từ Chromium headless thật, xác nhận `allChecksPassed: true`, `errors: []`.
2. [`docs/verification/artifacts/audit_mobile_probe.png`](artifacts/audit_mobile_probe.png): Ảnh chụp toàn trang giao diện tại màn hình mobile 390px, chứng minh không có clipping và không có hiện tượng tràn khung ngang.
3. [`docs/verification/artifacts/audit_fallback_probe.png`](artifacts/audit_fallback_probe.png): Ảnh chụp thực tế của banner khuyến nghị khi chạy ở chế độ `fallback_rule` và `degraded: true`, chứng minh nhãn trung thực "KHUYẾN NGHỊ THEO QUY TẮC ĐỒ THỊ (TOPO FALLBACK)" và hoàn toàn vắng bóng từ khóa DQN / "tối ưu nhất".

---

## 4. Kết Luận Đợt Thẩm Định Gate 3 (Gate 3 Sign-Off)

- **Trạng thái thẩm định Gate 3:** **APPROVED** (CHẤP THUẬN NGHIỆM THU GATE 3).
- **Cơ sở phê duyệt:**
  1. Toàn bộ 7 phát hiện H1–H7 từ đợt đánh giá độc lập trước đã được khắc phục hoàn toàn, triệt để và minh bạch bằng mã nguồn thực tế.
  2. Toàn bộ 4 trục kỹ thuật (UI/UX & A11y, Code Quality & Architecture, Security & Hardening, Database & Concurrency) đều đạt kết quả PASS tuyệt đối.
  3. Tất cả các bộ kiểm thử tự động (Backend 24 tests, RL 9 tests, Frontend 15 unit tests + 1 integration test, Chromium E2E Audit 15 checks, Negative Control exit code 1) đều đạt 100% tỷ lệ vượt qua.
  4. Script `./scripts/ci_check.sh` chạy thông suốt cả 6 bước trong môi trường chuẩn.
  5. Không có lỗi biên dịch TypeScript, không có cảnh báo ESLint, không có lỗi Mypy/Ruff.
- **Phạm vi quyền hạn tiếp theo:** Báo cáo thẩm định này xác nhận hoàn tất Gate 3 về mặt kỹ thuật độc lập. Theo quy tắc Gate 4, **quyền quyết định merge vào nhánh chính (`main`) hoặc đẩy lên remote GitHub Actions thuộc về chủ dự án Plumora**. Người thực hiện review không tự ý push hoặc merge khi chưa có lệnh chỉ đạo cụ thể.
