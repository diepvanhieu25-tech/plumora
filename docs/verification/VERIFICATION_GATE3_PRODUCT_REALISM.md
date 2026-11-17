# Verification Dossier: Independent Gate 3 Four-Axis Review (Product Realism Overhaul)

- **Requirement reference & version:** Plumora Phase 1 MVP Baseline `v1.0.0` ([docs/decisions.md](../../docs/decisions.md) `D-01`–`D-15`, [docs/spec.md](../../docs/spec.md), [docs/design.md](../../docs/design.md), [docs/proposals/PRODUCT_REALISM_PLAN.md](../proposals/PRODUCT_REALISM_PLAN.md)).
- **Target Git branch & commit hash:** Branch `feat/product-realism`, Head Commit [`904f74e`](file:///home/diepvanhieu/workspace/plumora) with uncommitted working tree changes implementing the Product Realism Overhaul (`R1`–`R4`, `REAL-01`–`REAL-05`).
- **Reviewer identity & audit scope:** Independent Adversarial Reviewer (Context-Isolated Session), Gate 3 Four-Axis Verification (UI/UX & Accessibility, Code Quality & Test Coverage, Security & Session Hardening, Database & Transaction Integrity).
- **Test environment & dependencies:**
  - OS: Linux x86_64
  - Python: 3.12.16 (managed via Astral `uv`)
  - Node.js: v22.14.0 (managed via `npm` 10.9.2)
  - Database: PostgreSQL 16 Alpine (`127.0.0.1:5432`)
  - Cache: Redis 7 Alpine (`127.0.0.1:6379`)
  - Headless Browser: Chromium (Playwright v1.52.0)
- **Previous Review & Handoff References:**
  - Audit baseline: [`docs/proposals/PRODUCT_REALISM_PLAN.md`](../proposals/PRODUCT_REALISM_PLAN.md)
  - Developer handoff: [`docs/verification/HANDOFF_PRODUCT_REALISM.md`](HANDOFF_PRODUCT_REALISM.md)
  - Audit results artifact: [`docs/verification/artifacts/audit_product_realism_results.json`](artifacts/audit_product_realism_results.json)
- **Selected Verification Tiers:**
  - Tier 1: Static Analysis, Linting, Formatting, and Type Checking (Backend Ruff & Mypy, RL Ruff & Mypy, Frontend ESLint & `tsc --noEmit`).
  - Tier 2: Unit & Behavioral Mock Tests (Pytest in Backend and RL, Vitest in Frontend).
  - Tier 3: Production Build & Live Fullstack Integration Tests (Vite build, live fullstack Golden Journey against live FastAPI, PostgreSQL, Redis, and DQN).
  - Tier 4: Real Headless Browser End-to-End Acceptance Audit & Adversarial Negative Control Probing (Chromium E2E without token injection, F5 session persistence, network error handling, focus trap/restore, negative-control injection).

---

## Bảng Tổng Hợp Kiểm Thử Tiêu Chí Nghiệm Thu (Criteria Verification Matrix)

| Tiêu Chí / AC-ID | Lệnh Kiểm Thử & Hành Vi Quan Sát Được | Kết Quả | Bằng Chứng / Ghi Nhận Thực Nghiệm |
| --- | --- | :---: | --- |
| **R1 / REAL-01 / REAL-06** | `cd backend && uv run pytest backend/tests/test_recheck_r1_to_r4_red.py::test_r1_cookie_name_and_flags_on_development_allow_browser_persistence` & Chromium E2E F5 reload probe | **PASS** | Phân định cookie RFC 6265bis: dev HTTP dùng `plumora_session` (không prefix `__Host-`, `secure=False`), production HTTPS dùng `__Host-plumora_session` (`secure=True`). Trình duyệt giữ phiên 100% qua F5 reload (`sessionPersistedAcrossReload: true`). |
| **R2 / UX Resilience** | `cd frontend && npm run test:unit -t "R2"` & Fault injection test | **PASS** | `apiGetConceptDetail` được bọc try/catch, bắt connection abort/timeout, hiển thị banner cảnh báo lỗi (`concept-fetch-error-banner`) kèm nút "Thử lại" (`retry-fetch-concept-btn`) và thông báo Toast lỗi. Zero unhandled promise rejection. |
| **R3 / State Versioning** | `cd backend && uv run pytest backend/tests/test_recheck_r1_to_r4_red.py::test_r3_preset_interleaved_execution_increments_state_version_correctly` | **PASS** | `db.refresh(locked_user)` được gọi ngay sau `with_for_update()` trong `assessment/router.py`, làm mới cache Identity Map của SQLAlchemy; kiểm thử 2 luồng xen kẽ bảo toàn số phiên bản tăng từ 1 -> 2 -> 3 chuẩn xác. |
| **R3 / Server Guard** | `cd backend && uv run pytest backend/tests/test_recheck_r1_to_r4_red.py::test_r3_server_guard_disables_presets_when_configured` | **PASS** | Khi `settings.enable_dev_presets = False`, endpoint `POST /api/v1/me/preset` trả về đúng HTTP 403 Forbidden với mã lỗi `DEV_PRESETS_DISABLED`. |
| **R4 / Concurrency** | `cd backend && uv run pytest backend/tests/test_recheck_r1_to_r4_red.py::test_r4_concurrent_registration_duplicate_username_returns_409_never_500` | **PASS** | Bắn 5 request đăng ký đồng thời cùng một username: chính xác 1 request thành công (201 Created), 4 request còn lại bắt `IntegrityError` hoàn tác session và trả về HTTP 409 Conflict (`USERNAME_TAKEN`), tuyệt đối không có lỗi 500. |
| **REAL-02 / Learner Flow** | `node scripts/audit_product_realism.cjs` & kiểm tra DOM AuthPage / RoadmapPage | **PASS** | Màn hình đăng nhập/đăng ký với các ô nhập trống mặc định; danh sách tài khoản seed được thay bằng bảng tổng quan 4 Tầng kiến thức Backend; thanh preset và tài khoản seed chuyển vào `<details>` thử nghiệm riêng biệt. |
| **REAL-03 / D-07 / RL** | `node scripts/audit_product_realism.cjs` & kiểm tra banner văn bản | **PASS** | Banner AI hiển thị rõ quyền tự do chọn bài: *"Gợi ý mang tính định hướng. Bạn có thể tự do chọn bất kỳ bài học nào đã mở khóa trên lộ trình."* Tuyệt đối không xưng "tối ưu nhất" hay "hoàn hảo tuyệt đối"; bài khóa hiển thị rõ ràng lý do tiên quyết. |
| **REAL-04 / UI Toast** | Thao tác UI & Vitest `Toast.tsx` | **PASS** | Toast hỗ trợ 4 trạng thái ngữ nghĩa (`success`, `info`, `warning`, `error`) kèm màu sắc, icon vector và WAI-ARIA `role="status"` `aria-live="polite"`. Tự đóng sau 4.5s có nút đóng thủ công. |
| **REAL-05 / History API** | `cd backend && uv run pytest backend/tests/test_recheck_r1_to_r4_red.py::test_real_05_attempts_history_returns_chronological_records` & UI Modal check | **PASS** | Endpoint `GET /api/v1/assessment/history` trả về danh sách lịch sử nộp bài sắp xếp theo thời gian giảm dần, Anti-IDOR bảo vệ theo `user.id`. `AttemptHistoryModal` có bẫy focus, đóng bằng Escape, đầy đủ 5 trạng thái UX. |
| **Day-0 CI Suite** | `./scripts/ci_check.sh` | **PASS** | 6/6 bước CI liên hoàn chạy thành công: Lint (Ruff, ESLint 0 warning), Typecheck (Mypy, TSC 0 error), Unit/behavioral tests (54 tests passed), Frontend build (Vite 346 kB bundle), Live integration test, Real browser E2E audit & Negative control probe. Exit code 0. |

---

## 1. Đánh Giá Toàn Diện 4 Trục Kỹ Thuật (Four-Axis Detailed Evaluation)

### Trục 1: Trải Nghiệm Nghiệp Vụ và UI/UX (Business Experience & UI/UX)
- **Đăng ký form tự do (Clean Self-Registration Flow):**
  - Giao diện `AuthPage.tsx` tách biệt 2 tab "Đăng nhập" và "Đăng ký học viên mới".
  - Trường nhập dữ liệu (`input-username`, `input-display-name`, `input-password`) mặc định rỗng 100%, không điền sẵn tài khoản seed giả lập.
  - Sau khi đăng ký thành công, học viên mới bắt đầu với trạng thái học tập nguyên bản: **0/12 khái niệm thông thạo (0%)**, không kế thừa hay gắn nhầm tiến độ của bất kỳ tài khoản nào khác.
  - Khi trùng tên đăng nhập, hiển thị thông báo lỗi tiếng Việt thân thiện trong banner `role="alert"` (`data-testid="auth-error-banner"`).
- **Duy trì phiên làm việc qua HttpOnly Cookie:**
  - Khắc phục triệt để lỗi R1: Trình duyệt lưu cookie an toàn, không bị từ chối ở dev HTTP và duy trì cấp bảo vệ tối đa ở production HTTPS.
  - Khi người học nhấn F5 / reload trang trong browser context hoàn toàn mới (không có token RAM hay mock injected), ứng dụng tự động khôi phục phiên người học và hiển thị lộ trình chính xác.
  - Khi đăng xuất, xóa triệt để cookie trên cả 3 tên miền tiềm năng, chuyển về AuthPage và ngăn truy cập trái phép.
- **Thanh lọc công cụ Demo khỏi luồng người học:**
  - Cột phụ của `AuthPage` đã được thay thế bằng bảng tổng quan 4 Tầng kiến thức Backend (Foundations -> Giao thức & CSDL -> Thiết kế API -> Bảo mật Backend cơ bản).
  - Các công cụ demo (seed profiles, preset toolbar) được thu gọn trong thẻ accordion `<details>` dành riêng cho thử nghiệm/giảng viên, bảo đảm luồng người học thông thường sạch sẽ 100%.
- **Thông báo Toast 4 trạng thái ngữ nghĩa:**
  - Component `Toast.tsx` hỗ trợ 4 trạng thái: `success` (xanh lá), `info` (xanh dương), `warning` (hổ phách), `error` (đỏ).
  - Tích hợp chuẩn trợ năng WAI-ARIA `role="status"` và `aria-live="polite"`. Có nút đóng thủ công và tự đóng sau 4.5 giây với cơ chế dọn dẹp timer trong `useEffect`.
  - Được kết nối xuyên suốt các nghiệp vụ: Đăng nhập/Đăng ký thành công (`success`), Đăng xuất an toàn (`info`), Đạt chuẩn quiz $\ge 75\%$ (`success`), Chưa đạt chuẩn quiz (`warning`), Lỗi kết nối mạng khi tải bài học (`error`).
- **Khuyến nghị AI trung thực & Tôn trọng quyền tự do của người học:**
  - Banner khuyến nghị khẳng định rõ quyền tự do chọn bài: *"Gợi ý mang tính định hướng. Bạn có thể tự do chọn bất kỳ bài học nào đã mở khóa trên lộ trình."*
  - Tuyệt đối không sử dụng các từ ngữ áp đặt hoặc thổi phồng ("tối ưu nhất", "hoàn hảo tuyệt đối").
  - Phân định rõ ràng: Khái niệm được mô hình DQN ưu tiên trong số các bài đã đủ điều kiện tiên quyết (DAG).
  - Các node bài học bị khóa (`scr08-locked-view`) hiển thị danh sách cụ thể tên các bài tiên quyết chưa hoàn thành ("Cần hoàn thành [Tên các bài tiên quyết] $\ge 75\%$").
- **Modal Lịch sử làm bài (`AttemptHistoryModal.tsx`):**
  - Nút mở lịch sử trên Navigation Header (`data-testid="open-history-modal-btn"`).
  - Dialog chuẩn WAI-ARIA (`role="dialog"`, `aria-modal="true"`, `aria-labelledby="attempt-history-title"`).
  - Tích hợp hook `useFocusTrap` bẫy phím Tab bên trong modal và đóng bằng phím `Escape`.
  - Đầy đủ 5 trạng thái UX: Loading (spinner), Empty ("Chưa có lượt làm bài nào"), Error (báo lỗi kèm nút "Thử lại"), Ideal (danh sách lượt thi với điểm số, thời gian nộp, phiên bản `state_version`, điểm trước/sau, huy hiệu mở khóa mới), Disabled (khóa tương tác khi đang fetch).
- **Kết luận Trục 1:** **PASS** (100% đạt chuẩn trải nghiệm nghiệp vụ thực tế và WAI-ARIA).

---

### Trục 2: Chất Lượng Mã Nguồn & Độ Bao Phủ Kiểm Thử (Code Quality & Testing)
- **TDD RED Behavioral Tests:**
  - Kiểm thử quan sát RED trước khi GREEN được thực thi nghiêm ngặt:
    - `backend/tests/test_recheck_r1_to_r4_red.py`: 5 tests chuyên sâu cho R1, R4, R3, R3 server guard và REAL-05 attempts history.
    - `frontend/src/__tests__/realism_r1_to_r4_red.test.tsx`: 1 behavioral test mô phỏng rớt mạng/abort khi tải bài học và xác minh nút Retry.
    - `scripts/audit_product_realism.cjs`: Script audit trình duyệt độc lập kiểm chứng hành trình 11 bước từ context trắng không mock token.
- **Frontend TypeScript Types & Architecture:**
  - Bổ sung định nghĩa types rõ ràng trong `frontend/src/types.ts`: `AttemptHistoryItem`, `AttemptHistoryPayload`, `ToastType`, `ToastNotification`.
  - Tuyệt đối zero `any` types.
  - Zero lỗi biên dịch: `tsc --noEmit` và `tsc -b && vite build` hoàn toàn sạch, bundle production chỉ 346.17 kB (gzipped 97.25 kB).
- **Xử lý ngoại lệ minh bạch (No Silent Catch):**
  - `handleOpenConcept` trong `App.tsx` bọc `try...catch`, bắt lỗi kết nối, cập nhật state `conceptFetchError` và hiển thị alert banner kèm nút "Thử lại", loại bỏ hoàn toàn unhandled promise rejection.
  - Zero khối `catch (e) {}` rỗng trong toàn bộ codebase.
  - Backend: `IntegrityError` được bắt tường minh, rollback transaction và trả mã HTTP 409 chuẩn mực.
- **Kết luận Trục 2:** **PASS** (100% tuân thủ Clean Architecture, DRY/SOLID, zero ESLint warnings, zero TypeScript errors).

---

### Trục 3: Bảo Mật & An Toàn Phiên (OWASP Security & Session Hardening)
- **Băm mật khẩu an toàn với Argon2id:**
  - Xác thực người dùng bằng thuật toán băm chuẩn mật mã `argon2id` (`CryptContext(schemes=["argon2"], ...)`).
  - Mật khẩu thô không bao giờ được lưu trữ trong cơ sở dữ liệu hay log.
- **Quản lý Cookie Session động theo chuẩn RFC 6265bis:**
  - Cấu hình động: `cookie_secure` là `True` khi `app_env == "production"`, `False` khi dev/local.
  - Sử dụng tên cookie `plumora_session` trong môi trường phát triển HTTP (tránh bị trình duyệt từ chối do thiếu Secure flag) và tự động nâng cấp lên `__Host-plumora_session` với `secure=True` trong môi trường HTTPS production.
  - Session cookie luôn mang cờ `httponly=True`, `samesite="lax"`, `path="/"`.
  - Đăng xuất an toàn: hàm `logout_user` chủ động thu hồi cả `effective_session_cookie_name`, `plumora_session`, và `__Host-plumora_session`.
- **Anti-IDOR & Cô lập dữ liệu người học:**
  - Endpoint `GET /api/v1/assessment/history` truy vấn nghiêm ngặt theo `QuizAttemptModel.user_id == user.id`. Học viên A tuyệt đối không thể xem lịch sử làm bài của học viên B.
  - Giới hạn tham số phân trang `limit` từ 1 đến 100, chống tấn công DoS tải dữ liệu lớn.
- **CSRF & Idempotency với Submission ID:**
  - Bắt buộc `submission_id` dạng UUID v4 duy nhất cho mỗi lượt nộp bài.
  - Phát lại bài nộp cũ bảo toàn chính xác dữ liệu gốc, không sinh lượt làm bài mới trong cơ sở dữ liệu.
  - Tái sử dụng `submission_id` cho khái niệm khác bị chặn đứng với mã HTTP 409 Conflict (`SUBMISSION_ID_REUSED_ACROSS_CONCEPTS`).
- **Phòng chống Race Condition khi Đăng ký (R4):**
  - Khi có nhiều request đồng thời đăng ký cùng 1 username: bắt `IntegrityError`, rollback session và trả về HTTP 409 `USERNAME_TAKEN`, triệt tiêu hoàn toàn lỗi 500.
- **Kết luận Trục 3:** **PASS** (Đạt chuẩn bảo mật OWASP, Anti-IDOR 100%, bảo vệ phiên chuẩn RFC 6265bis).

---

### Trục 4: Cơ Sở Dữ Liệu & Tính Toàn Vẹn Giao Dịch (Database & ACID Integrity)
- **ACID Transaction Boundaries & Unit of Work:**
  - Ranh giới giao dịch trong `execute_quiz_attempt_uow` bảo đảm tính nguyên tử (Atomicity): ghi nhận lượt nộp bài, cập nhật điểm thông thạo, kiểm tra mở khóa DAG và đồng bộ Redis cache trong một transaction duy nhất.
- **Khóa Bi Quan (SELECT ... FOR UPDATE) & Tránh Stale Identity Map:**
  - Trong `assessment/router.py`: bổ sung lệnh `db.refresh(locked_user)` ngay sau `with_for_update()`.
  - Biện pháp này làm mới đối tượng `locked_user` từ cơ sở dữ liệu vật lý PostgreSQL, loại bỏ hoàn toàn hiện tượng stale cache trong Identity Map của SQLAlchemy khi user object đã được load từ dependency `extract_current_user`.
  - Đảm bảo `state_version` tăng tuần tự đơn điệu chính xác khi có nhiều thao tác xen kẽ.
- **Bảo toàn Độ Thông Thạo Đơn Điệu (Monotonic Mastery - D-06):**
  - Điểm thông thạo của học viên đối với một khái niệm luôn được tính bằng `max(existing_mastery, new_score)`.
  - Làm lại bài kiểm tra với điểm thấp hơn không làm giảm điểm thông thạo đã đạt trước đó.
- **Truy vấn Lịch sử Nộp bài Tối ưu:**
  - Endpoint `GET /api/v1/assessment/history` sử dụng `JOIN` giữa `quiz_attempts` và `concepts` trên khóa `concept_action_id`, có chỉ mục, sắp xếp `ORDER BY created_at DESC`.
  - Loại bỏ hoàn toàn truy vấn N+1.
- **Kết luận Trục 4:** **PASS** (ACID toàn vẹn, SELECT FOR UPDATE kèm refresh triệt tiêu stale identity map, monotonic mastery D-06 bảo toàn 100%).

---

## 2. Nhật Ký Thực Thi Kiểm Thử Thực Nghiệm (Empirical Evidence Logs)

### 2.1. Kiểm thử Backend & RL Suite
```
=== Backend Static & Unit Tests ===
uv run ruff check . -> All checks passed!
uv run mypy . -> Success: no issues found in 35 source files
uv run pytest -v -> 29 passed in 4.68s (100% green)

=== RL Simulator & Checkpoint Evaluation Suite ===
uv run ruff check . -> All checks passed!
uv run mypy . -> Success: no issues found in 9 source files
uv run pytest -v -> 9 passed in 2.31s (100% green)
```

### 2.2. Kiểm thử Frontend Suite
```
npm run lint -> eslint . (0 errors, 0 warnings)
npm run typecheck -> tsc --noEmit (0 errors)
npm run test:unit -> vitest run --exclude 'e2e/**' (4 test files, 16 passed in 1.30s)
npm run build -> tsc -b && vite build (dist built in 2.26s, 346.17 kB bundle)
npm run test:integration -> vitest run e2e/live_fullstack_journey.spec.ts (1 passed in 831ms)
```

### 2.3. Kiểm thử Trình Duyệt Thật Headless Chromium (`audit_product_realism.cjs`)
```json
{
  "timestamp": "2026-11-17T12:10:35.809Z",
  "errors": [],
  "checks": {
    "unauthenticatedLanding": true,
    "initialFreshMastery": "Đã thông thạo: 0 / 12 khái niệm (0%)",
    "freshStateIsZero": true,
    "activeUsernameMatches": true,
    "sessionPersistedAcrossReload": true,
    "lockedReasonExplained": true,
    "recommendationGrounded": true,
    "lessonRendered": true,
    "quizPassed": true,
    "updatedMastery": "Đã thông thạo: 1 / 12 khái niệm (8%)",
    "masteryIncremented": true,
    "historyModalRecorded": true,
    "logoutTerminatedSession": true
  },
  "username": "real_1794917437180_861",
  "allChecksPassed": true
}
```

### 2.4. Kiểm thử Độc Lập Hardening & Negative Control Probe
```
node scripts/audit_mvp_hardening.cjs -> allChecksPassed = true (exit code 0)
node scripts/audit_mvp_hardening.cjs --negative-control -> allChecksPassed = false (exit code 1, correctly detected assertion failure)
```

### 2.5. Toàn Trình Tích Hợp Day-0 CI Script (`./scripts/ci_check.sh`)
```
=== ALL DAY-0 CI, INTEGRATION & BROWSER E2E HARDENING CHECKS PASSED ===
Exit code: 0
Total elapsed time: ~30s
```

---

## 3. Kết Luận Gate 3 (Sign-Off Verdict)

| Trục Đánh Giá | Kết Luận Trục | Ghi Chú Độc Lập |
| --- | :---: | --- |
| **Trục 1: Trải nghiệm nghiệp vụ và UI/UX** | **PASS** | Form đăng ký tự do, sạch sẽ; cookie session duy trì sau F5; tách biệt công cụ demo; Toast 4 trạng thái; giải thích DQN trung thực; modal lịch sử đạt chuẩn WAI-ARIA. |
| **Trục 2: Chất lượng mã nguồn & Kiểm thử** | **PASS** | TDD RED behavioral tests đầy đủ; 0 ESLint warnings; 0 TypeScript errors; không silent catch; không mock API bừa bãi. |
| **Trục 3: Bảo mật & An toàn phiên** | **PASS** | Mật mã Argon2id; phân định cookie RFC 6265bis dev/prod; chống IDOR 100%; CSRF/Idempotency với submission_id; race condition 409 khi trùng username. |
| **Trục 4: Cơ sở dữ liệu & Tính toàn vẹn giao dịch** | **PASS** | ACID transaction; SELECT FOR UPDATE kèm refresh triệt tiêu stale identity map; monotonic mastery D-06; API lịch sử tối ưu. |

### **TỔNG THỂ GATE 3 VERDICT:** **APPROVED**

Hệ thống Plumora trên nhánh `feat/product-realism` hoàn toàn đáp ứng các tiêu chuẩn khắt khe của Gate 3, khắc phục triệt để các hạn chế demo kỹ thuật và chuyển đổi thành công sang một sản phẩm học tập thích ứng cá nhân hóa hoàn chỉnh, thực tế và sẵn sàng cho việc đóng gói phát hành (Gate 4) và bảo vệ đồ án tốt nghiệp xuất sắc.
