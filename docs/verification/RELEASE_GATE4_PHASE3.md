# Hồ Sơ Phát Hành Gate 4 — Giai Đoạn 3 (`v2.0.0` — `P3-SLICE-1..4`)

- **Sản phẩm:** Plumora — Hệ thống Quản lý & Khuyến nghị Lộ trình Học Cá nhân hóa bằng Học Tăng cường Đồ thị (`GNN-PPO`)
- **Phiên bản:** `v2.0.0` (Đích Giai đoạn 3 — Bảo vệ Đồ án Tốt nghiệp)
- **Ngày đóng gói:** 2026-11-20
- **Nhánh:** `feat/p3-slice-3-microservices-online-rl` $\rightarrow$ hợp nhất vào `main`
- **Hồ sơ Gate 3:** [`docs/verification/VERIFICATION_GATE3_POST_POLISH.md`](VERIFICATION_GATE3_POST_POLISH.md) (**`APPROVED`** — `0` Blocker, `0` Critical; `11/13` findings đã đóng, `2` nợ kiến trúc non-blocking) và [`docs/verification/VERIFICATION_GATE3_PHASE3.md`](VERIFICATION_GATE3_PHASE3.md)
- **Trạng thái Triển khai:** `approved` (Đã phê duyệt Gate 4 cho phát hành mã nguồn `v2.0.0` lên nhánh `main` và đóng gói Docker Compose / Kubernetes manifests cục bộ; hạ tầng production từ xa `not-deployed`).

---

## 1. Ma Trận 5 Luận Điểm Bảo Vệ $\rightarrow$ Bằng Chứng Kiểm Chứng (`P3-10`)

| Mã Luận Điểm | Nội Dung Luận Điểm | Gói Bằng Chứng Đã Kiểm Chứng |
| --- | --- | --- |
| **`CLAIM-P3-01`** | Đánh giá chiều sâu 2 chế độ (*Adaptive Placement* trần `0.75` + *5-Depth Probing State Machine* + *Code Sandbox* + *Rubric*) | `backend/tests/test_depth_state_machine.py`, `test_code_sandbox_security.py`, `test_llm_rubric_adapter.py`, Độ nhất quán Rubric `100.0%` (`MAE=0.0833`, `r=0.9608`) |
| **`CLAIM-P3-02`** | Đồ thị đa lĩnh vực có 7 node giao thoa + suy giảm trí nhớ *Ebbinghaus* $R(t) = e^{-\Delta t/S}$ ($S_0 = 3.0$) | `backend/tests/test_multi_domain_kg.py`, `test_ebbinghaus_memory.py`, Demo `SCR-09`, `SCR-11`, `SCR-14` |
| **`CLAIM-P3-03`** | `GNN-PPO` 3 lớp PyTorch Tensor vượt `Heuristics` & `MLP` trong *Zero-shot Domain Transfer* (`heldout_data_eng_graph`) | `rl/artifacts/gnn_ppo_v2_base.zip` (`SHA-256 = 9977d5f606427d0eb25970b1ce8cf23fa0232e2d7ff0fe392e80d2413d534201`), `evaluation_phase3_report.json`, `RL_EXPERIMENTAL_REPORT.md` Mục 10 |
| **`CLAIM-P3-04`** | `Safe Micro-batch Online RL` + `Policy Guardrail` (`0.0%` vi phạm) + `Safety Gate` + `1-Click Rollback` (`< 2000ms`) | `backend/tests/test_gnn_ppo_guardrail_serving.py`, `test_rbac_expert_admin.py`, Demo `SCR-18`, `SCR-19` |
| **`CLAIM-P3-05`** | Cụm 4 Microservices + 4 Schema PG cô lập + `Transactional Outbox`/`Redis Streams` + `k8s/` HPA & Chịu tải `20 VU` | `backend/tests/test_microservices_outbox_streams.py`, `P3_SLICE_4_LOAD_AND_CONSISTENCY_REPORT.md` (`8,796 reqs`, `5xx = 0.0%`, `p95 = 232.68ms`, `GNN-PPO p95 = 122.81ms`), `k8s/` |

---

## 2. Danh Mục Thành Phần Đóng Gói & Mã Băm (`Immutable Artifacts`)

- `rl/artifacts/gnn_ppo_v2_base.zip`: `SHA-256 = 9977d5f606427d0eb25970b1ce8cf23fa0232e2d7ff0fe392e80d2413d534201`
- Cụm Docker Monolith: `docker-compose.yml` (`postgres`, `redis`, `backend`, `frontend`)
- Cụm Docker 4 Microservices: `docker-compose.yml` (`--profile microservices`: `user-auth-service`, `content-kg-service`, `assessment-grader-service`, `recommendation-ai-service`, `api-gateway`, `postgres`, `redis`)
- Manifests Kubernetes: `k8s/namespace.yaml`, `k8s/postgres-redis.yaml`, `k8s/microservices.yaml`, `k8s/hpa.yaml`, `k8s/network-policy.yaml`
- Kịch bản thao diễn: [`docs/defense/DEMO_RUNBOOK.md`](../defense/DEMO_RUNBOOK.md)

---

## 3. Quy Trình Kiểm Tra Sức Khỏe & Phục Hồi (`Three-Barrier & Rollback`)
1. Chạy `./scripts/ci_check.sh` (tất cả 6 giai đoạn: Lint, Mypy/TSC, Pytest `41` Backend + `3` RL, Vitest `8` Frontend, Build, Live Integration, Real Chromium E2E Audit & Negative Control) $\rightarrow$ **Exit 0**.
2. Kiểm tra `GET /api/v1/health` và `GET /api/v2/admin/system-health` (khi đăng nhập `admin_demo`).
3. Khi gặp sự cố checkpoint AI mới: gọi `POST /api/v2/admin/models/rollback` hoặc bấm **"1-Click Rollback"** trên `SCR-19` để khôi phục `gnn_ppo_v2_base` trong $< 2000\text{ms}$.
