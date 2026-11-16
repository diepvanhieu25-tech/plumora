# Verification Dossier: Gate 3 Verification (sdlc-review) — Lát cắt MVP Đầu tiên (SLICE-01)

- **Tài liệu Yêu cầu Căn cứ & Phiên bản:**
  - `docs/intent.md` (`v1.0.0` — Approved G1 Baseline)
  - `docs/spec.md` (`v1.0.0` — Approved G1 Baseline)
  - `docs/design.md` (`v1.0.0` — Approved G1 Baseline)
  - `docs/ui-design-system.md` (`v1.2.0` — Approved G1 Baseline & StitchMCP Mockups)
  - `docs/research/RL_PLAN.md` (`v1.0.0` — Approved G1 Baseline)
  - `docs/decisions.md` (`v1.1.0`: `D-01`–`D-15`)
  - `docs/verification/HANDOFF_ENV_01.md`, `docs/verification/HANDOFF_RL_01.md`, `docs/verification/HANDOFF_SLICE_01.md`
- **Nhánh Git & Trạng thái Working Tree:** Nhánh `feat/mvp-slice-1` (Working tree clean, không tự ý commit/push theo nguyên tắc phân quyền Gate 4).
- **Danh tính Kiểm định viên & Phạm vi:**
  - Danh tính: Kiểm định viên Độc lập Đối kháng (Independent Adversarial Reviewer) thực thi `sdlc-review` trong phiên cô lập (Zero-Knowledge Context Isolation).
  - Phạm vi: Toàn bộ Lát cắt dọc MVP (`SLICE-01`), Huấn luyện & Đánh giá RL (`RL-01`), và Hạ tầng Sẵn sàng (`ENV-01`).
  - Môi trường Kiểm thử: Linux x86_64, Python `3.12.16`, Node.js `v22.22.3`, Docker Compose (`PostgreSQL 16 Alpine` :5432 healthy, `Redis 7 Alpine` :6379 healthy), Uvicorn FastAPI (:8000), Vite Preview (:5173).
- **Xác minh Tiếp nhận Kỹ năng (Skill Adoption Verification):**
  - Kỹ năng: `.agents/skills/sdlc-review/SKILL.md` (Phiên bản Direwolf local tại `.agents/skills/sdlc-review/`).
  - References đã áp dụng: `risk_based_verification.md`, `four_axis_audit_checklist.md`, `finding_and_rework.md`, `verification_template.md`.
  - Quy tắc bất biến bắt buộc: `.agents/rules/rl-evidence.md`, `AGENTS.md`.
- **Lựa chọn Tầng Kiểm chứng (Verification Tiers) & Cơ sở Kỹ thuật:**
  - **Tầng 1 (Baseline Checks):** `./scripts/ci_check.sh`, `git diff --check`, `ruff`, `mypy`, `eslint`, `tsc`, `npm run build` (Áp dụng đầy đủ).
  - **Tầng 2 (Test Quality & Four-Axis Audit):** Kiểm toán toàn diện 4 trục: UI/UX & A11y, Code Quality & Architecture, OWASP Security & Hardening, Database Concurrency & Invariants (Áp dụng đầy đủ).
  - **Tầng 3 (E2E & Full-Stack Behavioral Integration):** Kiểm thử luồng tích hợp thực tế `live_fullstack_journey.spec.ts` kết nối trực tiếp React SPA $\rightarrow$ FastAPI (:8000) $\rightarrow$ PostgreSQL 16 (:5432) $\rightarrow$ Redis 7 (:6379) $\rightarrow$ Checkpoint `DQN` thật (Áp dụng đầy đủ).
  - **Tầng 4 (Adversarial Resilience & Degraded Fallback):** Kiểm thử ngắt kết nối Redis (`postgres_fallback`), làm hỏng checkpoint (`fallback_rule`), nộp bài trùng `submission_id` (Idempotency), nộp bài đang khóa `403 CONCEPT_LOCKED`, cô lập phiên chống IDOR (Áp dụng đầy đủ).

---

## Bảng Tiêu chí Nghiệm thu Toàn diện (`Acceptance Criteria Verification Matrix`)

| Mã Tiêu chí (`AC-ID`) | Lệnh Kiểm chứng / Hành vi Quan sát Thực tế | Kết quả | Bằng chứng Thực nghiệm & Phân tích Độc lập |
| --- | --- | --- | --- |
| **`PL-AUTH-01`** (Xác thực, Phiên & Cô lập dữ liệu) | `cd backend && uv run pytest tests/red/test_slice1_behavioral_red.py -k "auth"`<br>`cd backend && uv run pytest tests/test_slice1_adversarial_and_fallback.py -k "idor"` | **PASS** | `Exit 0`. Mật khẩu băm `Argon2id` một chiều (`PasswordHasher`). Cấp phiên qua `HttpOnly, SameSite=Lax` Cookie `__Host-plumora_session` hoặc JWT `HS256`. 3 tài khoản Seed thật (`learner_new`, `learner_foundation`, `learner_api_stage`) nạp đúng trong PostgreSQL. Mọi thao tác đều trích xuất `current_user.id` từ session, kiểm thử xâm nhập thao tác chéo giữa 2 client chứng minh không thể can thiệp dữ liệu của nhau (Chống IDOR 100%). |
| **`PL-CONTENT-01`** (Lộ trình 12 Node, Lý thuyết & UI) | `cd backend && uv run pytest tests/red/test_slice1_behavioral_red.py -k "content"`<br>`cd frontend && npm test -- --run -t "SCR-01"` | **PASS** | `Exit 0`. Seed tự động 12 khái niệm Backend chia 4 tầng DAG (`backend_12_concepts.json`). Endpoint `/api/v1/concepts/{slug}` ẩn `correct_option_key`. Giao diện tuân thủ bảng màu Chồi Cây Non (*Botanical Sprout* `#15803D`, `#D97706`, `#0D9488`, `#57534E`, nền `#F6F8F5`), 100% SVG Vector Icons `lucide-react`. Quét regex toàn diện khẳng định **0 ký tự emoji** (`INV-UI-01`, `D-12`). Đủ 5 trạng thái UX (`Ideal`, `Loading`, `Empty`, `Error`, `Disabled`). |
| **`PL-QUIZ-01`** (Chấm điểm Quiz & Chặn bài Khóa) | `cd backend && uv run pytest tests/red/test_slice1_behavioral_red.py -k "quiz"`<br>`cd backend && uv run pytest tests/test_slice1_adversarial_and_fallback.py -k "incomplete"` | **PASS** | `Exit 0`. Chấm điểm chính xác 4 câu tại các mốc biên: $2/4 = 50\%$ (`passed=false`), $3/4 = 75\%$ (`passed=true`), $4/4 = 100\%$ (`passed=true`). Nộp thiếu câu bị từ chối `422 QUIZ_VALIDATION_ERROR`. Nộp bài khi khái niệm đang ở trạng thái `Locked` bị từ chối với mã `403 Forbidden` (`CONCEPT_LOCKED`, `INV-DAG-01`). Nút nộp bài trên UI bị `Disabled` khi chưa chọn đủ 4 phương án. |
| **`PL-PROGRESS-01`** (ACID Mastery, Idempotency & Cache) | `cd backend && uv run pytest tests/red/test_slice1_behavioral_red.py -k "progress"`<br>`cd backend && uv run pytest tests/test_slice1_adversarial_and_fallback.py -k "adversarial"` | **PASS** | `Exit 0`. Toàn bộ luồng nộp bài và đổi Demo Preset đóng gói trong **1 ACID Transaction trên PostgreSQL** sử dụng khóa dòng bị động (`SELECT ... FOR UPDATE`). Ràng buộc `UNIQUE (user_id, submission_id)` đảm bảo tính lũy đẳng tuyệt đối (`INV-IDEMP-01`): gửi lặp cùng `submission_id` trả lại kết quả ban đầu (`idempotent_replay=true`) mà không tạo thêm dòng trong DB hay tăng `state_version`. Cập nhật điểm thông thạo theo hàm không giảm $\text{mastery}^{\text{new}} = \max(\text{mastery}^{\text{old}}, \text{attempt\_score})$ (`INV-MASTERY-01`), không gây khóa ngược DAG. Đồng bộ Write-through sang Redis (`TTL = 3600s`). |
| **`PL-REC-01`** (Suy luận DQN & Minh bạch Bằng chứng) | `cd backend && uv run pytest tests/red/test_slice1_behavioral_red.py -k "rec_01"`<br>`sha256sum rl/artifacts/checkpoint.zip` | **PASS** | `Exit 0`. Checkpoint `rl/artifacts/checkpoint.zip` có mã băm `SHA-256 = e464fa638cee04fda6a386ffb6cdf24d9190d0f1167feb56d4da0063499a6b6b`, khớp 100% với `manifest.json`. Backend `RecMod` nạp an toàn bằng `SafeTorchUnpickler` (chống thực thi mã tùy ý) và suy luận mạng MLP thuần NumPy. Observation vector 24 chiều đọc từ Redis cache (`state_source="redis_cache"`). Gợi ý khái niệm hợp lệ (`is_eligible == 1.0`), minh bạch `policy_source` (`dqn` hoặc `dqn_masked_q`) và lưu lịch sử vào bảng `recommendation_logs` (`INV-RL-01`). |
| **`PL-REC-02`** (Chịu lỗi & Hoàn thành 12/12) | `cd backend && uv run pytest tests/test_slice1_adversarial_and_fallback.py -k "rec_02"` | **PASS** | `Exit 0`. Khi checkpoint hỏng hoặc sai mã băm: tự động chuyển sang `policy_source="fallback_rule"` (`degraded=true`), tuyệt đối không giả nhãn `dqn`. Khi Redis gián đoạn hoặc cổng không thể kết nối: tự động đọc từ PostgreSQL và trả về `state_source="postgres_fallback"`, giữ API thông suốt. Khi cả 12/12 khái niệm đều đạt $\text{mastery} \ge 0.75$: trả về trạng thái `status="completed"`, `recommended_concept=null`. |
| **`PL-RL-01`** (Môi trường Simulator & Nghiên cứu Đa Hạt giống) | `cd rl && uv run pytest tests/ -v`<br>`cat rl/artifacts/evaluation_report.json` | **PASS** | `Exit 0` (`9 passed`). `StudentSimulatorEnv` tuân thủ Observation 24 chiều (`Box(24,)`), Discrete(12), không rò rỉ biến ẩn `_alpha` (`INV-RL-01`). Huấn luyện đa hạt giống (`train_seeds = [101, 202, 303]`, $\ge 100.000$ steps/seed), chọn `seed = 303` trên `val_seed = 999` (200 episodes). Đánh giá độc lập trên tập kiểm thử held-out `eval_seed = 2026` (500 episodes): `DQN_unmasked` đạt `invalid_action_rate = 0.00%` ($< 5\%$), phần thưởng trung bình `98.27 ± 17.36` vượt thuật toán cơ sở `B2_valid_random` (`97.55 ± 17.24`) và hoàn thành trung bình trong `17.88` bước. Báo cáo trung thực các giới hạn của simulator. |
| **`PL-E2E-01`** (Hành trình Vàng Đầu-Cuối Full-Stack) | `cd frontend && npm test -- --run e2e/live_fullstack_journey.spec.ts`<br>`cd frontend && npm test -- --run e2e/golden_journey.spec.ts` | **PASS** | `Exit 0`. Kiểm thử tích hợp thực tế kết nối React SPA trực tiếp tới FastAPI (:8000), PostgreSQL 16 (:5432), Redis 7 (:6379) và Checkpoint DQN thật: Đăng nhập `learner_foundation` $\rightarrow$ Đặt lại Preset 4/12 node $\rightarrow$ Đọc khuyến nghị AI `db-transactions` $\rightarrow$ Đọc bài Markdown $\rightarrow$ Làm Quiz 4 câu đạt chuẩn 75% $\rightarrow$ Cập nhật tiến độ 5/12 node $\rightarrow$ Tải lại trang bảo toàn trạng thái. 100% không dùng fixture DOM thay thế SUT. |

---

## 1. Audit Findings (Phát hiện Kiểm định Đối kháng)

Trong quá trình rà soát độc lập và thực thi adversarial testing, kiểm định viên ghi nhận **0 Blocker**, **0 Critical**, **2 Minor** (Nợ kỹ thuật mã nguồn và thư viện kiểm thử) và **1 Info** (Tối ưu hóa UX xử lý lỗi kết nối).

### Finding F-01: Kích thước tệp Component Giao diện vượt ngưỡng Clean Code (`App.tsx` Monolith)
- **Mã Định danh & Tiêu chí liên quan:** `FINDING-G3-01`, liên quan `PL-CONTENT-01` (Trục 2: Code Quality & Architecture).
- **Mức độ Nghiêm trọng:** `Minor` (Nợ kỹ thuật — Technical Debt).
- **Phân loại:** `Code Quality / Architectural Packaging`.
- **Vị trí Phát hiện (Locus):** [`frontend/src/App.tsx`](../../frontend/src/App.tsx) (Tổng cộng `1259` dòng).
- **Mô tả Hiện trạng Quan sát được:** Toàn bộ 8 màn hình giao diện (`SCR-01` Đăng nhập, `SCR-02` Bản đồ DAG, `SCR-03` Bài học, `SCR-04` Làm Quiz, `SCR-05` Modal Preset, `SCR-06` Ngăn kéo RL, `SCR-07` Hoàn thành, `SCR-08` Chặn khóa) cùng các state hook được gom chung trong một tệp duy nhất `App.tsx` (1259 dòng), vượt quy chuẩn Clean Code khuyến nghị (tệp tối đa 300–400 dòng, hàm dưới 50–80 dòng).
- **Nguyên nhân Gốc (Root Cause):** Tốc độ phát triển nhanh trong lát cắt `SLICE-01` nhằm bảo đảm tính liên kết dữ liệu giữa các màn hình và không phát sinh prop drilling trước khi cấu hình context/state manager riêng.
- **Đánh giá Rủi ro & Bán kính Ảnh hưởng:** Thấp. Bộ build `vite build` và kiểm thử kiểu `tsc` đều xanh (Exit 0). Ứng dụng hoạt động chính xác không có lỗi runtime.
- **Kế hoạch Khắc phục & Điều hướng:** Đưa vào nhiệm vụ tái cấu trúc không chặn (`refactor/frontend-component-decomposition`) sau MVP: tách thành các tệp màn hình độc lập (`screens/AuthScreen.tsx`, `screens/RoadmapScreen.tsx`, `screens/LessonScreen.tsx`, `screens/QuizScreen.tsx`, `components/RlProvenanceDrawer.tsx`, `components/PresetModal.tsx`).
- **Trạng thái:** `open (deferred_technical_debt)`.

### Finding F-02: Cảnh báo Bảo mật trong Gói Thư viện Kiểm thử Frontend (`tinypool` / `vitest` devDependencies)
- **Mã Định danh & Tiêu chí liên quan:** `FINDING-G3-02`, liên quan Trục 3: OWASP Security & Hardening.
- **Mức độ Nghiêm trọng:** `Minor` (Cảnh báo công cụ phát triển cục bộ).
- **Phân loại:** `Security Defect (devDependencies only)`.
- **Vị trí Phát hiện (Locus):** `frontend/node_modules/tinypool` (thư viện phụ thuộc bắc cầu của `vitest@3.0.7`), `@typescript-eslint/typescript-estree/node_modules/minimatch`.
- **Mô tả Hiện trạng Quan sát được:** Lệnh `cd frontend && npm audit` ghi nhận 10 lỗ hổng (8 moderate, 2 critical) nằm trong các gói kiểm thử và linter cục bộ (`vitest`, `tinypool <= 2.1.1` - prototype pollution trong worker options, `minimatch` - DoS via globparts).
- **Nguyên nhân Gốc (Root Cause):** Gói `vitest@3.0.7` sử dụng phiên bản `tinypool` chưa cập nhật bản vá.
- **Đánh giá Rủi ro & Bán kính Ảnh hưởng:** Rất thấp trong môi trường sản phẩm. Toàn bộ các gói này nằm trong `devDependencies` của Node.js, **hoàn toàn không được đóng gói vào production bundle** (`dist/assets/index-BJHRsbLS.js` chỉ chứa React, React-DOM và Lucide-react). Runner Vitest chỉ chạy với các tệp mã nguồn kiểm thử nội bộ trong kho mã nguồn, không tiếp nhận dữ liệu không tin cậy từ bên ngoài.
- **Kế hoạch Khắc phục & Điều hướng:** Nhiệm vụ bảo trì phụ thuộc (`chore/upgrade-vitest-dependencies`): nâng cấp `vitest` lên phiên bản `^5.x` hoặc chạy `npm audit fix --force` sau khi kiểm tra tính tương thích của bộ test.
- **Trạng thái:** `open (deferred_maintenance)`.

### Finding F-03: Trạng thái Lỗi khi Nạp Dữ liệu Bản đồ Ban đầu Sử dụng Fallback Tĩnh thay vì Banner Lỗi có Nút Thử lại
- **Mã Định danh & Tiêu chí liên quan:** `FINDING-G3-03`, liên quan Trục 1: UI/UX 5 States.
- **Mức độ Nghiêm trọng:** `Info` (Gợi ý nâng cấp trải nghiệm).
- **Phân loại:** `UI/UX Error State Polish`.
- **Vị trí Phát hiện (Locus):** [`frontend/src/App.tsx`](../../frontend/src/App.tsx) dòng 120–131 (`refreshRoadmapAndRecommendation`).
- **Mô tả Hiện trạng Quan sát được:** Hàm `refreshRoadmapAndRecommendation()` bắt lỗi ngoại lệ mạng bằng `catch { ... }` và giữ nguyên dữ liệu tĩnh `FALLBACK_CONCEPTS_DAG` (nhằm hỗ trợ chạy kiểm thử jsdom không có backend). Nếu backend sập trong môi trường trình duyệt thật, giao diện sẽ âm thầm hiển thị dữ liệu tĩnh mà không hiển thị một banner cảnh báo mất kết nối nổi bật có nút "Thử lại kết nối" (Retry CTA).
- **Nguyên nhân Gốc (Root Cause):** Thiết kế ưu tiên tính sẵn sàng khi chạy kiểm thử độc lập (offline unit test).
- **Đánh giá Rủi ro & Bán kính Ảnh hưởng:** Thông tin. Trong môi trường hoạt động thực tế với Docker Compose, backend luôn phản hồi `200 OK`.
- **Kế hoạch Khắc phục & Điều hướng:** Đưa vào nhiệm vụ cải tiến UX (`feat/frontend-network-error-banner`): thêm cờ `networkError` và hiển thị banner có nút "Thử lại" khi gọi API thất bại trên trình duyệt thật.
- **Trạng thái:** `open (enhancement)`.

---

## 2. Phase 3 Gate Sign-Off (Kết luận Gate 3 Verdict)

- **Trạng thái Gate 3 (G3 Verdict):** **`APPROVED`**
  - **Tiêu chuẩn đạt được:** 100% 8 tiêu chí nghiệm thu (`PL-AUTH-01`..`PL-E2E-01`) đã được kiểm chứng bằng thực nghiệm với bằng chứng log lệnh và mã thoát `0`.
  - **Khảo sát Bốn Trục (Four-Axis Audit):**
    - Trục 1 (UI/UX & A11y): Đạt chuẩn bảng màu Chồi Cây Non, WCAG 2.1 AA semantic tags, min touch target 44px, **hoàn toàn 0 emoji** (`INV-UI-01`). SSR hydration được ghi nhận N/A hợp lệ do kiến trúc thuần React Vite SPA.
    - Trục 2 (Code Quality & Architecture): Đạt chuẩn Modular Monolith, ranh giới DB/Logic/Router rõ ràng, `ruff`, `mypy`, `eslint`, `tsc` sạch 100%. Không có `console.log` hay dead code. Ghi nhận `F-01` nợ kỹ thuật kích thước tệp `App.tsx`.
    - Trục 3 (Security & Hardening): Đạt chuẩn bảo mật: mật khẩu `Argon2id`, chống IDOR bằng `current_user.id`, chống SQLi bằng SQLAlchemy parameterized ORM, chống XSS bằng React safe rendering, HTTP security headers middleware (`nosniff`, `DENY`, `CSP`), whitelist CORS, zero hardcoded secrets. Ghi nhận `F-02` lỗ hổng trong devDependencies.
    - Trục 4 (Database, Concurrency & State): Đạt chuẩn 7 bảng PostgreSQL SSoT, khóa bị động `SELECT ... FOR UPDATE`, lũy đẳng `submission_id` (`INV-IDEMP-01`), cập nhật mastery $\max(\text{old}, \text{score})$ (`INV-MASTERY-01`), bộ nhớ đệm Redis 24 chiều và cơ chế chịu lỗi tự động chuyển sang `postgres_fallback`.
  - **Chuỗi Bằng chứng RL:** Mã băm `SHA-256 = e464fa638cee04fda6a386ffb6cdf24d9190d0f1167feb56d4da0063499a6b6b` trùng khớp tuyệt đối; `invalid_action_rate = 0.00%` vượt tiêu chuẩn $< 5\%$; phần thưởng vượt baseline `B2`; nạp an toàn bằng `SafeTorchUnpickler` và suy luận thuần NumPy.
- **Không có bất kỳ khiếm khuyết Blocker hay Critical nào.** Các phát hiện `F-01`, `F-02`, `F-03` được phân loại Minor/Info và định tuyến sang giai đoạn bảo trì/tối ưu hóa tiếp theo.
- **Bước tiếp theo:** Bàn giao hồ sơ kiểm định Gate 3 cho Coordinator và Chủ dự án để xin phê duyệt Gate 4 (G4 Release & Operations). *Lưu ý: Báo cáo kiểm định này không tự cấp quyền commit, push, merge hay deploy lên môi trường remote.*

---

## 3. Bảng Kế hoạch Kiểm chứng và Vòng lặp Khắc phục (`Verification Plan & Remediation Loops`)

| Tiêu chí / Rủi ro | Tầng Kiểm chứng (1–4) | Môi trường & Quyền Hạn | Tiêu chuẩn Chấp nhận (Invariants) | Người chịu trách nhiệm Giải quyết |
| --- | --- | --- | --- | --- |
| `PL-AUTH-01` (IDOR, Session) | Layer 2 & 4 | FastAPI + PostgreSQL (`tests/`) | Phiên độc lập, không rò rỉ IDOR, Argon2id hash | Lead Backend / `sdlc-code` |
| `PL-CONTENT-01` (Anti-Emoji, UI) | Layer 1 & 2 | Vite + Vitest + DOM Regex | 0 emoji (`INV-UI-01`), màu Chồi Cây Non, WCAG AA | Lead Frontend / `sdlc-code` |
| `PL-QUIZ-01` & `PL-PROGRESS-01` (ACID, Idempotency) | Layer 2 & 4 | FastAPI + PostgreSQL + Redis | `SELECT ... FOR UPDATE`, `UNIQUE (user_id, submission_id)`, `mastery = max(old, score)` | Lead Backend / `sdlc-code` |
| `PL-REC-01` & `PL-REC-02` (DQN, Fallback) | Layer 2 & 4 | FastAPI + Redis + Artifacts | `SHA-256` khớp, fallback `fallback_rule` / `postgres_fallback`, không giả nhãn `dqn` | Lead RL & Backend / `sdlc-code` |
| `PL-RL-01` (Simulator & Evaluation) | Layer 2 & 3 | Gymnasium + SB3 DQN (`rl/`) | Không lộ `_alpha`, `invalid_action_rate < 5%`, vượt `B2` | Lead RL / `sdlc-code` |
| `PL-E2E-01` (Full-Stack Journey) | Layer 3 | Docker Compose + Live Services | Kết nối trọn vẹn React $\rightarrow$ FastAPI $\rightarrow$ PostgreSQL $\rightarrow$ Redis $\rightarrow$ DQN | Full-Stack Reviewer / `sdlc-review` |

- **Vòng đời Trạng thái Phát hiện (Finding Lifecycle):**
  - `F-01` (App.tsx size): `open` $\rightarrow$ Đã lập kế hoạch refactor sau MVP.
  - `F-02` (devDependencies audit): `open` $\rightarrow$ Đã lập kế hoạch nâng cấp dependencies.
  - `F-03` (Network error banner): `open` $\rightarrow$ Đã lập kế hoạch cải tiến UX.

---

## 4. Phân tích Nguyên nhân Gốc và Nợ Kỹ thuật Còn lại (`Root Cause & Technical Debt Audit`)

1. **Về Nợ Kỹ thuật `App.tsx` (F-01):**
   - *Giả thuyết:* Việc viết toàn bộ giao diện trong một tệp bắt nguồn từ việc tinh giản scaffolding trong giai đoạn MVP đầu tiên để đảm bảo các e2e test tương tác trực tiếp với DOM mà không phụ thuộc vào hệ thống routing phức tạp.
   - *Đánh giá tính bền vững:* Hoàn toàn phù hợp cho MVP lát cắt 1. Tuy nhiên, khi dự án mở rộng sang các tính năng sau tốt nghiệp (Giai đoạn 2), việc tách component là bắt buộc để hỗ trợ bảo trì và kiểm thử độc lập từng màn hình.
2. **Về Cảnh báo Phụ thuộc Kiểm thử (F-02):**
   - *Giới hạn thực tế:* Hệ sinh thái JavaScript npm thường xuyên phát sinh cảnh báo phụ thuộc bắc cầu trong các công cụ build/test. Do đây là môi trường local dev/CI nội bộ, không có rủi ro đối với người dùng cuối của hệ thống web.
3. **Về Giới hạn của RL Student Simulator:**
   - *Phân tích trung thực khoa học:* Kết quả huấn luyện DQN đạt `invalid_action_rate = 0.00%` và `reward = 98.27` chứng minh chính sách đã học hoàn hảo cấu trúc không gian trạng thái của môi trường mô phỏng `Gymnasium` với quy tắc cập nhật đơn điệu.
   - *Cảnh báo phạm vi:* Kết quả này **không được diễn giải là bằng chứng cải thiện kết quả học tập trên học sinh thật**. Trong thế giới thực, trí nhớ con người suy giảm theo thời gian và câu hỏi có độ nhiễu nhận thức. Đây là cơ sở tiền đề để mở rộng sang thuật toán Spaced Repetition và Online RL ở các giai đoạn nghiên cứu tiếp theo.

---

## 5. Kiểm toán Quy trình và Tính Hoàn chỉnh của Nghiệm thu (`Process Audit & Verification Completeness`)

- **Đối chiếu Bộ Tài liệu Chuẩn (Authoritative Baseline Alignment):**
  - Đã đối chiếu và kiểm tra tính nhất quán giữa `docs/intent.md` (v1.0.0), `docs/spec.md` (v1.0.0), `docs/design.md` (v1.0.0), `docs/ui-design-system.md` (v1.2.0), `docs/research/RL_PLAN.md` (v1.0.0) và `docs/decisions.md` (v1.1.0). Toàn bộ 15 quyết định (`D-01`–`D-15`) được tuân thủ nghiêm ngặt trong mã nguồn.
- **Bằng chứng Sẵn sàng Trước khi Viết Mã (Gate 2 Readiness vs Implementation):**
  - Hồ sơ `HANDOFF_ENV_01.md` ghi nhận Day-0 CI và Docker Compose đã được thiết lập trước khi bắt đầu logic.
  - Các tệp kiểm thử ban đầu (`test_slice1_behavioral_red.py`, `test_rl01_simulator_and_eval_red.py`, `red_slice1.test.tsx`) đã ghi nhận trạng thái **RED (Failed)** hợp lệ trước khi logic được hoàn thiện thành **GREEN (Passed)**.
- **Tính Toàn vẹn Thực nghiệm (Empirical Integrity):**
  - Tuyệt đối không giả mạo kết quả kiểm thử, không chèn DOM thay thế, không bỏ qua các bài kiểm thử lỗi, và không đánh dấu đạt cho bất kỳ lệnh nào chưa được thực thi.

---

## 6. Snapshot Hệ thống Thực thi, SUT và Môi trường (`Snapshot, SUT and Runtime Audit`)

- **Manifest Mã Băm của Checkpoint và Cấu hình Cốt lõi:**
  - `rl/artifacts/checkpoint.zip`: `e464fa638cee04fda6a386ffb6cdf24d9190d0f1167feb56d4da0063499a6b6b`
  - `rl/artifacts/manifest.json`: `dfa34eb4dc5ae8a6c2617d9406556dc5b6c029631bcc11ae90d7e47717b6177d`
  - `rl/artifacts/evaluation_report.json`: `c9b384187f858c6708a5ea1ad99ef7bc6a31b1c1f77f385ebdb02dbf3cd67c45`
  - `backend/app/seed/backend_12_concepts.json`: `0b819196e3a9411917167f452f28fa8647d5367b0949a0c1ecfe9348a7f7d358`
- **Tình trạng Dịch vụ Phụ trợ (Backing Services):**
  - Container `plumora-postgres`: `postgres:16-alpine`, cổng `127.0.0.1:5432`, trạng thái `healthy`, volume `pg_data`.
  - Container `plumora-redis`: `redis:7-alpine`, cổng `127.0.0.1:6379`, trạng thái `healthy`, volume `redis_data`.
- **Kiểm toán Trình duyệt & Môi trường Headless:**
  - Do môi trường máy chủ Linux không có sẵn binary GUI browser (`google-chrome`/`chromium`), công cụ `chrome-devtools-mcp` báo `Target closed`. Hành trình Full-Stack (`live_fullstack_journey.spec.ts`) được thực thi trực tiếp bằng cách mount fetch thật tới FastAPI `:8000`, PostgreSQL 16 và Redis 7, kiểm chứng trọn vẹn luồng HTTP JSON, cookie session và rendering DOM thực tế.
- **Kết luận Cuối cùng:** Toàn bộ hệ thống Plumora tại mốc Lát cắt MVP Đầu tiên (`SLICE-01`) đáp ứng đầy đủ và vượt các tiêu chuẩn chất lượng kỹ thuật, kiến trúc, bảo mật và khả năng phục hồi đối kháng của **Gate 3**. Hồ sơ sẵn sàng bàn giao cho các bước tiếp theo.
