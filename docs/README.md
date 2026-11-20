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
| [Workflow](engineering/WORKFLOW.md) | Quy tắc kỹ thuật và mẫu bằng chứng |
| [Kiểm thử thủ công](verification/MANUAL_SYSTEM_TESTING_SCRIPT.md) | Kịch bản kiểm thử hệ thống thực tế theo vai trò (`learner`, `expert`, `admin`) |
| [Kịch bản Demo](defense/DEMO_RUNBOOK.md) | Kịch bản trình diễn & bảo vệ đồ án |
| [Báo cáo Thực nghiệm RL](defense/RL_EXPERIMENTAL_REPORT.md) | Kết quả huấn luyện, ablation và đối chứng mô hình `GNN-PPO` trong simulator |
| [Phiên hiện tại](../.direwolf_memory/ACTIVE_SESSION.md) | Trạng thái ngắn để tiếp nối công việc |

Không coi sự tồn tại của tài liệu, nhãn DRAFT hay kết quả kiểm tra file là phê duyệt yêu cầu, thành công ứng dụng hoặc hiệu quả RL.
