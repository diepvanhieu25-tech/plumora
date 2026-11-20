# Hồ sơ Bàn giao Gate 2 — ĐỢT 3 (`P3-SLICE-3`: Việc 3.1 $\rightarrow$ Việc 3.4)

- **Ngày:** 2026-11-19
- **Nhánh làm việc:** `feat/p3-slice-3-microservices-online-rl`
- **Cơ sở phê duyệt (Gate 1 Baseline):** `v2.0.0` (`D-17`, `D-21`, `D-22`, `D-24`, `D-25`, `D-26`)
- **Tiêu chí nghiệm thu đạt chuẩn:** `PL3-ROLE-01`, `PL3-ARCH-01`, `INV-ONLINE-RL-01`

---

## 1. Tóm tắt Kết quả Triển khai (Việc 3.1 $\rightarrow$ Việc 3.4)

1. **Việc 3.1 — Tách 4 Microservices, API Gateway, 4 Schema PostgreSQL Cô lập & Outbox/Streams (`PL3-ARCH-01`):**
   - Migration `0005_phase3_four_schemas_and_online_rl` trong `backend/app/db/migrations.py` khởi tạo 4 schema cô lập (`auth_svc`, `content_svc`, `assess_svc`, `rec_ai_svc`) cùng 4 DB role (`auth_role`, `content_role`, `assess_role`, `rec_ai_role`) bị `REVOKE ALL` chéo schema (chặn truy vấn chéo với `permission denied`).
   - 4 dịch vụ + `API Gateway` tại `backend/services/`: `user_auth_service.py` (8001), `content_kg_service.py` (8002), `assessment_grader_service.py` (8003), `recommendation_ai_service.py` (8004), `api_gateway.py` (8000).
   - `backend/app/modules/events/outbox.py`: `Transactional Outbox` (`outbox_events`) + `Redis Streams` relay + `Idempotent Consumer` (`consumed_events` chống trùng `event_id`).
2. **Việc 3.2 — RBAC 3 Vai trò & `Safe Micro-batch Online RL` + `Safety Gate` + `1-Click Rollback` (`PL3-ROLE-01`, `INV-ONLINE-RL-01`):**
   - `backend/app/modules/auth/rbac.py`: Bảo vệ `/api/v2/expert/*` (`expert`, `admin`) và `/api/v2/admin/*` (`admin`), trả `403 FORBIDDEN_ROLE` khi trái quyền.
   - `backend/app/modules/expert_v2/`: Tạo lĩnh vực, cập nhật đồ thị DAG (`422 DAG_CYCLE_DETECTED`), tạo câu hỏi 5 tầng + Rubric (`422 RUBRIC_WEIGHT_SUM_INVALID`), tạo Code Challenge qua Sandbox.
   - `backend/app/modules/admin_v2/`: `GET /online-rl/status`, `POST /online-rl/micro-batch` (`409 INSUFFICIENT_BUFFER_SAMPLES`), `Safety Evaluation Gate`, `POST /models/{id}/activate` (`422 SAFETY_GATE_NOT_PASSED` nếu `BLOCKED`), `POST /models/rollback` (`< 2000ms`), `GET /system-health`.
3. **Việc 3.3 — 6 Màn hình Cổng Chuyên gia (`SCR-15`..`SCR-17`) & Cổng Admin (`SCR-18`..`SCR-20`):**
   - `ExpertDomainsPage.tsx`, `ExpertQuestionsPage.tsx`, `ExpertCodeChallengesPage.tsx`, `AdminOnlineRlPage.tsx`, `AdminModelRegistryPage.tsx`, `AdminSystemHealthPage.tsx` (100% SVG `lucide-react`, không emoji).
4. **Việc 3.4 — Cấu hình Docker Compose Đa dịch vụ & Kubernetes (`k8s/`):**
   - `docker-compose.microservices.yml` cho cụm 4 Microservices + API Gateway + Postgres + Redis.
   - Bộ manifest `k8s/`: `namespace.yaml`, `postgres-redis.yaml`, `microservices.yaml`, `hpa.yaml`, `network-policy.yaml`.

---

## 2. Bằng chứng Kiểm chứng Toàn diện (`./scripts/ci_check.sh` — Exit 0)
- **Lint & Typecheck:** Ruff, ESLint, Mypy (`72` file Backend, `13` file RL), TSC — **0 lỗi**.
- **Tests:** Backend `49/49` pytest passed (gồm `test_rbac_expert_admin.py` và `test_microservices_outbox_streams.py`), RL `12/12` pytest passed, Frontend `18/18` Vitest passed (gồm `p3_slice3_ui.test.tsx`).
- **Live Integration & Real Chromium E2E:** `audit_mvp_hardening.cjs` (+ Negative Control), `audit_product_realism.cjs`, `audit_p3_slice1.cjs` — **100% PASSED**.

---

## 3. Bước tiếp theo
- Sẵn sàng chuyển sang **ĐỢT 4 (`P3-SLICE-4`)**: Kiểm định nhất quán & chịu tải `20 concurrent users`, Gate 3 Independent 4-Axis Review trên toàn bộ 20 màn hình (`SCR-01`..`SCR-20`) và đóng gói Bảo vệ Đồ án (Gate 4).
