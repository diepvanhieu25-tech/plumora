# Bản đồ tài liệu Plumora

Đọc theo nhu cầu, không nạp toàn bộ thư mục vào mỗi phiên.

| Tài liệu | Vai trò / thẩm quyền |
| --- | --- |
| [Định hướng gốc](brief/project-direction.md) | Bản sao nguyên byte tài liệu chủ dự án cung cấp; ba giai đoạn sản phẩm |
| [Intent](intent.md) | Tổng hợp mục tiêu và ranh giới MVP; **Gate 1 Baseline (`v1.0.0` — APPROVED)** |
| [Spec](spec.md) | Tiêu chí hành vi (`PL-AUTH-01`..`PL-E2E-01`) và bất biến hệ thống; **Gate 1 Baseline (`v1.0.0` — APPROVED)** |
| [System Design](design.md) | Kiến trúc hệ thống, C4/ERD/Sequence, hợp đồng API/DB/Redis/RL; **Gate 1 Baseline (`v1.0.0` — APPROVED)** |
| [UI Design System](ui-design-system.md) | Hệ thống thiết kế giao diện Chồi Cây Non (`#15803D` / `#D97706` / `#0D9488`), 100% SVG icons `lucide-react` (không emoji), 8 màn hình (`SCR-01`–`SCR-08`), 5 trạng thái UX và wireframe; **Gate 1 Baseline (`v1.0.0` — APPROVED)** |
| [Quyết định](decisions.md) | Sổ quyết định (`D-01`–`D-14`) và biên bản phê duyệt Gate 1 (`v1.0.0`) |
| [Kế hoạch](plan.md) | Task DAG, đặc tả lát cắt đầu tiên (`REVIEW-01` đang `ready`); **Gate 1 Baseline (`v1.0.0` — APPROVED)** |
| [Kế hoạch RL](research/RL_PLAN.md) | Hợp đồng `Student Simulator` 24 chiều và thiết kế thực nghiệm `DQN` vs `B1/B2/B3`; **Gate 1 Baseline (`v1.0.0` — APPROVED)** |
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
