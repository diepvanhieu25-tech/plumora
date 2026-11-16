# Định hướng thực hiện Plumora

Phiên bản: `1.0.0` — **APPROVED (Gate 1 Baseline — Chủ dự án duyệt tại `D-14` / `O-10` ngày 2026-11-16)**. Nguồn: [brief gốc](brief/project-direction.md) và toàn bộ quyết định của chủ dự án (`D-01`–`D-14`) trong [sổ quyết định](decisions.md).

## Mục tiêu

Xây dựng hệ thống quản lý học tập và khuyến nghị lộ trình cá nhân hóa dùng học tăng cường (Reinforcement Learning), đủ để trình bày, chạy minh chứng và đánh giá trong đồ án tốt nghiệp. Việc triển khai phải đồng thời thể hiện giá trị với người học và có bằng chứng mô hình thực sự được huấn luyện.

- **Đối tượng người dùng, Xác thực & Vai trò (`D-05` / `O-02`, `D-11` / `O-08` — Đã chốt):** Người học kiến thức Backend Developer (`Learner`). Hệ thống MVP chỉ xây dựng giao diện cho vai trò `Learner`, xác thực qua `Username + Password` (băm `Argon2id`/`bcrypt`, phiên `HttpOnly Cookie` hoặc `JWT Bearer Token`), cô lập dữ liệu chặt theo `current_user.id` và tối thiểu hóa dữ liệu cá nhân.
- **Trạng thái đầu vào & Tài khoản Demo thật (`D-05`, `D-11`):** Người học mới mặc định bắt đầu với điểm thông thạo (Mastery) `0.0` ở tất cả 12 khái niệm (2 khái niệm gốc Tầng 1 được mở khóa sẵn). Hệ thống seed sẵn **3 tài khoản học viên mẫu thật** (`learner_new`, `learner_foundation`, `learner_api_stage`) đi qua luồng xác thực và lưu trữ thật 100% (không dùng privileged bypass), kèm tính năng đặt lại tiến độ theo **Hồ sơ mẫu (Demo Presets)** (`POST /api/v1/me/preset`) để phục vụ trình diễn và kiểm thử quyết định của `DQN` ở các trạng thái khác nhau. Không xây dựng giao diện quản trị nội dung (Admin CRUD CMS); nội dung được nạp tự động từ file cấu hình Seed JSON/YAML trong Git.

## Ràng buộc thời gian, huấn luyện và môi trường Demo (`D-04` / `O-01` — Đã chốt)

- **Khung thời gian mục tiêu:** 4–5 tuần (4 tuần phát triển sản phẩm & thực nghiệm RL, 1 tuần cuối đóng gói báo cáo, kiểm thử tổng thể và chuẩn bị bảo vệ).
- **Hạ tầng huấn luyện & đánh giá RL (Hybrid Local CPU + Google Colab):** Pipeline huấn luyện (`train.py`) và đánh giá (`evaluate.py`) được đóng gói chuẩn trong repository với phiên bản thư viện khóa chặt. Mạng `MlpPolicy` của `DQN` được tối ưu nhẹ để chạy trọn vẹn trên CPU máy cá nhân trong vài phút, đồng thời tương thích chạy trên Google Colab khi cần chạy nhiều `seeds` / vẽ biểu đồ, miễn là xuất đầy đủ gói bằng chứng chuẩn (`checkpoint.zip`, mã băm `SHA-256`, `config/seed`, `training_log`, `evaluation_report`) về repository.
- **Môi trường chạy Demo bảo vệ:** Chạy cục bộ qua **Local Docker Compose** ngay trên máy cá nhân (kèm dữ liệu seed và model checkpoint đã kiểm chứng) để loại bỏ rủi ro phụ thuộc mạng hoặc hết hạn cloud tại hội đồng.

## Phạm vi Giai đoạn 1 theo brief và quyết định đã chốt

- **12 khái niệm cốt lõi Backend chia 4 tầng DAG (`D-05` / `O-02`):** Bao gồm Tầng 1 (`net-internet`, `os-basics`), Tầng 2 (`web-http`, `db-relational`, `db-transactions`, `db-nosql`), Tầng 3 (`api-rest`, `api-validation`, `api-data`, `cache-redis`) và Tầng 4 (`sec-authn`, `sec-api`); chi tiết đồ thị tiên quyết được đặc tả trong [spec.md](spec.md).
- **Quy tắc Quiz & Mastery (`D-06` / `O-03`):** Mỗi lượt làm Quiz cố định **4 câu hỏi Single-choice MCQ** (4 lựa chọn A/B/C/D, 1 đáp án đúng); ngưỡng thông thạo $\ge 75\%$ ($\ge 3/4$ câu đúng); cho phép làm lại không giới hạn, lưu lịch sử mọi lượt nộp (`QuizAttempt`) và cập nhật thông thạo theo mức cao nhất $\text{mastery}^{\text{new}} = \max(\text{mastery}^{\text{old}}, \text{attempt\_score})$.
- **Môi trường `Student Simulator` & Khuyến nghị `DQN` (`D-07` / `O-04`):** Môi trường `Gymnasium` có Observation 24 chiều (`12 mastery` + `12 is_eligible`, không lộ hệ số tiếp thu ngầm $\alpha$), Action `Discrete(12)`, hàm thưởng phạt rõ ràng cho hành động sai tiên quyết (`-5.0`), lặp bài đã thông thạo (`-3.0`), thưởng tiến bộ và hoàn thành 12/12 bài (`+15.0`), giới hạn `max_steps = 40`. Khi phục vụ người học trên API, hệ thống báo cáo minh bạch nguồn khuyến nghị (`dqn`, `dqn_masked_q`, hoặc `fallback_rule`).
- **Kiến trúc, Dữ liệu & Giao diện Mini-LMS (`B-03`, `D-09`–`D-13`):** Modular monolith với `FastAPI`, `PostgreSQL` (Single Source of Truth có ACID transaction và `UNIQUE (user_id, submission_id)` chống nộp lặp), `Redis` (Read/Write-through State Cache cho vector 24 chiều kèm cơ chế graceful fallback về PostgreSQL khi miss/down) và Frontend **React SPA (`Vite` + `TypeScript` + `Tailwind CSS` + `Node.js 22 LTS`)**. Hệ thống thiết kế giao diện ([`ui-design-system.md`](ui-design-system.md) `v0.2.0`) mang bản sắc **Chồi Cây Non (*Botanical Sprout & Sunlit Canopy*: `#15803D` / `#D97706` / `#0D9488` trên nền `#F6F8F5`)**, đạt chuẩn `WCAG 2.1 AA`, chỉ dùng **100% SVG Vector Icons `lucide-react` (cấm tuyệt đối emoji)**, gồm 8 màn hình/trạng thái (`SCR-01`–`SCR-08`) và đủ 5 trạng thái UX (`Ideal`, `Loading`, `Empty`, `Error`, `Disabled`).

## Ranh giới

Code submission/auto-grader, spaced repetition và AI Tutor nằm ở Giai đoạn 2. Microservices/Kubernetes, online RL, PPO/Actor-Critic và GNN nằm ở Giai đoạn 3. Chỉ chuyển vào MVP khi chủ dự án duyệt thay đổi phạm vi và tác động tiến độ.

## Luồng giá trị đề xuất

Người học có trạng thái ban đầu → nhận bài phù hợp → học và làm quiz → kết quả được lưu → cập nhật thông thạo → nhận khuyến nghị tiếp theo → xem tiến độ sau khi tải lại.

Đây là đề xuất để đặc tả, không tự xác lập cách đăng nhập, cách đánh giá đầu vào hoặc luật chọn bài. Phần RL được phát triển và đánh giá sớm song hành với lát cắt sản phẩm đầu tiên; tránh xây nhiều màn hình quản trị trước khi có bằng chứng cốt lõi.

## Thành công cần đánh giá

1. Luồng giá trị chạy trên ứng dụng và dữ liệu thật của hệ thống thử nghiệm.
2. Mô hình có training log, checkpoint, mã băm `SHA-256`, evaluation tái lập trên 3 seeds huấn luyện (`[101, 202, 303]`), 1 seed validation (`999`) và bộ 500 hồ sơ kiểm thử độc lập (`eval_seed = 2026`), và serving nạp đúng artifact (`D-04`, `D-08`).
3. So sánh công bằng với 3 phương pháp cơ sở (`B1 — Fixed Curriculum`, `B2 — Valid-Random`, `B3 — Greedy Mastery Heuristic`) dùng cùng Observation 24 chiều; đạt ngưỡng `invalid_action_rate < 5%` cho `DQN (Unmasked)`, vượt `B2` và cạnh tranh/vượt `B1`, `B3`, đồng thời báo cáo trung thực cả kết quả bất lợi và giới hạn simulator (`D-08`).
4. Có tài liệu thiết kế, hướng dẫn chạy và minh chứng phục vụ bảo vệ.

Ngưỡng hiệu quả RL trên simulator đã được chốt tại `D-08` (`O-05`); không suy diễn trực tiếp từ điểm thưởng mô phỏng sang hiệu quả học tập thực tế trên người thật.
