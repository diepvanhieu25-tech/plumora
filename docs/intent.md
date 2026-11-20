# Định hướng thực hiện Plumora

Phiên bản: `2.0.0` — **APPROVED (Gate 1 Baseline Giai đoạn 3 — Chủ dự án duyệt tại `D-16`..`D-26` ngày 2026-11-18; bảo lưu trọn vẹn lịch sử Gate 1 Baseline MVP `v1.0.0` duyệt tại `D-14` / `O-10` ngày 2026-11-16)**. Nguồn: [brief gốc](brief/project-direction.md), [báo cáo phân tích mở rộng Giai đoạn 3](proposals/PHASE3_ANALYSIS.md) và toàn bộ quyết định của chủ dự án (`D-01`–`D-26`) trong [sổ quyết định](decisions.md).

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

---

## Định hướng Mở rộng Giai đoạn sau MVP — Đích Giai đoạn 3 (`v2.0.0`)

- **Trạng thái:** `v2.0.0 — APPROVED (Gate 1 Baseline Giai đoạn 3 — Chủ dự án duyệt tại D-16..D-26 ngày 2026-11-18)` — Toàn bộ ý tưởng, đặc tả hành vi ([`spec.md`](spec.md) `v2.0.0`), thiết kế kiến trúc ([`design.md`](design.md) `v2.0.0`), hệ thống giao diện 20 màn hình ([`ui-design-system.md`](ui-design-system.md) `v2.0.0`), kế hoạch nghiên cứu RL ([`research/RL_PLAN.md`](research/RL_PLAN.md) `v2.0.0`) và lộ trình 4 lát cắt ([`plan.md`](plan.md) `v2.0.0`) đã được khóa chuẩn Gate 1 (chi tiết phân tích tại [PHASE3_ANALYSIS.md](proposals/PHASE3_ANALYSIS.md)).
- **Nền tảng kế thừa:** Toàn bộ hệ thống Giai đoạn 1 MVP (`v1.0.0` ở trên, đã hoàn thành Gate 1–4) là nền tảng đã kiểm chứng để mở rộng lên đích báo cáo đồ án ở **Giai đoạn 3**.

### 1. Mục tiêu, Bài toán & Giá trị Cốt lõi Mới (`P3-01`)

- **Bài toán & Giá trị cốt lõi:** **Xác định đúng năng lực học của từng học viên** và **gợi ý bước học tiếp theo phù hợp với năng lực học đó**, vượt qua hạn chế của các roadmap tĩnh hoặc LMS tuyến tính chỉ chấm đúng/sai bề mặt qua trắc nghiệm học thuộc.
- **Tích hợp Đánh giá chiều sâu năng lực (5 tầng đào sâu, 4 dạng bài thực tế, 4 mức hiểu):**
  - Phục vụ đồng thời **đánh giá năng lực, lõi RL và thiết kế lộ trình cá nhân hóa** theo luồng khép kín: `mục tiêu → đánh giá năng lực → thiết kế lộ trình → học/thực hành → đánh giá lại → điều chỉnh lộ trình`.
  - **Giữ nguyên định vị EdTech phát triển năng lực:** Không chuyển đổi Plumora thành ứng dụng luyện phỏng vấn đơn thuần.
  - Tuân thủ nguyên tắc tách 3 chiều đánh giá độc lập (*5 tầng câu hỏi*, *4 dạng bài thực tế*, *4 mức hiểu Surface/Applied/Deep/Mastery*) và tách bạch *bằng chứng quan sát – kết quả đánh giá – khuyến nghị RL*.

### 2. Đối tượng Người dùng, Vai trò & Cơ chế Tự động hóa (`Q-02`)

- **`Learner (Học viên)`:** Người dùng trung tâm của luồng học tập; hệ thống thực hiện **đánh giá năng lực tự động** và **kiểm duyệt nội dung/lộ trình bài học tự động** để cá nhân hóa bước học tiếp theo phù hợp năng lực.
- **`Chuyên gia (Expert)` & `Admin`:** Đảm nhiệm việc **soạn thảo nội dung / Knowledge Graph / rubric đánh giá** (`SCR-15`..`SCR-17`) và **kiểm tra, giám sát an toàn mô hình (`Model Inspection & Safety Auditing` — `SCR-18`..`SCR-20`)**.

### 3. Phạm vi Mở rộng: Kết hợp Giai đoạn 2 và Ba Trụ cột Giai đoạn 3 (`Q-01`, `Q-03`–`Q-07`)

1. **Lõi AI, Đánh giá Năng lực Thích ứng & Đa lĩnh vực (`Q-01`, `Q-03`, `Q-04`, `Q-06`):**
   - **Đa lĩnh vực & `GNN`:** Mở rộng từ đồ thị Backend sang 3 lĩnh vực mẫu cố định có giao thoa khái niệm (**`backend` 12 node, `frontend` 10 node, `devops` 9 node**) cùng đồ thị kiểm thử độc lập thứ 4 (**`heldout_data_eng_graph` 10 node** phục vụ đánh giá *Zero-shot Domain Transfer*); ứng dụng **Graph Neural Networks (`GNN`)** đọc cấu trúc Knowledge Graph và cho phép `Chuyên gia` định nghĩa đồ thị lĩnh vực mới mà không phải sửa mã nguồn.
   - **Tích hợp 3 tính năng Giai đoạn 2 làm tín hiệu năng lực & học tập:**
     - *Code Submission / Auto-grader:* Chấm bài thực hành và bài tập đọc/sửa code trong môi trường cô lập (`timeout <= 3000ms`, `RAM <= 128MB`, `network_mode: none`).
     - *Spaced Repetition (Đường cong lãng quên Ebbinghaus):* Đưa độ suy giảm ghi nhớ theo thời gian $R(t) = e^{-\Delta t / S}$ vào trạng thái RL để gợi ý ôn tập đúng thời điểm khi $R(t) < 0.60$.
     - *AI Tutor (LLM):* Hỗ trợ chấm/phản hồi theo rubric có cấu trúc và giải thích tự động cho các câu hỏi/tình huống đào sâu (kèm `DeterministicRubricGrader` fallback khi offline).
   - **Thuật toán RL nâng cao & Online Learning có giám sát:** Chuyển lên thuật toán xử lý không gian trạng thái/hành động lớn (`GNN-PPO` / `Actor-Critic`); kết hợp **Pre-training trên Simulator đa lĩnh vực nâng cao** với **Safe Micro-batch Online RL từ tương tác thật trên hệ thống**, đi kèm bộ lọc kiểm duyệt lộ trình tự động (`Policy Guardrail`) và công cụ để `Expert`/`Admin` kiểm tra, duyệt hoặc rollback mô hình 1-click.
2. **Kiến trúc Hệ thống Mở rộng & Hạ tầng Triển khai (`Q-01`, `Q-05`, `Q-07`):**
   - **Chuyển đổi sang 4 Microservices sau API Gateway:** Tách ranh giới dịch vụ độc lập (`user-auth-service`, `content-kg-service`, `assessment-grader-service`, `recommendation-ai-service`), mỗi dịch vụ sở hữu Schema PostgreSQL độc lập (`auth_svc`, `content_svc`, `assess_svc`, `rec_ai_svc`) và đồng bộ qua `Transactional Outbox` + `Redis Streams`.
   - **Môi trường vận hành & kiểm chứng:** Triển khai cụm Microservices chạy thực tế trên **Docker Compose cục bộ**, kèm bộ cấu hình/manifest **Kubernetes** chuẩn (`k8s/`) để chứng minh khả năng auto-scale lõi AI; kết nối **LLM qua Adapter** (hỗ trợ cả API thật lẫn chế độ local/fallback không phụ thuộc mạng khi bảo vệ); thực hiện kiểm thử tải cục bộ có số đo thực tế.

### 4. Thành công Cần Đánh giá ở Đích Giai đoạn 3 (Ngưỡng KPI Định lượng)

1. **Luồng nghiệp vụ & Giao diện 20 màn hình (`SCR-01`..`SCR-20`):** Luồng đánh giá chiều sâu tự động (*Adaptive Placement* tối đa 5–6 câu & *5-Depth Probing State Machine*) + khuyến nghị lộ trình cá nhân hóa `(concept_slug, learning_mode)` + thực hành Code Sandbox / ôn tập *Ebbinghaus* vận hành xuyên suốt trên 3 lĩnh vực (`backend` 12 node, `frontend` 10 node, `devops` 9 node) và cụm 4 Microservices.
2. **Ngưỡng thực nghiệm RL & Chuyển giao lĩnh vực (`PL3-RL-01`, `eval_seed = 2026`, `500` episodes/kịch bản):**
   - Thực nghiệm đối sánh 4 cấp công bằng (`Heuristics B1/B2/B3` vs `DQN-MLP` vs `PPO-MLP` vs `GNN-PPO`) trên cùng tập hồ sơ học viên.
   - `GNN-PPO (Unmasked)` đạt `invalid_action_rate < 5.0%`; chế độ có `Policy Guardrail` đạt `masked_violation_rate == 0.0%`.
   - Trên kịch bản **Zero-shot Domain Transfer** (`heldout_data_eng_graph` 10 node), `GNN-PPO` vượt `DQN-MLP` và `PPO-MLP` tối thiểu **$\ge 15\%$ về `completion_rate`** hoặc giảm **$\ge 15\%$ số bước `steps_to_completion`** mà không cần huấn luyện lại.
3. **Ngưỡng an toàn `Safe Micro-batch Online RL` (`INV-ONLINE-RL-01`):** Mọi `candidate_checkpoint` bắt buộc vượt qua `Automated Safety Evaluation Gate` (`200` kịch bản: `invalid_action_rate_unmasked < 5.0%`, `masked_violation_rate == 0.0%`, `mean_episodic_reward >= 0.98 * mean_reward(prod)`) trước khi mở khóa nút `Activate`; thao tác `1-Click Rollback` khôi phục checkpoint trước đó trong **$< 2000\text{ms}$**.
4. **Ngưỡng hiệu năng phi chức năng & Kiểm thử tải cục bộ (`Measurable NFRs`):**
   - Độ trễ suy luận API khuyến nghị `GNN-PPO` (`POST /api/v2/recommendations`): **$p95 < 250\text{ms}$** (khi nạp sẵn checkpoint trong bộ nhớ).
   - Giới hạn thực thi Worker **Code Sandbox cô lập**: **`timeout <= 3000ms`**, **`RAM <= 128MB`**, `network_mode: none`, hủy 100% vòng lặp vô hạn trong $\le 3.0\text{s}$.
   - Độ trễ đồng bộ sự kiện `Transactional Outbox` $\rightarrow$ `Redis Streams` $\rightarrow$ `recommendation-ai-service`: **$p95 < 500\text{ms}$**.
   - Kiểm thử tải cục bộ ở `P3-SLICE-4` với **20 người dùng đồng thời (`20 concurrent users`)** đạt tỷ lệ lỗi HTTP $5\text{xx} = 0.0\%$.
