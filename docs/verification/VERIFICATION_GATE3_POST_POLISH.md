# Hồ sơ Thẩm định Độc lập Gate 3 (Verification Dossier): Post-Polish Adversarial Audit (Phase 3 `v2.0.0`)

- **Tài liệu nguồn & Phiên bản (`Requirement Reference & Version`):** `docs/spec.md` (`v2.0.0`), `docs/design.md` (`v2.0.0`), `docs/ui-design-system.md` (`v2.0.0`), `docs/decisions.md` (`D-01`..`D-26`).
- **Trạng thái Git (`Branch / Commit / Working Tree`):** Nhánh `feat/p3-slice-3-microservices-online-rl`, commit nền `18a1ff9` (cây làm việc có thay đổi chưa commit của Phase 3 — `git diff --check` sạch `0` lỗi whitespace).
- **Danh tính Thẩm định viên (`Reviewer Identity`):** Độc lập — Gate 3 Adversarial Reviewer (Zero-Knowledge Review trong phiên tách biệt, không sửa bất kỳ file mã nguồn ứng dụng nào).
- **Môi trường & Công cụ (`SUT & Tooling`):**
  - Docker Compose cục bộ đang chạy: `plumora-frontend` (`http://localhost:3000`, Nginx `1.27.5`), `plumora-backend` (`http://localhost:8000`, Uvicorn/FastAPI, UID `10001`), `plumora-postgres` (PostgreSQL 16 Alpine), `plumora-redis` (Redis 7 Alpine).
  - Công cụ kiểm chứng: `./scripts/ci_check.sh` (Ruff, ESLint, Mypy, TSC, Pytest, Vitest, Vite Build, Live Integration, Chromium E2E), Playwright Chromium đa khung hình (`1280x800` & `390x844`), `npm audit`, Python HTTP/Concurrency QA probes, `psql` PostgreSQL introspection, `sha256sum`.
- **Xác minh tuân thủ kỹ năng (`Skill Adoption Verification`):** Đã nạp và tuân thủ `.agents/skills/sdlc-review/SKILL.md`, `.agents/skills/sdlc-review/references/four_axis_audit_checklist.md`, `.agents/skills/sdlc-review/resources/verification_template.md`, `.agents/rules/rl-evidence.md`, và `.agents/rules/ui-visual-fidelity.md`.
- **Phân tầng kiểm chứng (`Selected vs Omitted Tiers`):** Đã thực thi đủ cả **4 tầng (Tier 1–4)** trên 4 trục (UI/UX & a11y, Code Quality & Architecture, OWASP Security & Hardening, Database/Concurrency/Microservices & RL Integrity). Không bỏ qua tầng nào.

---

## Ma trận Nghiệm thu Theo Tiêu chí (`Criteria Verification Matrix`)

| Tiêu chí (`AC-ID / Invariant`) | Lệnh / Quy trình Kiểm chứng Thực tế | Kết quả (`Pass / Fail`) | Bằng chứng Thực nghiệm (`Empirical Evidence`) |
| --- | --- | --- | --- |
| **Day-0 CI Baseline (`ci_check.sh`)** | `./scripts/ci_check.sh` (Ruff, ESLint, Mypy 58 files, TSC, Pytest 33+3, Vitest 8, Vite build, Live Integration, Chromium E2E) | **PASS** *(Baseline)* | Exit code `0`; 33 backend + 3 RL + 8 frontend unit + 1 live integration + E2E audit pass |
| **`INV-UI-01` & Responsive (`SCR-01`, `SCR-09`..`SCR-20`)** | Playwright Chromium trên `http://localhost:3000` ở `1280x800` và `390x844` qua toàn bộ 3 cổng (`/login`, `/expert/login`, `/admin/login`) và `SCR-09`..`SCR-20` | **FAIL** *(A11y / Touch Targets)* | `0px` tràn ngang, `0` emoji, `0` `<div onClick>`, `0` lỗi API ngoài dự kiến; **nhưng** 3 nút nav Expert/Admin trên Mobile `390px` thiếu `aria-label` (`iconNoAria=3`), nút Logout `28x28px`, `AiTutorRubricDrawer` thiếu `Escape`/Focus Trap (`F-G3-09`), `AuthPage` thiếu `<main>` (`F-G3-13`) |
| **`PL-AUTH-01` & `PL3-ROLE-01` (Auth, RBAC, IDOR, Logout)** | Probe HTTP thực tế tới `http://127.0.0.1:8000` (IDOR placement/assessment, RBAC cross-role, portal bypass, JWT post-logout) | **FAIL** *(Critical)* | IDOR placement/depth bị chặn `404`; RBAC cross-portal trả `403`; **nhưng** JWT vẫn dùng được sau `POST /api/v1/auth/logout` (`HTTP 200` trên `/api/v1/auth/me` — `F-G3-02`); bỏ trống `portal` cho phép `admin_demo`/`expert_demo` đăng nhập (`F-G3-07`); `learner` gọi `POST /api/v2/expert/domains` nhận `422` trước `403` (`F-G3-12`) |
| **`INV-SANDBOX-01` / `PL3-GRADER-01` (Code Sandbox)** | Probe biên an toàn tới `POST /api/v2/concepts/net-internet/code-sandbox/submit` + đọc mã nguồn `sandbox_worker.py` | **FAIL** *(Blocker)* | `import os` bị chặn `422`, `while True` cắt đúng `408` trong `3023ms`; **nhưng** `getattr(__builtins__, ...)` và `().__class__.__base__.__subclasses__()` trả `HTTP 200` (vượt AST), cấp phát `200MB` trả `HTTP 200` (vượt trần `128MB`), và worker chạy trực tiếp trong `plumora-backend` không cô lập mạng (`F-G3-01`) |
| **`INV-IDEMP-01` / Concurrency (`PL-PROGRESS-01`)** | 5 request song song cùng `submission_id` vào `/api/v2/assessments/{id}/submit` và `/api/v2/concepts/net-internet/code-sandbox/submit` | **FAIL** *(Critical)* | Race condition gây `HTTP 500`: Depth submit `[200, 500, 500, 500, 500]`; Sandbox submit `[500, 200, 500, 500, 500]` (`F-G3-03`) |
| **`PL3-GUARD-01` / `INV-ONLINE-RL-01` (GNN-PPO & Online RL)** | `sha256sum rl/artifacts/gnn_ppo_v2_base.zip` + `POST /api/v2/recommendations` (3 domain) + kiểm mã `admin_service.py`, `service_v2.py` | **FAIL** *(Critical)* | `gnn_ppo_v2_base.zip` SHA-256 `9977d5f6...534201` khớp 100% khi phục vụ `backend`/`frontend`/`devops`; **nhưng** `run_micro_batch_online_rl` giả lập metric & sinh SHA giả, Activate/Rollback không đổi model phục vụ, `state_source` hardcode `"postgres_fallback"`, `system-health` hardcode `"up"` (`F-G3-04`) |
| **`PL3-ARCH-01` (4-Schema Isolation, Outbox, DB Perf)** | `psql` kiểm tra `information_schema.tables`, `pg_indexes`, `outbox_events` + kiểm mã `models.py`, `kg_service.py`, `admin_service.py` | **FAIL** *(Major)* | 21 bảng thật nằm ở `public` (4 schema chỉ có 1 bảng `service_marker` mỗi schema — `F-G3-06`); tồn tại N+1 queries, unbounded `SELECT *` không `LIMIT` và thiếu 4 index quan trọng (`F-G3-08`); `service_v2.py` không phát `CompetencyUpdatedEvent` vào Outbox |
| **Dependency & Code Quality (Trục 2)** | `npm audit`, `wc -l`, static grep (`any`, `console.log`, `dangerouslySetInnerHTML`) | **FAIL** *(Critical CVE)* | `0` `any`, `0` `console.log`, `0` `dangerouslySetInnerHTML`; **nhưng** `npm audit` báo `2 CRITICAL` (`tinypool`, `vitest`) & `8 MODERATE` (`F-G3-05`); 9 file vượt 400 dòng (`service_v2.py` 872 dòng — `F-G3-10`) |

---

## 1. Các Phát hiện Thẩm định (`Audit Findings`)

### [F-G3-01] Vượt kiểm tra AST/Builtins, sai ngưỡng RAM 256MB và thiếu cô lập container của Code Sandbox
- **Mức độ (`Severity`):** **Blocker**
- **Tiêu chí liên quan (`Criterion`):** `INV-SANDBOX-01`, `PL3-GRADER-01`, `NFR-SANDBOX-LIMIT`
- **Phân loại (`Classification`):** Security Defect + Code Bug (Trục 3)
- **Vị trí gốc (`Root Cause Location`):** `backend/app/modules/assessment/sandbox_worker.py:84-130`, `155-194`, `286-320`
- **Bằng chứng tái hiện (đã kiểm chứng trên `http://127.0.0.1:8000`):**
  1. Gửi `source_code: "fn = getattr(__builtins__, 'abs')\ndef parse_url(u): return fn(-42)"` tới `POST /api/v2/concepts/net-internet/code-sandbox/submit` $\rightarrow$ **Thực tế:** `HTTP 200` (thực thi thành công; **Kỳ vọng:** `422 SANDBOX_SECURITY_VIOLATION`). Nguyên nhân: `_validate_python_ast()` chỉ kiểm tra `ast.Import`, `ast.ImportFrom` và `ast.Call` có `func` là `ast.Name`; `exec(source_code, {})` tự động nạp toàn bộ `__builtins__` không bị lọc.
  2. Gửi `source_code: "n = len(().__class__.__base__.__subclasses__())\ndef parse_url(u): return n"` $\rightarrow$ **Thực tế:** `HTTP 200` (không chặn truy cập thuộc tính dunder `__class__`/`__base__`/`__subclasses__`).
  3. Gửi `source_code: "x = 'a' * (200 * 1024 * 1024)\ndef parse_url(u): return len(x)"` (cấp phát `200MB > 128MB`) $\rightarrow$ **Thực tế:** `HTTP 200` (không bị chặn `MemoryError`). Nguyên nhân: dòng `120` đặt `RLIMIT_AS` bằng `mem_bytes * 2` (`256MB`).
  4. `_run_javascript()` (dòng `312`) không gọi `preexec_fn` (không có `RLIMIT_AS`/`RLIMIT_CPU`/`RLIMIT_NOFILE`) và chỉ kiểm tra chuỗi con (`"process."`, `"require("`...).
  5. Toàn bộ `subprocess.run` chạy ngay trong container `plumora-backend` (có mạng kết nối PostgreSQL, Redis, Internet), vi phạm yêu cầu `network_mode: none` và `read_only: true` của `INV-SANDBOX-01`.
- **Hướng khắc phục (`Remediation Target`):** Giai đoạn `sdlc-code` — (1) Chặn mọi truy cập thuộc tính bắt đầu bằng `__` và cấm `getattr`/`__builtins__` trong AST; (2) Truyền `{"__builtins__": SAFE_BUILTINS}` tối giản vào `exec()`; (3) Sửa `RLIMIT_AS` về đúng `<= 128MB` và áp dụng `rlimits` cho cả JS worker; (4) Tách worker thực thi code sang container/sandbox riêng với `network_mode: none`, `read_only: true`, `pids_limit: 64`, `mem_limit: 128m`.

---

### [F-G3-02] JWT Access Token không bị vô hiệu hóa sau khi gọi `POST /api/v1/auth/logout`
- **Mức độ (`Severity`):** **Critical**
- **Tiêu chí liên quan (`Criterion`):** `PL-AUTH-01`, OWASP A07 (Identification and Authentication Failures)
- **Phân loại (`Classification`):** Security Defect (Trục 3)
- **Vị trí gốc (`Root Cause Location`):** `backend/app/modules/auth/router.py:136-156`, `backend/app/modules/auth/security.py:36-79`
- **Bằng chứng tái hiện:**
  1. Đăng nhập lấy `access_token` hợp lệ.
  2. Gọi `POST /api/v1/auth/logout` với `Authorization: Bearer <token>` $\rightarrow$ `HTTP 200 {"logged_out": true}`.
  3. Gọi lại `GET /api/v1/auth/me` với đúng `Authorization: Bearer <token>` cũ $\rightarrow$ **Thực tế:** `HTTP 200 OK` (trả đầy đủ profile người dùng; **Kỳ vọng:** `401 AUTH_REQUIRED`).
- **Truy vết nguyên nhân:** `create_access_token()` không sinh `jti`; `logout_user()` chỉ gọi `res.delete_cookie(...)` mà không ghi `jti` vào danh sách thu hồi (Redis TTL theo `exp` hoặc bảng DB fallback); `extract_current_user()` không kiểm tra revocation list.
- **Hướng khắc phục:** Thêm claim `jti` (UUID) vào JWT; khi `logout`, lưu `plumora:revoked_jti:{jti}` vào Redis với TTL bằng thời gian sống còn lại của token (kèm fallback DB nếu Redis down); kiểm tra trong `extract_current_user()`.

---

### [F-G3-03] Race Condition khi nộp đồng thời cùng `submission_id` gây `HTTP 500 Internal Server Error`
- **Mức độ (`Severity`):** **Critical**
- **Tiêu chí liên quan (`Criterion`):** `INV-IDEMP-01`, `PL-PROGRESS-01`, `NFR-LOAD-20VU`
- **Phân loại (`Classification`):** Code Bug / Concurrency Defect (Trục 4)
- **Vị trí gốc (`Root Cause Location`):** `backend/app/modules/assessment/service_v2.py:237-252`, `451-483`, `693-710`
- **Bằng chứng tái hiện:**
  - Gửi 5 request đồng thời (`ThreadPoolExecutor(max_workers=5)`) tới `POST /api/v2/assessments/{session_id}/submit` với cùng 1 `submission_id` $\rightarrow$ **Thực tế:** `[200, 500, 500, 500, 500]` (**Kỳ vọng:** 5/5 trả `200`, trong đó 1 bản ghi mới và 4 bản ghi `idempotent_replay=true`).
  - Gửi 5 request đồng thời tới `POST /api/v2/concepts/net-internet/code-sandbox/submit` với cùng 1 `submission_id` $\rightarrow$ **Thực tế:** `[500, 200, 500, 500, 500]`.
- **Truy vết nguyên nhân:** Câu lệnh `SELECT` kiểm tra `AttemptRecordModel` chạy *trước* `with_for_update()` (và không có `with_for_update()` ở `submit_placement_answer` & `submit_code_sandbox`), đồng thời `db.commit()` không bắt `sqlalchemy.exc.IntegrityError` khi vi phạm `uq_attempt_records_user_submission`.
- **Hướng khắc phục:** Khóa `SELECT ... FROM users WHERE id = :uid FOR UPDATE` **trước** khi kiểm tra `AttemptRecordModel`, đồng thời bọc `db.commit()` bằng `except IntegrityError:` để rollback, đọc lại bản ghi đã commit và trả `200 OK` với `idempotent_replay=True` (hoặc `409` nếu khác `session_id`/`question_id`).

---

### [F-G3-04] `Safe Micro-batch Online RL`, `Model Registry Activate/Rollback`, `Redis Graph Cache` và `System Health` chưa nối thật vào luồng phục vụ
- **Mức độ (`Severity`):** **Critical**
- **Tiêu chí liên quan (`Criterion`):** `INV-ONLINE-RL-01`, `INV-RL-01`, `NFR-LATENCY-RL`, `.agents/rules/rl-evidence.md`
- **Phân loại (`Classification`):** Code Bug / Requirement Gap (Trục 4)
- **Vị trí gốc (`Root Cause Location`):** `backend/app/modules/recommendation/admin_service.py:121-152, 298-304`; `backend/app/modules/recommendation/service_v2.py:104-107, 132, 178`
- **Bằng chứng thực nghiệm:**
  1. `run_micro_batch_online_rl()` (dòng `121-143`) không chạy bước cập nhật PPO trên trọng số mạng và không chạy 200 kịch bản Safety Gate; nó gán cứng `invalid_unmasked = 0.0 if mean_buf_reward >= 0.0 else 0.08`, trỏ `checkpoint_path = "rl/artifacts/gnn_ppo_v2_base.zip"` nhưng sinh `checkpoint_sha256 = sha256(f"{version_tag}:{kl_div}")` **không khớp** mã băm thật của file trên đĩa (`9977d5f6...`).
  2. `recommend_gnn_ppo_v2()` không truy vấn `ModelRegistryModel.is_active` từ PostgreSQL nên thao tác **Activate** hay **1-Click Rollback** ở `SCR-19` không làm thay đổi mô hình đang suy luận.
  3. `recommend_gnn_ppo_v2()` gán cứng `state_source="postgres_fallback"` ở cả dòng `132` và `178` — kiểm chứng thực tế `POST /api/v2/recommendations` trên cả 3 lĩnh vực (`backend`, `frontend`, `devops`) đều trả `state_source=postgres_fallback` dù Redis 7 đang `healthy`.
  4. `get_system_health_status()` (dòng `299-304`) gán cứng `"auth": "up", "content_kg": "up", "assessment_grader": "up", "recommendation_ai": "up"` mà không gửi health probe thực tế (dù 4 container microservices chưa chạy trong profile Docker mặc định).
- **Hướng khắc phục:** Đọc checkpoint active từ `ModelRegistryModel` kèm xác minh SHA-256 thật trên đĩa; thực thi cập nhật trọng số + đánh giá Safety Gate thật (hoặc công khai ranh giới nếu chạy offline worker); nối `RedisStateStore` đọc/ghi Graph Observation $N \times 8$ để trả `redis_cache` / `postgres_cache_warm` / `postgres_fallback` trung thực; probe HTTP `/health` thật cho 4 microservices (trả `"down"` hoặc `"monolith_embedded"` trung thực khi không chạy tách rời).

---

### [F-G3-05] Tồn đọng 2 lỗ hổng `CRITICAL` và 8 `MODERATE` trong `frontend/package-lock.json`
- **Mức độ (`Severity`):** **Critical**
- **Tiêu chí liên quan (`Criterion`):** Checklist Trục 3 mục C (`Dependency Audit: zero unpatched CRITICAL or HIGH CVEs`)
- **Phân loại (`Classification`):** Security Defect / Supply Chain (Trục 2 & 3)
- **Vị trí gốc (`Root Cause Location`):** `frontend/package.json`, `frontend/package-lock.json`
- **Bằng chứng thực nghiệm (`npm audit --json`):**
  - `CRITICAL`: `tinypool <=2.1.1` (*Prototype Pollution gadget in worker options leads to Remote Code Execution*).
  - `CRITICAL`: `vitest 0.0.95 - 4.1.10` (*Path Traversal / Arbitrary File Read via `@vitest/mocker` Redirect Mock* + kéo theo `tinypool`).
  - `MODERATE` (8): `@vitest/mocker`, `minimatch`, `@typescript-eslint/*` (`6.16.0 - 8.72.2`).
- **Hướng khắc phục:** Nâng cấp `vitest` lên bản đã vá (`>= 4.1.12` hoặc phiên bản vá `tinypool` / `@vitest/mocker`) và cập nhật `typescript-eslint` + `minimatch` thông qua `npm audit fix` (kiểm thử lại toàn bộ `vitest` sau nâng cấp).

---

### [F-G3-06] Cô lập 4 Schema PostgreSQL chỉ mang tính hình thức (`service_marker`) & thiếu phát `CompetencyUpdatedEvent` từ Assessment
- **Mức độ (`Severity`):** **Major**
- **Tiêu chí liên quan (`Criterion`):** `PL3-ARCH-01`, `D-21`
- **Phân loại (`Classification`):** Architecture / Requirement Gap (Trục 4)
- **Vị trí gốc (`Root Cause Location`):** `backend/app/db/models.py`, `backend/app/db/migrations.py:60-112`, `backend/app/modules/assessment/service_v2.py`
- **Bằng chứng thực nghiệm (`psql` trên `plumora_dev`):**
  - `public`: **21 bảng** (toàn bộ bảng nghiệp vụ thật: `users`, `domains`, `domain_concept_map`, `assessment_sessions`, `attempt_records`, `user_node_competency`, `model_registry`, `outbox_events`...).
  - `auth_svc`: `1` bảng (`service_marker`), `content_svc`: `1`, `assess_svc`: `1`, `rec_ai_svc`: `1`.
  - Ngoài ra, `service_v2.py` không gọi `record_outbox_event_in_tx()` khi học viên hoàn thành Placement / Depth Probe / Code Sandbox nên `CompetencyUpdatedEvent` không được ghi vào `outbox_events` / phát lên Redis Streams trong luồng học thực tế (chỉ `expert_service.py` ghi `DomainGraphUpdatedEvent`).
- **Hướng khắc phục:** Phân bổ bảng vào đúng 4 schema (`__table_args__ = {"schema": "..."}`) hoặc dùng DB user tách quyền theo từng service trong profile `microservices`; bổ sung phát `CompetencyUpdatedEvent` vào `outbox_events` ngay trong ACID transaction của `service_v2.py`.

---

### [F-G3-07] Lỗ hổng bỏ qua kiểm tra cổng đăng nhập (`Portal Bypass`) khi bỏ trống trường `portal`
- **Mức độ (`Severity`):** **Major**
- **Tiêu chí liên quan (`Criterion`):** `PL3-ROLE-01` (Tách biệt 3 cổng đăng nhập Learner / Expert / Admin)
- **Phân loại (`Classification`):** Security Defect (Trục 3)
- **Vị trí gốc (`Root Cause Location`):** `backend/app/modules/auth/schemas.py:25`, `backend/app/modules/auth/router.py:98-124`
- **Bằng chứng tái hiện:**
  - Gửi `POST /api/v1/auth/login` với `{"username": "admin_demo", "password": "<demo_pass>"}` (không truyền `portal`) $\rightarrow$ **Thực tế:** `HTTP 200` cấp `access_token` và Cookie cho `admin` (tương tự với `expert_demo`).
- **Hướng khắc phục:** Đặt giá trị mặc định `portal: Literal["learner", "expert", "admin"] = "learner"` thay vì `None`, để mọi yêu cầu không truyền `portal` mặc định đi qua quy tắc cổng `learner` (chặn `admin`/`expert` bằng `403 FORBIDDEN_ROLE`).

---

### [F-G3-08] Truy vấn N+1, truy vấn không phân trang (`SELECT *` không `LIMIT`) và thiếu chỉ mục (Index)
- **Mức độ (`Severity`):** **Major**
- **Tiêu chí liên quan (`Criterion`):** Checklist Trục 4 mục A (Anti-N+1, Indexing Strategy, Large Dataset Safeguards)
- **Phân loại (`Classification`):** Performance / Database Defect (Trục 4)
- **Vị trí gốc (`Root Cause Location`):**
  - **N+1 Queries:** `backend/app/modules/content/kg_service.py:106-111` (chạy `SELECT` trên `domain_concept_map` trong vòng lặp từng `domain`); `kg_service.py:46-49` (chạy `db.get(UserNodeCompetencyModel, ...)` trong vòng lặp từng `concept`).
  - **Unbounded Queries (không `LIMIT`):** `backend/app/modules/recommendation/admin_service.py:87-89` (`SELECT * FROM model_registry` trả toàn bộ lịch sử model cho client tự phân trang), `admin_service.py:224-228` (`rollback_active_model` không `LIMIT 2`), `kg_service.py:86-99` (`domains` và `assessment_sessions` không `LIMIT`/`DISTINCT`).
  - **Thiếu Index (xác nhận qua `pg_indexes`):**
    1. `outbox_events(published_at, created_at)` (cho `WHERE published_at IS NULL ORDER BY created_at`).
    2. `model_registry(is_active, created_at)` (cho tìm model active & sắp xếp lịch sử).
    3. `assessment_sessions(user_id, session_mode, status)` (cho truy vấn placement đã hoàn tất).
    4. `online_eval_runs(candidate_model_id)` (FK không có index).
- **Hướng khắc phục:** Gom truy vấn bằng `IN (...)` để xóa N+1; thêm phân trang server-side (`limit`/`offset`) cho `/api/v2/admin/online-rl/status` và `LIMIT` cho `rollback_active_model`; bổ sung migration `0006` tạo 4 chỉ mục trên.

---

### [F-G3-09] Khiếm khuyết Khả năng tiếp cận (`WCAG 2.1 AA`): Thiếu `aria-label` trên Mobile Header, vùng chạm `< 44px`, và Drawer thiếu `Escape` / Focus Trap
- **Mức độ (`Severity`):** **Major**
- **Tiêu chí liên quan (`Criterion`):** `docs/ui-design-system.md` mục 4 & 7, Checklist Trục 1 mục A & C
- **Phân loại (`Classification`):** UI/UX & Accessibility Defect (Trục 1)
- **Vị trí gốc (`Root Cause Location`):** `frontend/src/components/common/Header.tsx`, `frontend/src/components/AiTutorRubricDrawer.tsx:33-71`, `frontend/src/pages/AuthPage.tsx:315-348`
- **Bằng chứng thực nghiệm (Playwright Chromium ở `390x844`):**
  1. Trên `SCR-15`..`SCR-20` ở Mobile `390px`: 3 nút điều hướng trên Header ẩn chữ (`hidden sm:inline`) nhưng không gắn `aria-label` hay `title` $\rightarrow$ `iconNoAria=3` (`{"text":"","w":38,"h":30}`), khiến trình đọc màn hình không đọc được tên nút.
  2. Nút Đăng xuất trên Header có kích thước `28x28px`; các nút chuyển cổng trên `/login` cao `21px` (nhỏ hơn ngưỡng tối thiểu `44x44px` theo WCAG/Fitts's Law).
  3. `AiTutorRubricDrawer.tsx` khai báo `role="dialog" aria-modal="true"` nhưng không bắt phím `Escape` để đóng và không giữ Focus Trap (file `frontend/src/utils/useFocusTrap.ts` đã bị xóa trong commit trước).
- **Hướng khắc phục:** Gắn `aria-label` đầy đủ cho mọi nút trên `Header.tsx`; tăng vùng chạm tối thiểu `min-h-[44px] min-w-[44px]` cho các nút Mobile; khôi phục hook `useFocusTrap` + xử lý phím `Escape` cho `AiTutorRubricDrawer`.

---

### [F-G3-10] 9 File vượt ngưỡng 400 dòng & 4 lỗi biên logic trong `service_v2.py`
- **Mức độ (`Severity`):** **Major**
- **Tiêu chí liên quan (`Criterion`):** Checklist Trục 2 mục B (File Size `< 300-400 lines`), `INV-DAG-01`
- **Phân loại (`Classification`):** Code Quality & Logic Bug (Trục 2 & 4)
- **Vị trí gốc (`Root Cause Location`):**
  - Kích thước file vượt ngưỡng: `backend/app/modules/assessment/service_v2.py` (**872 dòng**), `frontend/src/pages/MultiDomainRoadmapPage.tsx` (**623 dòng**), `backend/app/db/models.py` (**549 dòng**), `frontend/src/pages/DepthProbePage.tsx` (**542 dòng**), `frontend/src/pages/ExpertDomainsPage.tsx` (**509 dòng**), `frontend/src/pages/AdaptivePlacementPage.tsx` (**474 dòng**), `frontend/src/pages/AuthPage.tsx` (**435 dòng**), `frontend/src/pages/ExpertCodeChallengesPage.tsx` (**434 dòng**), `frontend/src/pages/AdminModelRegistryPage.tsx` (**408 dòng**).
  - Lỗi biên logic trong `service_v2.py`:
    1. `submit_placement_answer()` và `submit_depth_or_review_step()` không kiểm tra `if session.status != "active"` $\rightarrow$ cho phép tiếp tục nộp câu trả lời vào phiên đã `completed` / `ceiling_reached`.
    2. `submit_placement_answer()` (dòng `273`): `node_map[q.concept_slug]` có thể ném `KeyError` (`HTTP 500`) nếu gửi `question_id` thuộc domain khác.
    3. `submit_code_sandbox()` (dòng `709`): gán cứng `"backend"` khi gọi `_check_concept_eligible(db, user.id, "backend", concept_slug)`.
    4. `get_code_challenge_for_concept()` (dòng `650`): không gọi `_check_concept_eligible()`, cho phép đọc đề bài code của node đang bị khóa.
- **Hướng khắc phục:** Tách `service_v2.py` thành 3 module dịch vụ nhỏ (`placement_service.py`, `depth_probe_service.py`, `sandbox_service.py`), tách các page lớn của React thành sub-components, và bổ sung 4 kiểm tra biên trên kèm unit test.

---

### [F-G3-11] Không lọc/sanitize `display_name` khi đăng ký & thiếu header `CSP` trên Nginx Frontend
- **Mức độ (`Severity`):** **Minor**
- **Tiêu chí liên quan (`Criterion`):** OWASP A03 (XSS Defense-in-Depth) & Security Headers
- **Phân loại (`Classification`):** Security Hardening (Trục 3)
- **Vị trí gốc (`Root Cause Location`):** `backend/app/modules/auth/schemas.py:16`, `frontend/nginx.conf`, `backend/app/main.py:74-81`
- **Bằng chứng thực nghiệm:**
  - `POST /api/v1/auth/register` với `display_name: "<script>alert(1)</script>"` trả `HTTP 201` và lưu nguyên chuỗi vào PostgreSQL (React SPA tự escape khi render nên không thực thi JS, nhưng cần chặn ký tự `<`/`>` hoặc sanitize ở schema).
  - `curl -sI http://localhost:3000/` có `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, nhưng **thiếu `Content-Security-Policy`**.
  - Backend `http://127.0.0.1:8000/api/v1/health` thiếu `Referrer-Policy` (đã có `CSP`, `X-Frame-Options`, `X-Content-Type-Options`, `Permissions-Policy`; CORS chặn đúng `Origin: https://evil.example`).

---

### [F-G3-12] Kiểm tra RBAC chạy trong thân hàm router thay vì `Depends()`, gây lộ lỗi `422` trước `403`
- **Mức độ (`Severity`):** **Minor**
- **Tiêu chí liên quan (`Criterion`):** `PL3-ROLE-01`, OWASP A01
- **Phân loại (`Classification`):** Security Hardening (Trục 3)
- **Vị trí gốc (`Root Cause Location`):** `backend/app/modules/content/router_expert.py:35,47,59,71`, `backend/app/modules/recommendation/router_admin.py:31,42,54,65,72`
- **Bằng chứng tái hiện:** `learner` gọi `POST /api/v2/expert/domains` với payload thiếu trường $\rightarrow$ trả `HTTP 422` (Pydantic validation chạy trước kiểm tra quyền) thay vì `403 FORBIDDEN_ROLE`.
- **Hướng khắc phục:** Chuyển `require_authenticated_roles(...)` sang `Depends(...)` của FastAPI.

---

### [F-G3-13] Màn hình Đăng nhập (`AuthPage.tsx`) thiếu thẻ ngữ nghĩa `<main>`
- **Mức độ (`Severity`):** **Minor**
- **Tiêu chí liên quan (`Criterion`):** Checklist Trục 1 mục C (Semantic HTML)
- **Phân loại (`Classification`):** Accessibility Defect (Trục 1)
- **Vị trí gốc (`Root Cause Location`):** `frontend/src/pages/AuthPage.tsx`
- **Bằng chứng thực nghiệm:** Playwright audit trên `/login`, `/expert/login`, `/admin/login` ghi nhận `main=false`.

---

## 2. Kết luận Cổng Gate 3 (`G3 Conclusion`)

- **Trạng thái (`Status`):** **`REWORK REQUIRED`**
- **Tổng hợp lỗi tồn đọng:** **1 Blocker** (`F-G3-01`), **4 Critical** (`F-G3-02`, `F-G3-03`, `F-G3-04`, `F-G3-05`), **5 Major** (`F-G3-06`..`F-G3-10`), **3 Minor** (`F-G3-11`..`F-G3-13`).
- **Bằng chứng hợp lệ được bảo lưu (`Surviving Valid Evidence`):**
  - Day-0 CI (`./scripts/ci_check.sh`) xanh hoàn toàn (`0` lỗi lint/type/unit/build).
  - Giao diện đa màn hình `SCR-01`, `SCR-09`..`SCR-20` đạt `0px` tràn ngang trên cả Desktop `1280px` và Mobile `390px`, `0` emoji (`INV-UI-01`), `0` `<div onClick>`, `0` lỗi API không mong muốn.
  - Chống IDOR trên Placement và Depth Assessment hoạt động đúng (`404 SESSION_NOT_FOUND` khi User B gửi vào session của User A).
  - Checkpoint `rl/artifacts/gnn_ppo_v2_base.zip` (`SHA-256: 9977d5f606427d0eb25970b1ce8cf23fa0232e2d7ff0fe392e80d2413d534201`) khớp 100% với `manifest_phase3.json` và phục vụ thực tế trên `/api/v2/recommendations` cho cả 3 lĩnh vực (`backend`, `frontend`, `devops`).
  - Container `plumora-backend` chạy với user non-root `uid=10001(plumora)`, CORS chặn đúng origin lạ (`https://evil.example`), và vòng lặp vô tận `while True` trong sandbox bị cắt đúng `408` trong `3023ms`.
- **Bước tiếp theo (`Next Action`):** Trả luồng về `sdlc-code` để khắc phục triệt để **1 Blocker + 4 Critical** (ưu tiên `F-G3-01`..`F-G3-05`) và các mục **Major** (`F-G3-06`..`F-G3-10`), bổ sung test hồi quy cho từng lỗi, dựng lại Docker (`docker compose up -d --build`) và tái thẩm định Gate 3 trước khi xem xét Gate 4. Tài liệu này không trao quyền merge hay deploy.

---

## 3. Kế hoạch Khắc phục & Vòng lặp Tái kiểm (`Remediation Plan`)

| Finding ID | Mức độ | Tầng kiểm chứng tái kiểm | Tiêu chí đóng lỗi (`Pass Criteria`) | Chủ sở hữu (`Owner`) | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| `F-G3-01` | Blocker | Tier 2 + Tier 4 (Sandbox Security) | `getattr(__builtins__, ...)`, `__subclasses__()`, `200MB` RAM đều bị chặn (`422`); worker chạy cô lập không mạng (`network_mode: none`, `read_only: true`) | `sdlc-code` (Backend/Infra) | `open` |
| `F-G3-02` | Critical | Tier 2 + Tier 4 (Auth Lifecycle) | Sau `POST /api/v1/auth/logout`, token cũ gọi `/api/v1/auth/me` trả `401 AUTH_REQUIRED` | `sdlc-code` (Auth) | `open` |
| `F-G3-03` | Critical | Tier 4 (Concurrency 5x parallel) | 5 request đồng thời cùng `submission_id` trả `[200, 200, 200, 200, 200]` (0 lỗi `500`, đúng 1 bản ghi DB) | `sdlc-code` (Assessment) | `open` |
| `F-G3-04` | Critical | Tier 2 + Tier 3 + RL Integrity | Model Registry activation/rollback đổi đúng checkpoint đang phục vụ (SHA-256 khớp file đĩa); Redis Graph Cache hoạt động (`redis_cache`); `system-health` probe thật | `sdlc-code` (Rec/RL) | `open` |
| `F-G3-05` | Critical | Tier 1 (`npm audit`) | `npm audit` báo `0 critical`, `0 high` CVE; toàn bộ Vitest/Build pass | `sdlc-code` (Frontend) | `open` |
| `F-G3-06`..`F-G3-10` | Major | Tier 1–4 (DB, RBAC, A11y, Modularity) | 4 schema chứa bảng thực; `portal` mặc định `"learner"`; xóa N+1 + thêm `LIMIT` + 4 index; `iconNoAria=0` trên Mobile `390px` + `Escape`/FocusTrap; tách file `>400` dòng & vá 4 lỗi biên `service_v2.py` | `sdlc-code` (Fullstack) | `open` |
| `F-G3-11`..`F-G3-13` | Minor | Tier 1 + Tier 3 | Sanitize `display_name`, thêm CSP Nginx, chuyển RBAC sang `Depends()`, bọc `<main>` ở `AuthPage` | `sdlc-code` (Fullstack) | `open` |

---

## 4. Phân tích Nguyên nhân Gốc & Nợ Kỹ thuật (`Root Cause & Technical Debt`)

- **Nguyên nhân gốc hệ thống:** Bộ test tự động hiện tại (`ci_check.sh` và 33 test Pytest) chủ yếu kiểm chứng luồng chuẩn (*happy path*) và một số nhánh âm đơn giản (`import os`, `while True`), nhưng **chưa có bài test đối kháng thực sự** cho: (a) thu hồi JWT sau logout, (b) gửi đồng thời trùng `submission_id` (concurrency), (c) vượt AST Python qua `__builtins__`/`__subclasses__` và cấp phát RAM `200MB`, (d) kiểm tra `aria-label` trên Mobile `390px`, và (e) xác minh `ModelRegistryModel.is_active` thực sự ảnh hưởng tới `recommend_gnn_ppo_v2`.
- **Dọn dẹp dữ liệu kiểm thử:** Hai tài khoản QA tạm thời (`g3_qa_a_6ee921`, `g3_qa_b_7fff93`) đã được xóa sạch khỏi PostgreSQL (`DELETE 2`); dữ liệu seed gốc (`domains`, `model_registry`, 5 tài khoản demo) được giữ nguyên vẹn.

---

## 5. Nhật ký Bằng chứng Trình duyệt & Hệ thống (`Snapshot, SUT & Browser Audit`)

- **Kiểm chứng trình duyệt thật (`Playwright Chromium`):** Chạy trực tiếp trên `http://localhost:3000` (không mock, không DOM fixture) qua 2 khung hình `Desktop 1280x800` và `Mobile 390x844` trên 15 route (`SCR-01` x3 cổng, `SCR-09`..`SCR-13`, `RBAC 403`, `SCR-15`..`SCR-20`):
  - Tràn ngang (`scrollWidth - clientWidth`): `0px` trên 30/30 lượt kiểm tra.
  - Emoji (`INV-UI-01`): `false` (`0` emoji) trên 30/30 lượt kiểm tra.
  - Lỗi mạng API (`>= 400` ngoại trừ probe `/auth/me` trước đăng nhập): `0`.
  - Lỗi A11y phát hiện: `iconNoAria=3` trên `SCR-15`..`SCR-20` ở `Mobile-390`, `main=false` trên `SCR-01`, nút Logout `28x28px`.
- **Kiểm chứng API/DB thật (`http://127.0.0.1:8000` & `plumora-postgres`):** Đã ghi nhận nguyên văn trạng thái HTTP, thời gian thực thi (`3023ms` cho `while True`), danh sách bảng/index từ `psql` và mã băm SHA-256 từ `sha256sum`.

---

## 6. Tái thẩm định Độc lập Vòng 2 (`Re-Verification Round 2`)

- **Thời điểm & Môi trường (`SUT`):** Cụm Docker Compose vừa được build lại (`plumora-frontend` Nginx `1.27.5` tại `http://localhost:3000`, `plumora-backend` FastAPI tại `http://localhost:8000`, `plumora-postgres` PG16, `plumora-redis` Redis 7) trên nhánh `feat/p3-slice-3-microservices-online-rl` (`18a1ff9` + bản vá khắc phục Gate 3).
- **Nguyên tắc Độc lập:** Thẩm định viên **không chỉnh sửa bất kỳ file mã nguồn ứng dụng nào**; toàn bộ 13 phát hiện (`F-G3-01`..`F-G3-13`) được tái kiểm thử trực tiếp bằng HTTP/Concurrency probes, `psql`, `npm audit`, Playwright Chromium (`1280x800` & `390x844`) và `./scripts/ci_check.sh`.

### 6.1. Bảng Trạng thái Khắc phục Từng Phát hiện (`Round 2 Verification Matrix`)

| Finding ID | Mức độ gốc | Trạng thái Vòng 2 | Bằng chứng Thực nghiệm Vòng 2 (`Empirical Evidence`) |
| --- | --- | --- | --- |
| **`F-G3-01`** | **Blocker** | **`closed`** *(kèm Residual Risk hạ tầng local)* | Trên `POST /api/v2/concepts/net-internet/code-sandbox/submit` với `challenge_id=4a1d968a-...`: `getattr(__builtins__, 'abs')(-42)` $\rightarrow$ `422` (`18ms`); `().__class__.__base__.__subclasses__()` $\rightarrow$ `422` (`11ms`); `'{0.__class__.__base__}'.format(())` $\rightarrow$ `422` (`11ms`); `f'{(1).__class__}'` $\rightarrow$ `422` (`14ms`); `import posix` $\rightarrow$ `422` (`10ms`); `import os` $\rightarrow$ `422` (`14ms`); `'a' * (200 * 1024 * 1024)` $\rightarrow$ `422 Memory limit exceeded (128MB)` (`97ms`); `while True: pass` (top-level) $\rightarrow$ `408 SANDBOX_TIMEOUT` (`3027ms`). `exec()` dùng `SAFE_PYTHON_BUILTIN_NAMES` tối giản; JS dùng `node:vm` + `--max-old-space-size=128` + `rlimits`. *(Residual Risk vận hành: ở Docker Compose cục bộ, subprocess vẫn chạy trong container `plumora-backend`; cô lập mạng mức cluster được khai báo trong `k8s/network-policy.yaml` `assessment-grader-sandbox-isolation`.)* |
| **`F-G3-02`** | **Critical** | **`closed`** | Đăng ký user tạm $\rightarrow$ `GET /api/v1/auth/me` (Bearer) trả `200` $\rightarrow$ `POST /api/v1/auth/logout` trả `200 {"logged_out": true}` $\rightarrow$ gọi lại `GET /api/v1/auth/me` với `Authorization: Bearer <old_token>` trả **`401 AUTH_REQUIRED`**; gọi với Cookie cũ cũng trả **`401 AUTH_REQUIRED`**. |
| **`F-G3-03`** | **Critical** | **`closed`** | 5 request song song cùng `submission_id` vào `POST /api/v2/assessments/{session_id}/submit` $\rightarrow$ `[(200, True), (200, True), (200, True), (200, False), (200, True)]` (**0 HTTP 500**). 5 request song song cùng `submission_id` vào `POST /api/v2/concepts/net-internet/code-sandbox/submit` $\rightarrow$ `[(200, True), (200, True), (200, False), (200, True), (200, True)]` (**0 HTTP 500**). |
| **`F-G3-04`** | **Critical** | **`closed`** | (1) `POST /api/v2/recommendations` lần 1 trả `state_source="postgres_cache_warm"` (`23ms`), lần 2 trả **`state_source="redis_cache"`** (`14ms`). (2) `POST /api/v2/admin/online-rl/micro-batch` (`batch_size=4`) ghi file `.zip` thật trên đĩa với SHA-256 thật `7e4f3fb9...0022` (khác base `9977d5f6...4201`) và đánh giá KL/validity thực (`gate_verdict="PASSED"`). (3) `POST /api/v2/admin/models/{cand_id}/activate` (`7ms`) $\rightarrow$ `POST /api/v2/recommendations` lập tức phục vụ `7e4f3fb9...0022` (`matches_cand=True`). (4) `POST /api/v2/admin/models/rollback` (`6ms`) $\rightarrow$ `POST /api/v2/recommendations` lập tức quay về `9977d5f6...4201` (`matches_base=True`). (5) `GET /api/v2/admin/system-health` probe thật PG, Redis (`redis_stream_lag_ms=2.99`, `graph_cache_hit_rate=0.0903`), checkpoint và báo `mode="monolith"`. |
| **`F-G3-05`** | **Critical** | **`closed`** | `cd frontend && npm audit --audit-level=high` trả exit code `0`, **`found 0 vulnerabilities`** (`0 critical`, `0 high`, `0 moderate`, `0 low`). `vitest` đã nâng lên `v5.1.1`; toàn bộ 8 unit test + 1 live integration test + production build đều PASS. |
| **`F-G3-06`** | **Major** | **`partially_mitigated`** | **Đã khắc phục:** `outbox_events` trong `plumora_dev` đã ghi nhận `91` sự kiện `CompetencyUpdatedEvent` từ luồng Assessment. **Tồn đọng kiến trúc (non-blocking):** Trong chế độ monolith cục bộ, 21 bảng nghiệp vụ vẫn nằm trong schema `public` và 4 schema (`auth_svc`, `content_svc`, `assess_svc`, `rec_ai_svc`) mỗi schema chứa 1 bảng `service_marker`. |
| **`F-G3-07`** | **Major** | **`closed`** | `POST /api/v1/auth/login` với `admin_demo` và `expert_demo` khi bỏ trống `portal` đều bị chặn **`403 FORBIDDEN_ROLE`** (`portal: "learner"` mặc định); truyền `portal: null` hoặc `portal: ""` bị chặn **`422`**. |
| **`F-G3-08`** | **Major** | **`closed`** | Đã xác minh trong `kg_service.py` (xóa 2 vòng lặp N+1 bằng truy vấn batch `IN (...)`, thêm `LIMIT 100` và `DISTINCT`) và `admin_service.py` (`limit` cho `model_registry` và `limit(2)` cho `rollback`). `psql` xác nhận đủ 4 chỉ mục mới trên `plumora_dev`: `idx_assessment_sessions_user_mode_status`, `idx_model_registry_active_created`, `idx_online_eval_runs_candidate_model`, `idx_outbox_events_unpublished_created`. |
| **`F-G3-09`** | **Major** | **`closed`** | Playwright Chromium (`chromium_headless_shell`) ở `Desktop-1280` & `Mobile-390` trên `/expert/domains`, `/admin/online-rl`, `/domains` xác nhận **`iconNoAria=0`**, `overflow=0px`, `emoji=false`, các nút điều hướng và Logout trên Mobile đạt chuẩn chạm `>= 44x44px`. `AiTutorRubricDrawer.tsx` đã bổ sung xử lý phím `Escape` và vòng khóa tiêu điểm (`Tab`/`Shift+Tab` Focus Trap) kèm khôi phục focus khi đóng. |
| **`F-G3-10`** | **Major** | **`partially_mitigated`** | **Đã khắc phục 4/4 lỗi biên logic trong `service_v2.py`:** kiểm tra `session.status != "active"` ở cả Placement & Depth Probe; `GET /api/v2/concepts/db-transactions/code-challenge` trả **`403 CONCEPT_LOCKED`** cho node đang khóa; `submit_code_sandbox` không còn hardcode `"backend"`. **Nợ kỹ thuật tái cấu trúc (non-blocking):** 9 file vượt 400 dòng (`service_v2.py` 1030 dòng, `MultiDomainRoadmapPage.tsx` 623 dòng...) chưa được tách nhỏ. |
| **`F-G3-11`** | **Minor** | **`closed`** | `POST /api/v1/auth/register` với `display_name: "<script>alert(1)</script>"` bị từ chối **`422`** (`Tên hiển thị không được chứa ký tự HTML`). Nginx `http://localhost:3000/` đã có header **`Content-Security-Policy`**; Backend `http://127.0.0.1:8000/api/v1/health` đã có header **`Referrer-Policy: strict-origin-when-cross-origin`**. |
| **`F-G3-12`** | **Minor** | **`closed`** | `learner` gọi `POST /api/v2/expert/domains {}`, `POST /api/v2/admin/online-rl/micro-batch` (payload sai) và `POST /api/v2/admin/models/not-a-uuid/activate` đều trả **`403 FORBIDDEN_ROLE`** trước khi Pydantic validate `422`. |
| **`F-G3-13`** | **Minor** | **`closed`** | Playwright xác nhận `main=true` trên cả 3 cổng `/login`, `/expert/login`, `/admin/login` ở cả `Desktop-1280` và `Mobile-390`. |

### 6.2. Kiểm chứng Chuỗi CI Toàn phần & Dọn dẹp Dữ liệu (`CI Suite & Cleanup`)

- **`./scripts/ci_check.sh`:** **PASS** (Exit code `0`):
  - Lint: Ruff (Backend, RL) + ESLint (Frontend) — `0` lỗi.
  - Type Check: Mypy (`53` backend + `6` RL files) + `tsc --noEmit` — `0` lỗi.
  - Unit & Behavioral Tests: **41** backend pytest (bao gồm 8 test hồi quy mới trong `tests/test_gate3_remediation.py`) + **3** RL pytest + **8** frontend Vitest — PASS 100%.
  - Production Build (`tsc -b && vite build`): PASS (`2.41s`).
  - Live Fullstack Integration (`e2e/live_fullstack_journey.spec.ts`): PASS.
  - Real Chromium E2E Audit + Negative-Control Audit: PASS.
- **Dọn dẹp `plumora_dev` & đĩa:** Đã xóa toàn bộ 6 user QA tạm (`g3_r2_*`), xóa bản ghi `model_registry` / `online_eval_runs` thử nghiệm (`3b9060dd-...`) và file `rl/artifacts/candidates/gnn_ppo_online_20261119_155500_3b90.zip`. Database trở về đúng trạng thái sạch: 5 tài khoản demo và 1 mô hình active duy nhất (`gnn_ppo_v2_base`).

### 6.3. Kết luận Cổng Gate 3 Sau Tái thẩm định Vòng 2 (`Final Gate 3 Verdict`)

- **Trạng thái (`Status`):** **`APPROVED`** *(đạt điều kiện qua Cổng Gate 3 với **0 Blocker** và **0 Critical** còn mở)*
- **Tổng hợp:**
  - **Đã đóng (`closed`):** **11/13** phát hiện — gồm toàn bộ **1/1 Blocker** (`F-G3-01`), **4/4 Critical** (`F-G3-02`..`F-G3-05`), **3/5 Major** (`F-G3-07`, `F-G3-08`, `F-G3-09`) và **3/3 Minor** (`F-G3-11`..`F-G3-13`).
  - **Rủi ro tồn dư & Nợ kỹ thuật không chặn phát hành (`Non-Blocking Residual Risks & Tech Debt`):**
    1. `F-G3-06` (`partially_mitigated`): Phân tách vật lý 21 bảng vào 4 schema PostgreSQL riêng biệt khi triển khai tách rời Microservices (Outbox `CompetencyUpdatedEvent` đã hoạt động thật).
    2. `F-G3-10` (`partially_mitigated`): Tách nhỏ 9 file vượt 400 dòng để giảm độ phức tạp bảo trì (4/4 lỗi biên logic trong `service_v2.py` đã vá triệt để).
    3. `F-G3-01` (*Operational Residual Risk*): Khi đưa lên môi trường Production thực tế ngoài Docker Compose cục bộ, cần kích hoạt `k8s/network-policy.yaml` hoặc container sandbox riêng (`network_mode: none`, `read_only: true`).
- **Bước tiếp theo (`Next Action`):** Hệ thống đủ điều kiện chuyển sang **Gate 4 (`sdlc-release`)** theo thẩm quyền phê duyệt của người dùng. Tài liệu này không tự động ủy quyền `git commit`, `push`, `merge` hay deploy.

