# Bản đồ tài liệu Plumora

Đọc theo nhu cầu, không nạp toàn bộ thư mục vào mỗi phiên.

| Tài liệu | Vai trò / thẩm quyền |
| --- | --- |
| [Định hướng gốc](brief/project-direction.md) | Bản sao nguyên byte tài liệu chủ dự án cung cấp; ba giai đoạn sản phẩm |
| [Phân tích Giai đoạn 3](proposals/PHASE3_ANALYSIS.md) | Báo cáo phân tích & tổng hợp mở rộng Đích Giai đoạn 3 (`P3-01`..`P3-10`, `Q-01`–`Q-07`); **Gate 1 Baseline (`v2.0.0` — APPROVED tại `D-16`..`D-26`)** |
| [Intent](intent.md) | Tổng hợp mục tiêu, ranh giới MVP (`v1.0.0`) và mở rộng Đích Giai đoạn 3 + KPI định lượng; **Gate 1 Baseline (`v2.0.0` — APPROVED)** |
| [Spec](spec.md) | Tiêu chí hành vi MVP (`PL-AUTH-01`..`PL-E2E-01`) & Giai đoạn 3 (`PL3-KG-01`..`PL3-ARCH-01`), công thức định lượng và bất biến hệ thống; **Gate 1 Baseline (`v2.0.0` — APPROVED)** |
| [System Design](design.md) | Kiến trúc Modular Monolith (`v1.0.0`) & 4 Microservices (`v2.0.0`), C4/ERD/Sequence/StateMachine/Security/RL-DFD, hợp đồng `/api/v1/*`, `/api/v2/*` & `Redis Streams`; **Gate 1 Baseline (`v2.0.0` — APPROVED)** |
| [UI Design System](ui-design-system.md) | Hệ thống thiết kế giao diện Chồi Cây Non (`#15803D` / `#D97706` / `#0D9488`), 100% SVG icons `lucide-react` (không emoji), 20 màn hình (`SCR-01`–`SCR-20`), 5+2 trạng thái UX và biên bản Stitch (`D-15`, `D-26`); **Gate 1 Baseline (`v2.0.0` — APPROVED)** |
| [Quyết định](decisions.md) | Sổ quyết định (`D-01`–`D-26`) và biên bản phê duyệt + Manifest `SHA-256` Gate 1 (`v1.0.0` & `v2.0.0`) |
| [Kế hoạch](plan.md) | Task DAG MVP (`BOOT-01`..`DEFENSE-01` đã hoàn thành) & 4 lát cắt Giai đoạn 3 (`P3-SLICE-1` đang `ready`..`P3-SLICE-4`), kèm Ma trận Luận điểm Bảo vệ; **Gate 1 Baseline (`v2.0.0` — APPROVED)** |
| [Kế hoạch RL](research/RL_PLAN.md) | Hợp đồng `Student Simulator` 24 chiều (`DQN` `v1.0.0`) và mở rộng Đa lĩnh vực 8 chiều/node, `GNN-PPO` 3 lớp PyTorch Tensor, đối sánh 4 cấp + *Zero-shot Transfer* (`heldout_data_eng_graph` 10 node) & `Safe Micro-batch Online RL`; **Gate 1 Baseline (`v2.0.0` — APPROVED)** |
| [Antigravity CLI](ANTIGRAVITY_GUIDE.md) | Tác dụng, cơ chế, cách dùng và nguồn chính thức Google |
| [Prompt](prompts.md) | Mẫu giao việc theo từng giai đoạn |
| [Workflow](engineering/WORKFLOW.md) | Quy tắc kỹ thuật và mẫu bằng chứng |
| [Môi trường & Readiness](environment.md) | Hồ sơ môi trường cục bộ, Docker Compose (`PostgreSQL 16` + `Redis 7`), Day-0 CI và phân loại test `SMOKE GREEN` vs `PRODUCT RED` (`ENV-01`) |
| [Kiểm chứng bootstrap](verification/BOOTSTRAP.md) | Phạm vi, kết quả kiểm tra, giới hạn và snapshot |
| [Bàn giao ENV-01](verification/HANDOFF_ENV_01.md) | Hồ sơ bàn giao nhiệm vụ `ENV-01` (Gate 2 Readiness, lệnh kiểm chứng, RED tests và manifest `SHA-256`) |
| [Bàn giao RL-01](verification/HANDOFF_RL_01.md) | Hồ sơ bàn giao nhiệm vụ `RL-01` (`PL-RL-01`: Simulator 24 chiều, huấn luyện `DQN` đa hạt giống, đánh giá 500 episodes với `B1`/`B2`/`B3`, checkpoint `SHA-256` và phân tích giới hạn) |
| [Bàn giao SLICE-01](verification/HANDOFF_SLICE_01.md) | Hồ sơ bàn giao nhiệm vụ `SLICE-01` (`PL-AUTH-01`..`PL-E2E-01`: FastAPI Modular Monolith, PostgreSQL SSoT, Redis 24-dim Cache, DQN Serving, React SPA `SCR-01`..`SCR-08` và kiểm thử E2E/Adversarial) |
| [Phiên hiện tại](../.direwolf_memory/ACTIVE_SESSION.md) | Trạng thái ngắn để tiếp nối công việc |

Không coi sự tồn tại của tài liệu, nhãn DRAFT hay kết quả kiểm tra file là phê duyệt yêu cầu, thành công ứng dụng hoặc hiệu quả RL.
