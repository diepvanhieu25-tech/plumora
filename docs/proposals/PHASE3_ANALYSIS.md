# Phân tích Mở rộng Plumora hướng tới Giai đoạn sau MVP (Đích Giai đoạn 3)

- **Trạng thái:** `APPROVED — Gate 1 Baseline Giai đoạn 3 (v2.0.0) & 12 màn hình Stitch (SCR-09..SCR-20) đã được chủ dự án phê duyệt tại D-16..D-26 (2026-11-18)` — Đã đồng bộ hoàn tất 100% sang bộ tài liệu chính thức (`intent.md`, `spec.md`, `design.md`, `ui-design-system.md`, `RL_PLAN.md`, `decisions.md`, `plan.md`, `README.md`, `AGENTS.md`); nhiệm vụ `P3-SLICE-1` đang ở trạng thái `ready` (chưa thay đổi mã nguồn ứng dụng).
- **Phân biệt nguồn tham chiếu:**
  - **Baseline MVP (`v1.0.0`) & Giai đoạn 3 (`v2.0.0`) đã duyệt:** [intent.md](../intent.md) (`v2.0.0`), [decisions.md](../decisions.md) (`v2.0.0`), [spec.md](../spec.md) (`v2.0.0`), [design.md](../design.md) (`v2.0.0`), [ui-design-system.md](../ui-design-system.md) (`v2.0.0`), [project-direction.md](../brief/project-direction.md).
  - **Khung phương pháp:** `/home/diepvanhieu/workspace/direwolf-agents/docs/PLAN_PLUMORA_PHASE3.md` (`v0.1.0 DRAFT`).
  - **Hướng dẫn chuyển phiên:** `/home/diepvanhieu/workspace/direwolf-agents/docs/HANDOFF_PLUMORA_PHASE3_ANTIGRAVITY.md` (`v0.1.0`).
  - **Ý tưởng bổ sung:** `/home/diepvanhieu/workspace/direwolf-agents/docs/PLUMORA_ASSESSMENT_DEPTH_SUPPLEMENT.md` (`v0.1.0`).

---

## 1. Nội dung đã được chủ dự án xác nhận (`P3-01` $\rightarrow$ `P3-10`)

### 1.1. Ý tưởng, Giá trị & Định hướng (`P3-01` — Đã cập nhật vào `docs/intent.md`)
- **Nền tảng & Đích báo cáo:** MVP đã xây dựng là nền tảng mở rộng; đích báo cáo đồ án là **Giai đoạn 3**.
- **Bài toán & Giá trị cốt lõi:** **Xác định đúng năng lực học của từng học viên** và **gợi ý bước học tiếp theo phù hợp với năng lực học đó**. Khung đánh giá chiều sâu (5 tầng đào sâu, 4 dạng bài thực tế, 4 mức hiểu) phục vụ cả đánh giá năng lực, RL và thiết kế lộ trình cá nhân hóa; **không đổi định vị Plumora sang sản phẩm luyện phỏng vấn**.
- **Đóng góp nghiên cứu & kỹ thuật trọng tâm (`Q-01`):**
  1. *Lõi AI & Đánh giá năng lực thích ứng:* Đánh giá chiều sâu tự động + RL nâng cao (`PPO`/`Actor-Critic`, `Online RL`) + `GNN` trên Knowledge Graph đa lĩnh vực + độ suy giảm nhớ *Ebbinghaus*.
  2. *Kiến trúc hệ thống mở rộng & Tự động hóa kiểm duyệt:* Microservices tách rời dịch vụ Đánh giá tự động, Kiểm duyệt lộ trình tự động và Lõi AI, kèm công cụ cho `Expert`/`Admin` soạn nội dung và kiểm tra an toàn mô hình.
- **Dữ liệu & Hạ tầng (`Q-05`, `Q-06`, `Q-07`):** Pre-training trên Simulator đa lĩnh vực nâng cao + Online Fine-tuning từ tương tác thật có kiểm duyệt; chạy cụm Microservices trên Docker Compose cục bộ kèm manifest Kubernetes chuẩn; kết nối LLM qua Adapter (có fallback local/deterministic khi offline); kiểm thử tải cục bộ có số đo thực tế.

### 1.2. Phạm vi, Quy tắc Nghiệp vụ & Khoảng cách Hiện trạng (`P3-02` & `P3-03`)
- **3 Lĩnh vực mẫu có giao thoa & Đồ thị kiểm thử (`PL3-KG-01`):** `Backend` (12 khái niệm) + `Frontend` (10 khái niệm) + `DevOps & System Reliability` (9 khái niệm) có các nút khái niệm giao thoa tự nhiên (`net-internet`, `os-basics`, `web-http`, `api-rest`, `cache-redis`, `sec-authn`, `sec-api`), kèm đồ thị kiểm thử độc lập thứ 4 `heldout_data_eng_graph` (10 khái niệm) phục vụ đánh giá *Zero-shot Domain Transfer*; hỗ trợ `Chuyên gia (Expert)` định nghĩa thêm lĩnh vực mới mà không phải sửa code.
- **Quy trình Đánh giá năng lực tự động 2 chế độ (`PL3-ASSESS-01`):**
  1. *Chẩn đoán đầu vào nhanh (Adaptive Placement)* khi chọn lĩnh vực để xác định điểm xuất phát.
  2. *Đánh giá đào sâu theo tầng (5 tầng sâu & 4 dạng bài thực tế)* sau mỗi khái niệm: bắt đầu từ tầng 1–2 (MCQ/tình huống nhiều bước); đạt mới mở tầng 3–5 (bài thực tế / Code Sandbox / giải thích thiết kế); dừng khi chạm *Knowledge Ceiling* hoặc đủ bằng chứng xác lập mức hiểu (*Surface, Applied, Deep Understanding, Mastery*).
- **Chấm điểm tự động đa phương thức & AI Tutor (`PL3-GRADER-01`, `PL3-TUTOR-01`):** Tầng 1–2 chấm tất định; Tầng 3–5 kết hợp **(a) Code Sandbox cô lập** (`Python` / `SQL` / `JS` chạy test cases thật) và **(b) Tự luận ngắn / Giải thích thiết kế** chấm theo Rubric có cấu trúc qua **LLM Adapter** (kèm fallback deterministic khi offline), tích hợp **AI Tutor** giải thích chi tiết.
- **Kiểm duyệt lộ trình tự động & Phân quyền 3 vai trò (`PL3-GUARD-01`, `PL3-ROLE-01`):**
  - *Policy Guardrail tự động:* Chặn vi phạm tiên quyết DAG, kiểm tra ngưỡng độ sâu tối thiểu, ưu tiên bài suy giảm nhớ *Ebbinghaus* vượt ngưỡng, và fallback nếu mô hình Online RL đề xuất dị biệt.
  - *3 vai trò:* `Learner` (học tập, đánh giá, thực hành, xem hồ sơ năng lực & lộ trình), `Expert` (soạn/duyệt Knowledge Graph đa lĩnh vực, ngân hàng đề 5 tầng & Rubric), `Admin` (giám sát Online RL, duyệt phát hành checkpoint mới hoặc rollback 1-click).
- **Khoảng cách MVP $\rightarrow$ Giai đoạn 3 (`P3-03`):** Tái sử dụng DAG engine, `submission_id` lũy đẳng, ACID `Unit of Work`, Redis Read/Write-through cache, `Strategy Pattern`, xác thực `Argon2id` + `HttpOnly Cookie` và giao diện *Botanical Sprout* của MVP; nâng cấp lên Multi-domain KG, 5-depth State Machine, Code Sandbox, LLM Adapter, `GNN-PPO` + Online RL và kiến trúc 4 Microservices.

### 1.3. Thiết kế Nghiên cứu RL, GNN và Dữ liệu (`P3-04`)
- **Phân định Không gian Hành động (`Action Space`):** RL chọn cặp **(Khái niệm đích $v \in V$ + Chế độ học $m \in \{\text{Learn\_New}, \text{Deep\_Probe}, \text{Code\_Practice}, \text{Spaced\_Review}\}$)**; việc bóc tách câu hỏi tầng $1 \rightarrow 5$ bên trong phiên đánh giá do **Assessment State Machine** điều khiển độc lập.
- **Biểu diễn Trạng thái Đồ thị không phụ thuộc lĩnh vực (`Domain-agnostic Node Features` cho `GNN`):** Mỗi Node mang vector đặc trưng cố định (~8–10 chiều: *Mức hiểu Surface..Mastery*, *Confidence*, *Retention $e^{-\Delta t / S}$*, *`is_eligible`*, *`tier_difficulty`*, *Điểm Code gần nhất*, *Cờ thuộc mục tiêu học*), giúp `GNN` đọc hiểu mọi đồ thị lĩnh vực mới mà không phụ thuộc số lượng node.
- **Hàm Phần thưởng & Thực nghiệm Đối sánh 4 cấp (`PL3-RL-01`):**
  - *Reward:* Tính trên **dịch chuyển mức năng lực đã kiểm chứng** (*Verified Depth Gain* + *Phục hồi trí nhớ Ebbinghaus* + *Đạt bài Code* $-$ *Chi phí thời gian/quá tải* $-$ *Phạt sai tiên quyết/lặp thừa*; không lấy điểm LLM thô làm reward trực tiếp).
  - *Thực nghiệm 4 cấp:* Đối sánh **Heuristics (`B1/B2/B3`)** vs **`DQN-MLP` (MVP)** vs **`PPO-MLP`** vs **`GNN-PPO` (Đề xuất)** trên cả kịch bản Đa lĩnh vực và Chuyển giao sang lĩnh vực mới (*Zero-shot Domain Transfer*).
- **Vòng đời Online Learning An toàn (`Safe Micro-batch Online RL`):** Lưu tương tác thật đã qua kiểm duyệt vào **Experience Buffer** $\rightarrow$ Tinh chỉnh `PPO` theo lô với ràng buộc `KL-divergence` $\rightarrow$ Qua **Safety Evaluation Gate** tự động $\rightarrow$ Xuất Checkpoint ứng viên để `Admin` duyệt kích hoạt hoặc **rollback 1-click**.

### 1.4. System Design, Design System & Design Patterns (`P3-05`, `P3-06`, `P3-07`)
- **Kiến trúc 4 Microservices sau API Gateway (`P3-05`):**
  1. `User & Auth Service` (quản lý tài khoản, phiên, phân quyền RBAC `Learner`/`Expert`/`Admin`).
  2. `Course, Knowledge Graph & Content Service` (đồ thị đa lĩnh vực, bài học Markdown, ngân hàng đề 5 tầng & Rubric).
  3. `Assessment, Auto-Grader & AI Tutor Service` (Adaptive Placement, 5-depth State Machine, Worker Code Sandbox cô lập không mạng/read-only FS/timeout 3s, LLM Rubric Adapter & AI Tutor, hồ sơ năng lực + *Ebbinghaus*).
  4. `Recommendation AI & Model Audit Service` (suy luận `GNN-PPO`, `Policy Guardrail`, Experience Buffer, `Safe Micro-batch Online RL`, kiểm định & rollback checkpoint).
  - Mỗi service sở hữu **Schema PostgreSQL độc lập** (trên cùng PG instance khi chạy local để tối ưu RAM, tách biệt quyền truy cập nghiêm ngặt), đồng bộ qua **Transactional Outbox + Redis Streams** (chống xử lý trùng bằng `submission_id`/`event_id`) và **Redis Graph-State Cache**.
- **Mở rộng Design System Chồi Cây Non (`P3-06`):** Kế thừa trọn vẹn *Botanical Sprout & Sunlit Canopy* (100% Lucide SVG, không emoji, đủ 5+2 trạng thái UX gồm cả trạng thái đang chấm `Async Grading Sandbox/LLM` và `Insufficient Evidence`) và mở rộng **12 màn hình chuyên biệt SCR-09..SCR-20 (nâng tổng số lên 20 màn hình toàn hệ thống)**:
  1. Phân hệ `Learner` (`SCR-09`..`SCR-14`): Trung tâm Đa lĩnh vực (`SCR-09`), Chẩn đoán đầu vào `Adaptive Placement` (`SCR-10`), Bản đồ KG Đa lĩnh vực & *Ebbinghaus* (`SCR-11`), Phòng Đánh giá đào sâu 5 tầng (`SCR-12`), Phòng Thực hành Code Sandbox (`SCR-13`), Ngăn kéo AI Tutor, Rubric & Ôn tập *Ebbinghaus* (`SCR-14`).
  2. Phân hệ `Expert` (`SCR-15`..`SCR-17`): Quản lý Lĩnh vực & Đồ thị DAG (`SCR-15`), Biên soạn Đề 5 tầng & Rubric (`SCR-16`), Thiết kế Bài tập Code Sandbox & Test Cases (`SCR-17`).
  3. Phân hệ `Admin` (`SCR-18`..`SCR-20`): Giám sát Online RL & Experience Buffer (`SCR-18`), Cổng Kiểm định An toàn `Safety Gate` & `1-Click Rollback` (`SCR-19`), Giám sát Cụm 4 Microservices & Outbox/Streams (`SCR-20`).
- **Mẫu Thiết kế Phần mềm áp dụng (`P3-07`):** Kế thừa `Unit of Work`, `Strategy + Policy Guardrail`, `Read/Write-through Cache`; bổ sung `State Machine` (phiên đào sâu 5 tầng), `Adapter + DI` (LLM & Sandbox Grader có fallback deterministic), `Transactional Outbox` (đồng bộ sự kiện xuyên service) và `Circuit Breaker` + Timeout.

### 1.5. Kiểm chứng, Lộ trình 4 Lát cắt Dọc & Đóng gói Bảo vệ (`P3-08`, `P3-09`, `P3-10`)
- **Trình tự 4 Lát cắt Dọc (`Vertical Slices` — tuân thủ Gate 1 $\rightarrow$ Gate 4 ở mỗi lát cắt):**
  1. **`P3-SLICE-1` (Multi-Domain KG & 5-Depth Assessment Engine):** Đồ thị 3 lĩnh vực (`Backend` 12 node, `Frontend` 10 node, `DevOps` 9 node) + `State Machine` đánh giá 5 tầng & Adaptive Placement + Code Sandbox + AI Tutor/Rubric Adapter + Hồ sơ năng lực *Ebbinghaus* trên `SCR-09`..`SCR-14`.
  2. **`P3-SLICE-2` (GNN-PPO Multi-Domain Simulator & Offline/Transfer Evaluation):** Môi trường giả lập đa lĩnh vực 8 chiều/node + Huấn luyện & Đối sánh 4 cấp (`Heuristics` vs `DQN-MLP` vs `PPO-MLP` vs `GNN-PPO`) + Kiểm chứng *Zero-shot Domain Transfer* trên `heldout_data_eng_graph` (10 node).
  3. **`P3-SLICE-3` (Microservices Decomposition, Safe Online RL & Expert/Admin Studio):** Tách 4 Microservices sau API Gateway + `Transactional Outbox`/`Redis Streams` + `Safe Micro-batch Online RL` + Cổng `Expert`/`Admin` (`SCR-15`..`SCR-20`) + Kubernetes manifests.
  4. **`P3-SLICE-4` (Verification, Load Benchmark & Defense Packaging):** Kiểm định độ nhất quán chấm tự động, benchmark tải cục bộ (20 concurrent users), review 4 trục độc lập (Gate 3) và đóng gói hồ sơ bảo vệ Giai đoạn 3 (Gate 4).

---

## 2. Trạng thái Đồng bộ Gate 1 (`v2.0.0`) & Bước tiếp theo

- **Trạng thái hiện tại:** Toàn bộ 10 gói phân tích (`P3-01`..`P3-10`), 12 màn hình chuyên biệt `SCR-09`..`SCR-20` sinh từ `StitchMCP` (nâng tổng số lên 20 màn hình toàn hệ thống) và 9 hạng mục khóa chuẩn định lượng đã được chủ dự án phê duyệt chính thức tại **`D-16`..`D-26` (`2026-11-18`)**.
- **Đã hoàn tất đồng bộ Gate 1 Baseline (`v2.0.0`):** Toàn bộ bộ tài liệu chính thức (`docs/intent.md`, `docs/spec.md`, `docs/design.md`, `docs/ui-design-system.md`, `docs/research/RL_PLAN.md`, `docs/decisions.md`, `docs/plan.md`, `docs/README.md`, `AGENTS.md`) đã được nâng lên phiên bản `2.0.0` kèm bảng Manifest `SHA-256` khóa chặt tại `docs/decisions.md`.
- **Bước kế tiếp:** Nhiệm vụ **`P3-SLICE-1`** đang ở trạng thái **`ready`**. Khi chủ dự án yêu cầu bắt đầu triển khai mã nguồn, tiến hành quy trình **Gate 2** (tạo nhánh `feat/p3-slice-1-depth-assessment`, viết và quan sát RED behavioral tests cho `PL3-KG-01`..`PL3-MEMORY-01` trước khi viết business logic).

---

## 3. Danh mục Tài liệu Gate 1 (`v2.0.0`) đã hoàn tất đồng bộ & phê duyệt (`D-16`..`D-26`)

| Tài liệu | Nội dung đã đồng bộ & khóa chuẩn Gate 1 (`v2.0.0` — APPROVED) |
| --- | --- |
| [`docs/intent.md`](../intent.md) | Nâng lên `v2.0.0` (`APPROVED`), khóa 3 lĩnh vực mẫu (`backend` 12 node, `frontend` 10 node, `devops` 9 node) + `heldout_data_eng_graph` (10 node) và bộ ngưỡng KPI định lượng Đích Giai đoạn 3. |
| [`docs/spec.md`](../spec.md) | Nâng lên `v2.0.0` (`APPROVED`), khóa danh sách từng node/tier/prereqs của `frontend` & `devops`, công thức định lượng *Adaptive Placement*, *5-Depth Probing State Machine*, *Ebbinghaus* ($S_0=3.0$, $S_{\text{new}}$, `simulated_time_offset_days`), Measurable NFRs và cột `Verification Harness` cho `PL3-KG-01`..`PL3-ARCH-01`. |
| [`docs/design.md`](../design.md) | Nâng lên `v2.0.0` (`APPROVED`), khóa hợp đồng REST API `/api/v2/*` & `Redis Streams` (`CompetencyUpdatedEvent`, `DomainGraphUpdatedEvent`), cơ chế đồng bộ liên dịch vụ không query chéo schema, chiến lược DB Migration *Expand & Contract*, 5 sơ đồ Mermaid mới (`DIAG-ERD-V2`, `DIAG-DEPLOY-V2`, `DIAG-SM-ASSESS`, `DIAG-SEC-V2`, `DIAG-DFD-RL-V2`), nâng cấp `DIAG-SEQ-V2` & 6 yếu tố Design Patterns. |
| [`docs/ui-design-system.md`](../ui-design-system.md) | Nâng lên `v2.0.0` (`APPROVED` tại `D-23`, `D-26`), khóa 12 màn hình chuyên biệt `SCR-09`..`SCR-20` (nâng tổng số lên 20 màn hình toàn hệ thống), giải phẫu 8 điểm, sơ đồ `DIAG-UX-FLOW-V2`, ma trận 5+2 trạng thái UX và biên bản duyệt Stitch `D-26`. |
| [`docs/research/RL_PLAN.md`](../research/RL_PLAN.md) | Nâng lên `v2.0.0` (`APPROVED`), khóa cấu trúc 10 node của `heldout_data_eng_graph`, quy tắc đệm `padded flat observation` ($N_{\max}=16$), phân phối tham số học viên ảo, điều kiện `terminated`/`truncated` (`60`/`120` steps) và cài đặt 3 lớp `GNN Graph Encoder` bằng PyTorch Tensor thuần. |
| [`docs/decisions.md`](../decisions.md) & [`docs/plan.md`](../plan.md) | Nâng lên `v2.0.0` (`APPROVED`), ghi nhận đầy đủ `D-16`..`D-26`, bảng Manifest `SHA-256` (`v2.0.0`), đặc tả chi tiết `P3-SLICE-1` theo `task_template.md` và Ma trận Luận điểm Bảo vệ $\rightarrow$ Thí nghiệm $\rightarrow$ Bằng chứng (`P3-10`). |
