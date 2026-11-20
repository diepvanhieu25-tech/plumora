# Bộ Prompt Thực Chiến Cho Plumora (Giai đoạn 3 — `v2.0.0`)

Tổng hợp các mẫu prompt copy-dùng-ngay khi bạn **đổi sang Model khác**, **mở phiên làm việc mới**, hoặc **bắt đầu chạy tự chủ từng Đợt công việc (`Đợt 1` $\rightarrow$ `Đợt 4`)** trong [docs/plan.md](plan.md). Chạy từ thư mục gốc `/home/diepvanhieu/workspace/plumora`.

---

## 1. Prompt Đổi Model / Mở Phiên Mới & Bắt đầu ngay **ĐỢT 1 (`P3-SLICE-1`)** *(Khuyên dùng ngay lúc này)*

Dùng khi bạn vừa đổi Model hoặc mở phiên mới để bắt đầu code **Đợt 1 (Việc 1.1 $\rightarrow$ Việc 1.5: 3 Ngành học + Kiểm tra đầu vào & Đào sâu 5 tầng + Chấm Code Sandbox + Gia sư AI + Nhắc ôn tập Ebbinghaus + 6 màn hình Học viên `SCR-09`..`SCR-14`)**:

```text
/goal
Dùng sdlc-code để triển khai ĐỢT 1 (P3-SLICE-1: Việc 1.1 -> Việc 1.5) theo Gate 1 Baseline Giai đoạn 3 (v2.0.0) đã được phê duyệt tại D-16..D-26.

Trước khi viết code, hãy đọc đúng các nguồn có thẩm quyền:
1. git status --short, AGENTS.md và .direwolf_memory/ACTIVE_SESSION.md.
2. Mục 1 (Đợt 1) & Mục 2.2 của docs/plan.md.
3. Mục 10 của docs/spec.md (PL3-KG-01, PL3-ASSESS-01, PL3-GRADER-01, PL3-TUTOR-01, PL3-MEMORY-01).
4. Mục 8 của docs/design.md và Mục 10 của docs/ui-design-system.md (6 màn hình Học viên mới SCR-09..SCR-14 đã duyệt tại D-26).

Quy trình thực thi bắt buộc (Gate 2 TDD):
1. Tạo nhánh feat/p3-slice-1-depth-assessment và xác nhận cụm Docker (PostgreSQL 16 + Redis 7) đang healthy.
2. Viết và chạy quan sát bộ kiểm thử đỏ (RED behavioral tests) cho cả 5 đầu việc của Đợt 1 (Đồ thị 3 ngành Backend/Frontend/DevOps có 7 node liên thông, Chẩn đoán đầu vào & Đào sâu 5 tầng, Máy chấm Code Sandbox cô lập <= 3000ms, Gia sư AI chấm Rubric có Circuit Breaker fallback, và Đường cong quên lãng Ebbinghaus S0=3.0) trong khi vẫn giữ 100% test MVP (/api/v1/*, SCR-01..SCR-08) xanh.
3. Triển khai tuần tự Việc 1.1 -> Việc 1.5 (Backend + 6 màn hình Frontend SCR-09..SCR-14 chuẩn Botanical Sprout, 100% SVG lucide-react, cấm tuyệt đối emoji INV-UI-01) để đưa toàn bộ test về GREEN.
4. Chạy ./scripts/ci_check.sh và kiểm thử trình duyệt thật (Chromium E2E) đạt 100% PASS.
5. Lập hồ sơ bàn giao tại docs/verification/HANDOFF_P3_SLICE_01.md và cập nhật .direwolf_memory/ACTIVE_SESSION.md.
```

---

## 2. Prompt Chạy **ĐỢT 2 (`P3-SLICE-2` — Huấn luyện AI Đồ thị `GNN-PPO` & Thử nghiệm Chuyển ngành)**

Dùng sau khi đã hoàn thành Đợt 1 để bắt đầu huấn luyện mô hình AI Đồ thị `GNN-PPO` và chạy thực nghiệm so sánh 4 phương pháp (Việc 2.1 $\rightarrow$ Việc 2.3):

```text
/goal
Dùng sdlc-code để triển khai ĐỢT 2 (P3-SLICE-2: Việc 2.1 -> Việc 2.3) theo Gate 1 Baseline v2.0.0.
Đọc AGENTS.md, .direwolf_memory/ACTIVE_SESSION.md, docs/plan.md (Đợt 2), docs/research/RL_PLAN.md (v2.0.0) và .agents/rules/rl-evidence.md.

Thực hiện tuần tự theo TDD:
1. Tạo nhánh feat/p3-slice-2-gnn-ppo và viết RED tests cho Simulator đa ngành (8 đặc trưng/node, 4 chế độ học, không lộ biến ẩn) cùng Policy Guardrail (PL3-RL-01, PL3-GUARD-01).
2. Hiện thực hóa Simulator đa ngành, mạng GNN-PPO (3 lớp PyTorch Tensor Message Passing) và chạy thực nghiệm đối sánh 4 cấp (Heuristics B1/B2/B3 vs DQN-MLP vs PPO-MLP vs GNN-PPO) trên train_seeds=[101,202,303], val_seed=999, eval_seed=2026 (500 episodes) cho cả 3 ngành đã biết và ngành kiểm thử độc lập heldout_data_eng_graph (10 node).
3. Xuất checkpoint gnn_ppo_v2_base.zip kèm mã băm SHA-256, tích hợp vào API gợi ý trên SCR-11 kèm Policy Guardrail (p95 < 250ms).
4. Chạy ./scripts/ci_check.sh đạt 100% GREEN và lập hồ sơ bàn giao docs/verification/HANDOFF_P3_SLICE_02.md.
```

---

## 3. Prompt Chạy **ĐỢT 3 (`P3-SLICE-3` — Tách 4 Microservices, `Safe Online RL` & Cổng Chuyên gia / Admin)**

Dùng sau khi đã hoàn thành Đợt 2 để tách hệ thống thành 4 Microservices, bật `Safe Micro-batch Online RL` và ráp 6 màn hình Cổng Chuyên gia / Admin (`SCR-15`..`SCR-20`, Việc 3.1 $\rightarrow$ Việc 3.4):

```text
/goal
Dùng sdlc-code để triển khai ĐỢT 3 (P3-SLICE-3: Việc 3.1 -> Việc 3.4) theo Gate 1 Baseline v2.0.0.
Đọc AGENTS.md, .direwolf_memory/ACTIVE_SESSION.md, docs/plan.md (Đợt 3), docs/spec.md (PL3-ROLE-01, PL3-ARCH-01, INV-ONLINE-RL-01), docs/design.md (Mục 8) và docs/ui-design-system.md (SCR-15..SCR-20).

Thực hiện tuần tự theo TDD:
1. Tạo nhánh feat/p3-slice-3-microservices-online-rl và viết RED tests cho phân quyền RBAC 3 vai trò (learner/expert/admin), chống query SQL chéo schema, đồng bộ Transactional Outbox + Redis Streams (chống trùng event_id), và vòng lặp Safe Micro-batch Online RL + Safety Evaluation Gate + 1-Click Rollback.
2. Tách hệ thống thành 4 Microservices (user-auth, content-kg, assessment-grader, recommendation-ai) sau API Gateway với 4 Schema PostgreSQL cô lập (auth_svc, content_svc, assess_svc, rec_ai_svc).
3. Hoàn thiện 3 màn hình Cổng Chuyên gia (SCR-15..SCR-17), 3 màn hình Cổng Admin (SCR-18..SCR-20) và bộ cấu hình Kubernetes manifests (k8s/ kèm HPA).
4. Chạy ./scripts/ci_check.sh đạt 100% GREEN và lập hồ sơ bàn giao docs/verification/HANDOFF_P3_SLICE_03.md.
```

---

## 4. Bộ Prompt Chạy **ĐỢT 4 (`P3-SLICE-4` — Đo tải, Review Độc lập Gate 3 & Đóng gói Bảo vệ Gate 4)**

### 4A. Việc 4.1 — Kiểm định chấm bài & Đo chịu tải hệ thống (`sdlc-code`)

```text
/goal
Dùng sdlc-code để thực hiện Việc 4.1 của ĐỢT 4 (P3-SLICE-4) trong docs/plan.md:
1. Chạy kiểm định độ nhất quán giữa LLM Rubric Adapter và DeterministicRubricGrader.
2. Chạy bài benchmark tải cục bộ 20 concurrent users trong 60 giây trên cụm 4 Microservices, xác nhận tỷ lệ lỗi 5xx = 0.0% và độ trễ đạt ngưỡng NFR trong docs/spec.md.
3. Xuất báo cáo đo tải và cập nhật .direwolf_memory/ACTIVE_SESSION.md.
```

### 4B. Việc 4.2 — Đánh giá độc lập 4 trục Gate 3 (`sdlc-review` — Mở trong phiên mới)

```text
Dùng sdlc-review. Đây là phiên review độc lập Gate 3 cho Giai đoạn 3 (v2.0.0), tuyệt đối không tự sửa code.
Đọc docs/spec.md (v2.0.0), docs/design.md (v2.0.0), docs/ui-design-system.md (v2.0.0), các hồ sơ HANDOFF_P3_SLICE_01..03 và chạy git status --short.

Thẩm định độc lập trên cả 4 trục:
1. UI/UX: Kiểm tra toàn bộ 20 màn hình (SCR-01..SCR-20) theo chuẩn Botanical Sprout, 0 Emoji (INV-UI-01), RBAC Route Guard cho Learner/Expert/Admin.
2. Code Quality & Architecture: Ranh giới 4 Microservices, Design Patterns (State Machine, Adapter/Circuit Breaker, Outbox, Guardrail), chạy ./scripts/ci_check.sh.
3. Security: Cô lập Code Sandbox (network_mode: none, timeout <= 3000ms, RAM <= 128MB — INV-SANDBOX-01), chống IDOR/403 giữa 3 vai trò.
4. Database & AI/RL: Cô lập 4 Schema PostgreSQL, chống xử lý trùng Outbox/Redis Streams, kiểm tra bằng chứng thực nghiệm GNN-PPO, Zero-shot Transfer và Safety Gate / 1-Click Rollback (INV-DEPTH-01, INV-ONLINE-RL-01).

Lập biên bản tại docs/verification/VERIFICATION_GATE3_PHASE3.md với kết luận APPROVED hoặc REJECTED.
```

### 4C. Việc 4.3 — Đóng gói Kịch bản Demo 20 màn hình & Báo cáo Bảo vệ Gate 4 (`sdlc-release`)

```text
/goal
Dùng sdlc-release. Đọc docs/verification/VERIFICATION_GATE3_PHASE3.md và Mục 2.3 (Ma trận 5 luận điểm bảo vệ P3-10) trong docs/plan.md.
1. Cập nhật báo cáo thực nghiệm RL đa ngành & GNN-PPO trong docs/defense/RL_EXPERIMENTAL_REPORT.md.
2. Cập nhật kịch bản bấm Demo 20 màn hình (3 vai trò Learner, Expert, Admin) trong docs/defense/DEMO_RUNBOOK.md.
3. Lập hồ sơ phát hành Gate 4 Giai đoạn 3 tại docs/verification/RELEASE_GATE4_PHASE3.md và chạy ./scripts/ci_check.sh xác nhận 100% sẵn sàng bảo vệ.
```

---

## 5. Prompt Ngắn Khi Đổi Model Giữa Chừng, Nén Ngữ Cảnh (`/compact`) Hoặc Sửa Lỗi CI Nhanh

### 5A. Khi vừa đổi sang Model khác lúc đang làm dở một Đợt

```text
Đọc AGENTS.md, .direwolf_memory/ACTIVE_SESSION.md, Mục 1 của docs/plan.md và chạy git status --short.
Tóm tắt trong 5 dòng:
1. Chúng ta đang ở Đợt mấy (P3-SLICE-1..4) và Việc số mấy (1.1..4.3)?
2. Những file nào vừa sửa và trạng thái test ./scripts/ci_check.sh hiện tại?
3. Tiếp tục thực hiện ngay bước kế tiếp của nhiệm vụ đang làm theo đúng Gate 1 Baseline v2.0.0 đã duyệt (không hỏi lại các quyết định D-01..D-26 đã chốt).
```

### 5B. Khi `./scripts/ci_check.sh` bị lỗi cần sửa nhanh

```text
/goal
Dùng sdlc-code. Script ./scripts/ci_check.sh đang bị lỗi (exit code != 0).
1. Chạy ./scripts/ci_check.sh và phân tích chính xác bước bị gãy (ruff, mypy, pytest, eslint, tsc, vitest, e2e).
2. Tìm nguyên nhân gốc rễ (Root Cause) và sửa đổi tối thiểu mã nguồn để khắc phục.
3. Tuyệt đối không tắt test, không bỏ qua typecheck hoặc nới lỏng ràng buộc.
4. Chạy lại ./scripts/ci_check.sh xác nhận toàn bộ pipeline đạt 100% GREEN.
```
