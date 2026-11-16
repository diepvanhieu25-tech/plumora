# Khung nghiên cứu RL

Phiên bản: `1.0.0` — **APPROVED (Gate 1 Baseline — Chủ dự án duyệt tại `D-04`, `D-05`, `D-06`, `D-07`, `D-08` và `D-14` ngày 2026-11-16)**. Nguồn định hướng là Gymnasium + DQN/Stable-Baselines3 trong brief và các quyết định của chủ dự án trong [decisions.md](../decisions.md) (`v1.0.0`). Thực thi huấn luyện và đánh giá (`RL-01`) sẽ tiến hành ngay sau khi hoàn tất thiết lập môi trường Gate 2 (`ENV-01`).

## Hạ tầng huấn luyện và chuỗi bàn giao artifact (`D-04` / `O-01` — Đã chốt)

- Pipeline huấn luyện (`train.py`) và đánh giá (`evaluate.py`) được đóng gói chuẩn trong repository với phiên bản thư viện khóa chặt.
- Mạng `MlpPolicy` của `DQN` được thiết kế gọn nhẹ để chạy trọn vẹn trên **Local CPU** trong vài phút, đồng thời hỗ trợ chạy trên **Google Colab** với cùng cấu hình và phiên bản thư viện khóa chặt.
- Mọi lượt huấn luyện được chọn phục vụ Demo phải xuất đầy đủ gói bằng chứng về repository (`checkpoint.zip`, mã băm `SHA-256`, `config/seed`, `training_log`, `evaluation_report`) để backend `FastAPI` nạp trong môi trường **Local Docker Compose**.

## Câu hỏi cần kiểm chứng

Trong simulator có giả định rõ ràng, chính sách DQN đạt kết quả nào so với các baseline dùng cùng thông tin và ngân sách? Hiệu quả trên simulator không tự chứng minh cải thiện việc học của người thật.

## Hợp đồng môi trường đã chốt (`D-07` / `O-04`)

- **Observation Space (`Box(low=0.0, high=1.0, shape=(24,), dtype=float32)`):**
  - `obs[0..11]`: Điểm `mastery` hiện tại của 12 khái niệm Backend ($\in \{0.00, 0.25, 0.50, 0.75, 1.00\}$).
  - `obs[12..23]`: Cờ nhị phân `is_eligible` ($1.0$ nếu khái niệm đã đủ điều kiện tiên quyết và $\text{mastery}_i < 0.75$; $0.0$ nếu đang khóa hoặc đã đạt $\ge 0.75$).
  - **Không lộ biến ẩn (No Data Leakage):** Hệ số tiếp thu ngầm $\alpha$ của học viên ảo chỉ nằm bên trong `Student Simulator`, tuyệt đối không đưa vào Observation của `DQN` hay các thuật toán Baseline.
- **Action Space (`Discrete(12)`):** Ứng với `action_id` $\in \{0, \dots, 11\}$ của 12 khái niệm Backend (`D-05`).
- **Khởi tạo Học viên ảo & Chuyển trạng thái (Transition):**
  - Mỗi episode lấy mẫu $\alpha \sim \text{Uniform}(0.35, 0.75)$; 70% episodes bắt đầu từ `mastery = 0.0` toàn bộ, 30% bắt đầu từ trạng thái dở dang hợp lệ trên DAG.
  - Khi học bài hợp lệ $a$, năng lực tiềm ẩn của học viên ở bài $a$ tăng theo $\alpha$ và độ khó tầng của bài, sau đó mô phỏng làm Quiz 4 câu theo $\text{Binomial}(4, p)$ để sinh `attempt_score` và cập nhật $\text{mastery}_a^{\text{new}} = \max(\text{mastery}_a^{\text{old}}, \text{attempt\_score})$ (`D-06`).
- **Hàm Phần thưởng (`Reward Function`) & Xử lý Hành động Không hợp lệ:**
  - Chọn bài chưa đủ điều kiện tiên quyết (`Locked`): Phạt $R = -5.0$, không đổi `mastery`, tăng bộ đếm `prerequisite_violation`.
  - Chọn lại bài đã thông thạo ($\text{mastery}_a \ge 0.75$): Phạt $R = -3.0$, không đổi `mastery`, tăng bộ đếm `redundant_action`.
  - Chọn bài hợp lệ (`is_eligible[a] == 1.0`):
    $$R = -0.5 + 4.0 \times (\text{mastery}_a^{\text{new}} - \text{mastery}_a^{\text{old}}) + 5.0 \times \mathbb{I}(\text{mastery}_a^{\text{new}} \ge 0.75 \land \text{mastery}_a^{\text{old}} < 0.75)$$
  - Hoàn thành cả 12/12 khái niệm trong bước đó: cộng thêm thưởng đích $+15.0$.
- **Điều kiện Kết thúc Episode (`Terminal` / `Truncated`):**
  - `terminated = True` khi cả 12/12 khái niệm đạt $\text{mastery}_i \ge 0.75$.
  - `truncated = True` khi chạm ngưỡng `max_steps = 40` bước/episode.
- **Hợp đồng Serving minh bạch trên API:**
  - Phân biệt rõ `policy_source = "dqn"` (khi `argmax Q(s,a)` hợp lệ), `policy_source = "dqn_masked_q"` (khi áp dụng lọc Q-value trên tập bài hợp lệ `is_eligible == 1.0`, kèm `guardrail_applied = true`), và `policy_source = "fallback_rule"` (khi thiếu/hỏng checkpoint).

## Thiết kế thực nghiệm và Ngưỡng nghiệm thu đã chốt (`D-08` / `O-05`)

- **Ba thuật toán cơ sở (`Baselines`) dùng cùng Observation 24 chiều (`12 mastery + 12 is_eligible`):**
  1. `B1 — Fixed Curriculum`: Chọn bài hợp lệ (`is_eligible == 1.0`) đầu tiên theo thứ tự chỉ số `0 -> 11` (học dứt điểm từng bài đến $\ge 0.75$ rồi sang bài kế tiếp).
  2. `B2 — Valid-Random`: Chọn ngẫu nhiên đều một bài trong tập các bài hợp lệ (`is_eligible == 1.0`).
  3. `B3 — Greedy Mastery Heuristic`: Trong các bài `is_eligible == 1.0`, ưu tiên chọn bài có điểm `mastery` hiện tại cao nhất để hoàn thành nhanh node đang dở; nếu bằng nhau thì chọn theo chỉ số nhỏ nhất.
  - Đối chiếu với cả 2 chế độ của mô hình: `DQN (Unmasked)` (đánh giá khả năng tự học luật tiên quyết của mạng) và `DQN (Masked Q)` (chế độ có lớp khóa an toàn dùng khi Serving).
- **Phân tách Seeds & Tập Hồ sơ Kiểm thử Độc lập (`Train / Val / Test Split`):**
  - **Training:** `train_seeds = [101, 202, 303]` (3 seeds độc lập, ngân sách tối thiểu `100.000 timesteps / seed`).
  - **Validation / Chọn Checkpoint:** `val_seed = 999` (`200 episodes` cố định) để chọn bộ siêu tham số và best checkpoint.
  - **Held-out Test Benchmark:** `eval_seed = 2026` sinh ra **500 hồ sơ học viên kiểm thử cố định**, hoàn toàn tách biệt với quá trình train/tune. Mọi thuật toán (`B1`, `B2`, `B3`, `DQN Unmasked`, `DQN Masked Q`) đều được đánh giá trên cùng 500 hồ sơ này.
- **Chỉ số đo lường & Ngưỡng nghiệm thu (`PL-RL-01`):**
  - Báo cáo `Mean ± Std` và `Median (IQR)` trên 500 test episodes cho 4 chỉ số: `completion_rate`, `steps_to_completion`, `episodic_reward`, và `invalid_action_rate`.
  - **Ngưỡng nghiệm thu kỹ thuật:**
    - `DQN (Unmasked)` tự học được cấu trúc DAG với `invalid_action_rate < 5%` trên tập Held-out Test (`eval_seed = 2026`).
    - `DQN` đạt kết quả vượt rõ rệt `B2 (Valid-Random)` và cạnh tranh hoặc vượt `B1` / `B3` về `episodic_reward` và `steps_to_completion`.
  - **Nguyên tắc trung thực khoa học:** Báo cáo đầy đủ cả trường hợp `DQN` tương đương hoặc kém hơn `B1`/`B3` (nếu có), phân tích độ nhạy của hàm thưởng và giới hạn của `Student Simulator`; không coi policy khai thác lỗi simulator là bằng chứng dạy tốt ngoài đời thực.

## Chuỗi bằng chứng

Config + mã/phiên bản dependency + seed → training log → checkpoint SHA-256 → evaluation/baselines → serving nạp đúng checkpoint → khuyến nghị/metadata quan sát được.

Không gọi heuristic là DQN hoặc suy từ import thư viện sang đã huấn luyện. Thiếu artifact phải thể hiện trạng thái thật theo contract được duyệt.

## Nhận định dài hạn trong brief

Các đề xuất PPO/Actor-Critic, GNN và chuyển giao domain ở Giai đoạn 3 là hướng nghiên cứu; chưa là cam kết hiệu quả hoặc bảo đảm không phải huấn luyện lại. Không đưa vào phạm vi hiện tại để né đánh giá DQN.
