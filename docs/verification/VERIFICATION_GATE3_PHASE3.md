# Biên bản Thẩm định Độc lập Gate 3 — Giai đoạn 3 (`v2.0.0`)

- **Ngày thẩm định:** 2026-11-19
- **Nhánh đánh giá:** `feat/p3-slice-3-microservices-online-rl`
- **Tài liệu chuẩn đối chiếu:** `docs/spec.md` (`v2.0.0`), `docs/design.md` (`v2.0.0`), `docs/ui-design-system.md` (`v2.0.0`), `HANDOFF_P3_SLICE_01..03.md`, `P3_SLICE_4_LOAD_AND_CONSISTENCY_REPORT.md`
- **Phương thức:** Review độc lập 4 trục trên mã nguồn thực tế (Read-only, không chỉnh sửa mã nguồn) kết hợp subagent `Adversarial Gate 3 Reviewer` (`855b41b1`) và chạy lại toàn bộ `./scripts/ci_check.sh`.

---

## Kết luận Gate 3: **`APPROVED`**
*(0 Blocker, 0 Critical, 3 Major, 3 Minor — Đạt chuẩn chuyển sang Gate 4 Đóng gói Bảo vệ Đồ án; 3 mục Major được ghi nhận minh bạch làm nợ kỹ thuật / hướng nâng cấp hậu bảo vệ).*

---

## 1. Thẩm định Trục 1 — UI/UX (`INV-UI-01`, `SCR-01`..`SCR-20`, RBAC Route Guard)
- **Độ phủ 20 màn hình:** Đủ 100% 20 màn hình theo thiết kế `D-26`:
  - `SCR-01`..`SCR-08` (MVP): `AuthPage`, `RoadmapPage`, `LessonPage`, `QuizPage`, `PresetModal`, `ProvenanceDrawer`, `LockedAlert`, `AttemptHistoryModal`.
  - `SCR-09`..`SCR-14` (`Learner` mở rộng): `MultiDomainHubPage`, `AdaptivePlacementPage`, `MultiDomainRoadmapPage`, `DepthProbePage`, `CodeSandboxPage`, `AiTutorRubricDrawer`.
  - `SCR-15`..`SCR-17` (`Expert`): `ExpertDomainsPage`, `ExpertQuestionsPage`, `ExpertCodeChallengesPage`.
  - `SCR-18`..`SCR-20` (`Admin`): `AdminOnlineRlPage`, `AdminModelRegistryPage`, `AdminSystemHealthPage`.
- **Kiểm tra `INV-UI-01` & Hệ màu Botanical Sprout:** Quét toàn bộ `.ts/.tsx/.css` trong `frontend/src/`: **`0` ký tự Unicode Emoji**, **`0` mã màu tím**, 100% dùng SVG `lucide-react`.
- **Kiểm tra `Header.tsx` & `App.tsx`:** `Header.tsx` chỉ hiển thị nút `Cổng Chuyên gia` cho `user.role === 'expert'` và `Cổng Admin` cho `user.role === 'admin'`.
  - **[Minor-1]** `App.tsx` chưa có inline guard kiểm tra `user.role` trước khi mount `Expert*Page` / `Admin*Page` theo `activeView` (hiện dựa vào `Header.tsx` + backend `403 FORBIDDEN_ROLE`).

---

## 2. Thẩm định Trục 2 — Code Quality, 4 Microservices & Design Patterns
- **4 Microservices + API Gateway (`backend/services/`):** Đầy đủ `user_auth_service.py` (8001), `content_kg_service.py` (8002), `assessment_grader_service.py` (8003), `recommendation_ai_service.py` (8004) và `api_gateway.py` (8000 với `httpx.AsyncClient` keep-alive pool).
- **Docker Compose & Kubernetes (`k8s/`):** `docker-compose.microservices.yml` và 5 file `k8s/` (`namespace.yaml`, `postgres-redis.yaml`, `microservices.yaml`, `hpa.yaml`, `network-policy.yaml`) cấu hình chuẩn `readinessProbe`, `runAsNonRoot: true`, `NetworkPolicy` và `HPA` (1–4 replicas).
- **Design Patterns:** Đã kiểm chứng đúng cấu trúc `5-Depth State Machine` (`depth_state_machine.py`), `Adapter + Circuit Breaker` (`rubric_grader.py`), `Transactional Outbox` (`outbox.py`) và `Policy Guardrail` (`recommendation_v2/service.py`).
- **Kết quả `./scripts/ci_check.sh` (chạy lại độc lập — Exit `0`):**
  - Lint & Typecheck: Ruff, ESLint, Mypy (`72` file Backend, `13` file RL), TSC — **0 lỗi**.
  - Tests: Backend **`49/49` pytest**, RL **`12/12` pytest**, Frontend **`18/18` Vitest**, Production Build + Live Integration + 3 Real Chromium E2E Audits (`audit_mvp_hardening.cjs`, `audit_product_realism.cjs`, `audit_p3_slice1.cjs`) & Negative Control — **100% PASSED**.

---

## 3. Thẩm định Trục 3 — Security (`INV-SANDBOX-01`, `PL3-ROLE-01`, Anti-IDOR)
- **RBAC & Anti-IDOR:** `rbac.py` chặn trái quyền với `401` / `403 FORBIDDEN_ROLE`; `assessment_v2/service.py` kiểm tra `session.user_id != user.id` chống IDOR.
- **Code Sandbox (`sandbox_worker.py`):** Python chạy qua `python3 -I` với AST blocklist (`socket`, `os`, `subprocess`, `open`, `eval`, `exec`, v.v.), `env={}`, `RLIMIT_AS`/`RLIMIT_CPU`/`RLIMIT_NOFILE` và cắt vòng lặp vô hạn $\le 3000\text{ms}$ (`408 SANDBOX_TIMEOUT`).
  - **[Major-1]** Nhánh `_run_javascript` kiểm tra chuỗi API cấm và `timeout` nhưng chưa gắn `preexec_fn=_apply_posix_rlimits` như nhánh Python.
  - **[Minor-2]** AST blocklist Python chưa chặn phản chiếu thuộc tính (`getattr`, `__subclasses__`); nhánh SQL chưa giới hạn CPU cho CTE đệ quy.

---

## 4. Thẩm định Trục 4 — Database & AI/RL (`PL3-ARCH-01`, `INV-DEPTH-01`, `INV-ONLINE-RL-01`)
- **Database 4 Schema & Outbox:** Migration `0005` tạo 4 schema (`auth_svc`, `content_svc`, `assess_svc`, `rec_ai_svc`) và 4 role bị `REVOKE ALL` chéo schema (đã kiểm chứng thực tế trên PostgreSQL 16 trong `test_microservices_outbox_streams.py`).
  - **[Major-2]** Các bảng ORM nghiệp vụ trong `models.py` vẫn nằm trong schema mặc định `public` và `docker-compose.microservices.yml` dùng chung credential `plumora_app` (cô lập vật lý toàn bộ bảng vào 4 schema thuộc bước *Contract* nâng cao).
  - **[Minor-3]** `consume_competency_event_idempotent` dùng kiểm tra trước rồi mới insert thay vì `ON CONFLICT DO NOTHING` ở mức SQL.
- **AI/RL (`GNN-PPO`, `Safety Gate`, `1-Click Rollback`):**
  - `sha256sum rl/artifacts/gnn_ppo_v2_base.zip` khớp chính xác `9977d5f606427d0eb25970b1ce8cf23fa0232e2d7ff0fe392e80d2413d534201` trong `manifest_phase3.json` và `evaluation_phase3_report.json` (`500` episodes, `eval_seed=2026`, `masked_violation_rate = 0.0%` trên cả 3 ngành và *Zero-shot Transfer* `heldout_data_eng_graph`).
  - `activate_candidate_model` khóa chặt `422 SAFETY_GATE_NOT_PASSED` với model `BLOCKED`; `rollback_active_model` khôi phục trong `< 2000ms`.
  - **[Major-3]** `run_micro_batch_online_rl` và `get_system_health_status` trong `admin_v2/service.py` dùng tính toán heuristic trên buffer và trạng thái tĩnh cho 4 dịch vụ thay vì chạy bước tối ưu PPO thực và probe `/health` trực tiếp qua HTTP.
