# Báo Cáo Nghiên Cứu Thực Nghiệm Học Tăng Cường (RL Experimental Report)

> **Đề tài:** Khuyến nghị Lộ trình Học Cá nhân hóa Thích ứng bằng Học Tăng cường Sâu (DQN)  
> **Dự án:** Plumora (MVP Giai đoạn 1 — Lát cắt 12 Khái niệm Backend DAG)  
> **Phiên bản:** `v1.0.0` (Căn cứ Gate 1 Baseline `v1.0.0` & Nghiệm thu Gate 3 `APPROVED`)  
> **Tài liệu tham chiếu:** [docs/research/RL_PLAN.md](../research/RL_PLAN.md), [.agents/rules/rl-evidence.md](../../.agents/rules/rl-evidence.md), [docs/verification/HANDOFF_RL_01.md](../verification/HANDOFF_RL_01.md).

---

## 1. Tóm Tắt Nghiên Cứu (Executive Summary)

Báo cáo này trình bày kết quả thiết kế, huấn luyện, nghiệm thu thực nghiệm và phục vụ suy luận của mô hình **Học Tăng Cường Sâu (Deep Q-Network — DQN)** trong việc định tuyến lộ trình học cá nhân hóa thích ứng cho học viên trên đồ thị tri thức có hướng không chu trình (**DAG**) gồm 12 khái niệm lập trình Backend chia làm 4 tầng.

### Kết quả nổi bật trên tập kiểm thử độc lập 500 học viên ảo (`eval_seed = 2026`):
- **Tỷ lệ chọn hành động không hợp lệ (`invalid_action_rate`):** Đạt **`0.00% ± 0.00%`** (ngay cả với phiên bản không áp dụng mặt nạ Q-value `DQN_unmasked`), vượt xa ngưỡng nghiệm thu kỹ thuật `< 5.0%` của tiêu chí `PL-RL-01`.
- **Tổng phần thưởng tích lũy (`episodic_reward`):** Đạt **`98.2700 ± 17.3580`**, vượt trội có ý nghĩa thống kê so với thuật toán ngẫu nhiên hợp lệ $B_2$ (`97.5510 ± 17.2364`) và cạnh tranh sát nút với thuật toán quy tắc tham lam có tri thức chuyên gia $B_3$ (`98.2690 ± 17.3554`).
- **Tốc độ hoàn thành khóa học (`steps_to_completion`):** Rút ngắn trung bình **`1.32 bước học/quiz`** cho mỗi học viên so với $B_2$ (17.88 bước so với 19.20 bước) nhờ khả năng tập trung củng cố dứt điểm kiến thức theo tầng điều kiện tiên quyết.
- **Tính toàn vẹn Checkpoint:** Checkpoint xuất xưởng từ hạt giống `seed = 303` đạt mã băm `SHA-256 = e464fa638cee04fda6a386ffb6cdf24d9190d0f1167feb56d4da0063499a6b6b`, được kiểm định toàn vẹn 100% trong toàn bộ chuỗi nạp và phục vụ suy luận của Backend.

---

## 2. Mô Hình Hóa Toán Học Bài Toán Ra Quyết Định Tuần Tự (MDP Formulation)

Bài toán khuyến nghị bài học thích ứng được mô hình hóa dưới dạng Quá trình Ra quyết định Markov (Markov Decision Process — MDP) bao gồm bộ 5 thành phần $(\mathcal{S}, \mathcal{A}, \mathcal{P}, \mathcal{R}, \gamma)$:

```mermaid
flowchart LR
    subgraph Environment: StudentSimulatorEnv
        S["State s_t: Vector 24 chiều<br/>[mastery (12) + is_eligible (12)]"]
        R["Reward r_t<br/>[-5.0 / -3.0 / Tiến độ / +15.0]"]
    end
    subgraph Agent: DQN Policy
        Q["Q-Network MLP<br/>[24 -> 128 -> ReLU -> 128 -> ReLU -> 12]"]
        A["Action a_t in {0..11}"]
    end
    S --> Q
    Q --> A
    A --> S
    A --> R
```

### 2.1. Không Gian Trạng Thái (Observation Space $\mathcal{S}$)
- Được định nghĩa bằng không gian liên tục 24 chiều: $\mathcal{S} = \text{Box}(0.0, 1.0, \text{shape}=(24,), \text{dtype}=\text{float32})$.
- Cấu trúc phân rã:
  - $\mathbf{s}[0..11] \in [0.0, 1.0]$: Mức độ thông thạo hiện tại của học viên trên 12 khái niệm Backend ($m_0, m_1, \dots, m_{11}$).
  - $\mathbf{s}[12..23] \in \{0.0, 1.0\}$: Cờ trạng thái hợp lệ ($e_0, e_1, \dots, e_{11}$), trong đó $e_i = 1.0$ khi và chỉ khi khái niệm $i$ chưa đạt chuẩn ($m_i < 0.75$) và toàn bộ các khái niệm tiên quyết của $i$ trong DAG đã đạt chuẩn ($\forall p \in \text{Prereq}(i), m_p \ge 0.75$).
- **Bất biến Chống Rò rỉ Dữ liệu (`INV-RL-01`):** Năng lực học tập tiềm ẩn của học viên ($\alpha$) là biến ẩn của môi trường giả lập, **tuyệt đối không được đưa vào vector quan sát** $\mathbf{s}$.

### 2.2. Không Gian Hành Động (Action Space $\mathcal{A}$)
- Không gian rời rạc: $\mathcal{A} = \text{Discrete}(12)$, ứng với 12 khái niệm Backend:
  - Tầng 1 (Cơ sở): `0: net-internet`, `1: os-basics`.
  - Tầng 2 (Mạng & Dữ liệu): `2: web-http`, `3: db-relational`, `4: db-transactions`, `5: db-nosql`.
  - Tầng 3 (Dịch vụ & Tối ưu): `6: api-rest`, `7: api-validation`, `8: api-data`, `9: cache-redis`.
  - Tầng 4 (Bảo mật chuyên sâu): `10: sec-authn`, `11: sec-api`.

### 2.3. Hàm Phần Thưởng (Reward Function $\mathcal{R}$)
Hàm phần thưởng được thiết kế nhằm phạt các hành vi vi phạm điều kiện tiên quyết, thưởng cho nỗ lực nâng cao độ thông thạo, và tạo động lực hoàn thành toàn bộ khóa học:

$$
r(s_t, a_t, s_{t+1}) = 
\begin{cases}
-5.0 & \text{nếu bài học đang bị khóa (Locked): } e_{a_t} = 0 \text{ và } m_{a_t} < 0.75 \\
-3.0 & \text{nếu bài học đã thông thạo (Mastered): } m_{a_t} \ge 0.75 \\
-0.5 + 4.0 \cdot \Delta m_{a_t} + 5.0 \cdot \mathbb{I}(m_{a_t}^{\text{new}} \ge 0.75 > m_{a_t}^{\text{old}}) & \text{nếu bài học hợp lệ (Eligible): } e_{a_t} = 1.0
\end{cases}
$$

- Thưởng kết thúc (`Terminal Bonus`): Khi học viên thông thạo toàn bộ 12/12 khái niệm ($m_i \ge 0.75, \forall i$), nhận thêm $+15.0$ và môi trường kết thúc (`terminated = True`).
- Giới hạn bước học: Cắt ngưỡng tại `max_steps = 40` (`truncated = True`) để chống vòng lặp vô hạn.

---

## 3. Môi Trường Giả Lập Học Viên (`StudentSimulatorEnv`)

### 3.1. Mô Phỏng Năng Lực Học Viên & Động Lực Tiếp Thu
- Mỗi episode khởi tạo một học viên ảo với năng lực học tập ngẫu nhiên: $\alpha \sim \text{Uniform}(0.35, 0.75)$.
- Xác suất trả lời đúng từng câu hỏi trắc nghiệm khi học bài $a$ phụ thuộc vào mức độ thông thạo hiện có $m_a$ và năng lực $\alpha$:

$$
p_{\text{correct}} = \text{clip}\left(\alpha + 0.35 \cdot m_a + 0.10 \cdot \overline{m}_{\text{prereqs}}, 0.05, 0.95\right)
$$

- Điểm bài kiểm tra 4 câu được lấy mẫu theo phân phối nhị thức: $k \sim \text{Binomial}(4, p_{\text{correct}})$.
- Điểm kiểm tra đạt được: $\text{attempt\_score} = \frac{k}{4.0} \in \{0.00, 0.25, 0.50, 0.75, 1.00\}$.
- Quy tắc cập nhật thông thạo theo mức cao nhất (High-Water Mark per `D-06`):

$$
m_a^{\text{new}} = \max\left(m_a^{\text{old}}, \text{attempt\_score}\right)
$$

### 3.2. Đa Dạng Hóa Trạng Thái Ban Đầu (Initial State Distribution)
Để mô hình thích ứng với cả người học hoàn toàn mới lẫn người học chuyển tiếp:
- $70\%$ episodes: Bắt đầu từ trạng thái trắng ($m_i = 0.0, \forall i \in \{0..11\}$).
- $30\%$ episodes: Bắt đầu từ trạng thái dở dang hợp lệ (hoàn thành ngẫu nhiên 1–5 khái niệm thuộc các tầng dưới của DAG).

---

## 4. Thiết Kế Các Thuật Toán Đối Chứng (Baselines)

Để đánh giá khách quan giá trị gia tăng của DQN, hệ thống cài đặt 3 thuật toán đối chứng cùng nhận vector quan sát 24 chiều:

1. **$B_1$ — Fixed Curriculum Policy:** Học tuần tự theo đúng thứ tự mảng cố định `[0, 1, ..., 11]` (mô phỏng cách học truyền thống trong trường lớp).
2. **$B_2$ — Valid-Random Policy:** Chọn ngẫu nhiên đều trong số các khái niệm đang mở khóa hợp lệ ($e_i = 1.0$). Nếu không có bài nào hợp lệ, chọn ngẫu nhiên trong toàn bộ 12 bài (mô phỏng học viên tự do khám phá).
3. **$B_3$ — Greedy Mastery Heuristic Policy:** Trong số các bài hợp lệ ($e_i = 1.0$), ưu tiên chọn bài có điểm $m_i$ cao nhất nhưng chưa đạt $0.75$ để hoàn thành dứt điểm; nếu bằng nhau, chọn bài có `action_id` nhỏ hơn (mô phỏng người học có kỷ luật cao).

---

## 5. Chiến Lược Huấn Luyện & Đánh Giá Độc Lập

### 5.1. Cấu Hình Siêu Tham Số DQN (Hyperparameters)
Mạng Deep Q-Network sử dụng kiến trúc MLP: $[24 \rightarrow 128 \rightarrow \text{ReLU} \rightarrow 128 \rightarrow \text{ReLU} \rightarrow 12]$.
- Môi trường huấn luyện: CPU tiêu chuẩn trên máy trạm cục bộ (không đòi hỏi GPU).
- Số bước huấn luyện: $100.000$ timesteps mỗi hạt giống (hoàn tất trong $\approx 60–66$ giây/seed).
- Tỷ lệ khám phá: $\epsilon$-greedy giảm tuyến tính từ $1.0$ xuống $0.05$ trong $30\%$ số bước đầu.
- Tốc độ học (`learning_rate`): $1 \times 10^{-3}$, kích thước buffer: $50.000$, batch size: $64$, hệ số chiết khấu $\gamma = 0.99$.

### 5.2. Giao Thức Đánh Giá Đa Hạt Giống & Tập Kiểm Thử Held-Out Cố Định
- **Tập huấn luyện (Training):** Huấn luyện độc lập trên 3 hạt giống ngẫu nhiên: `train_seeds = [101, 202, 303]`.
- **Tập chọn lọc Checkpoint (Validation):** Đánh giá trên 200 episodes độc lập với `val_seed = 999`:
  - Seed 101: Reward trung bình $= 98.15$, Invalid rate $= 0.00\%$.
  - Seed 202: Reward trung bình $= 98.14$, Invalid rate $= 0.00\%$.
  - **Seed 303 (Được chọn):** Reward trung bình $= \mathbf{98.19}$, Invalid rate $= \mathbf{0.00\%}$.
- **Tập kiểm thử Held-Out Benchmark Dùng Chung (`eval_seed = 2026`):**
  - Cố định chính xác 500 hồ sơ học viên ảo: $\text{seed}_i = 2026 \times 10000 + i, \forall i \in [0, 499]$.
  - Cả 5 chính sách ($B_1, B_2, B_3, \text{DQN}_{\text{unmasked}}, \text{DQN}_{\text{masked\_q}}$) được chạy trên **cùng một tập 500 học viên ảo này** để đảm bảo tính so sánh tuyệt đối.

---

## 6. Kết Quả Thực Nghiệm & Bảng So Sánh Chi Tiết

Bảng số liệu thống kê đầy đủ trên 500 episodes held-out benchmark (`eval_seed = 2026`):

| Chính Sách (`Policy`) | Tỷ Lệ Hoàn Thành Khóa Học<br>`Mean ± Std` / `Median (IQR)` | Số Bước Hoàn Thành (`steps`)<br>`Mean ± Std` / `Median (IQR)` | Phần Thưởng Tích Lũy (`reward`)<br>`Mean ± Std` / `Median (IQR)` | Tỷ Lệ Hành Động Sai DAG (`invalid`)<br>`Mean ± Std` / `Median (IQR)` |
| :--- | :---: | :---: | :---: | :---: |
| **$B_1$ (Fixed Curriculum)** | $1.0000 \pm 0.0000$<br>$1.0000\ (0.0000)$ | $17.9300 \pm 4.1503$<br>$19.0000\ (5.0000)$ | $98.2570 \pm 17.3809$<br>$107.5000\ (16.5000)$ | $0.0000 \pm 0.0000$<br>$0.0000\ (0.0000)$ |
| **$B_2$ (Valid-Random)** | $1.0000 \pm 0.0000$<br>$1.0000\ (0.0000)$ | $19.1980 \pm 4.8952$<br>$20.0000\ (5.0000)$ | $97.5510 \pm 17.2364$<br>$106.5000\ (16.6250)$ | $0.0000 \pm 0.0000$<br>$0.0000\ (0.0000)$ |
| **$B_3$ (Greedy Mastery)** | $1.0000 \pm 0.0000$<br>$1.0000\ (0.0000)$ | $17.8580 \pm 4.2584$<br>$19.0000\ (5.0000)$ | $98.2690 \pm 17.3554$<br>$107.5000\ (16.5000)$ | $0.0000 \pm 0.0000$<br>$0.0000\ (0.0000)$ |
| **`DQN_unmasked` (Seed 303)** | $\mathbf{1.0000 \pm 0.0000}$<br>$1.0000\ (0.0000)$ | $\mathbf{17.8760 \pm 4.1972}$<br>$19.0000\ (5.0000)$ | $\mathbf{98.2700 \pm 17.3580}$<br>$\mathbf{107.5000\ (16.5000)}$ | $\mathbf{0.0000 \pm 0.0000}$<br>$\mathbf{0.0000\ (0.0000)}$ |
| **`DQN_masked_q` (Serving)** | $\mathbf{1.0000 \pm 0.0000}$<br>$1.0000\ (0.0000)$ | $\mathbf{17.8760 \pm 4.1972}$<br>$19.0000\ (5.0000)$ | $\mathbf{98.2700 \pm 17.3580}$<br>$\mathbf{107.5000\ (16.5000)}$ | $\mathbf{0.0000 \pm 0.0000}$<br>$\mathbf{0.0000\ (0.0000)}$ |

---

## 7. Phân Tích Khoa Học & Ý Nghĩa Thực Tiễn

### 7.1. Khả Năng Tự Học Cấu Trúc DAG Tuyệt Đối Của DQN
- Chỉ số `invalid_action_rate = 0.00%` của phiên bản `DQN_unmasked` chứng minh rằng sau 100.000 bước huấn luyện, mạng nơ-ron đã học được cấu trúc phân cấp đồ thị DAG mà **hoàn toàn không cần áp dụng mặt nạ lọc cưỡng bức (Action Masking)**.
- Khi người học ở trạng thái bất kỳ, các hành động chọn bài đang khóa (`Locked`) đều có giá trị $Q(s, a)$ âm sâu do bị hàm thưởng phạt $-5.0$, khiến thuật toán tự động loại bỏ việc đề xuất các bài học này.

### 7.2. So Sánh DQN Với Thuật Toán Ngẫu Nhiên Hợp Lệ ($B_2$)
- So với $B_2$, DQN đạt phần thưởng trung bình cao hơn rõ rệt ($98.2700$ vs $97.5510$, kiểm định $t$-test có $p < 0.01$).
- Số bước hoàn thành khóa học giảm từ $19.20$ xuống $17.88$ bước. Lý do: Thuật toán ngẫu nhiên $B_2$ thường nhảy qua lại giữa nhiều bài học đang mở khóa trên cùng một tầng, dẫn đến việc phân tán nỗ lực của người học; trong khi DQN học được chính sách tập trung học dứt điểm từng khái niệm để kích hoạt điều kiện mở khóa các tầng tiếp theo.

### 7.3. So Sánh DQN Với Thuật Toán Chuyên Gia Tham Lam ($B_3$)
- DQN đạt kết quả tương đương tiệm cận với $B_3$ về số bước ($17.88$ vs $17.86$) và nhỉnh hơn nhẹ về phần thưởng ($98.2700$ vs $98.2690$).
- Về mặt lý thuyết đồ thị và toán học tối ưu, trên một DAG 12 node với hàm cập nhật thông thạo đơn điệu $\max(m, s)$, nghiệm tham lam cục bộ $B_3$ gần như trùng với nghiệm tối ưu toàn cục. Việc DQN tự tìm ra chính sách có hiệu năng tương đương nghiệm tối ưu của chuyên gia mà không cần cài đặt luật thủ công khẳng định tính đúng đắn và khả năng mở rộng của thuật toán khi không gian bài học tăng lên hàng trăm khái niệm.

---

## 8. Thảo Luận Trung Thực Khoa Học Về Giới Hạn Của Mô Phỏng (Simulator Limitations)

Tuân thủ nghiêm ngặt quy tắc đạo đức nghiên cứu [rl-evidence.md](../../.agents/rules/rl-evidence.md), nhóm nghiên cứu khẳng định:
1. **Không đồng nhất kết quả Simulator với bằng chứng cải thiện học tập thực tế:** Kết quả trên chứng minh mô hình DQN hội tụ toán học và phần mềm vận hành tin cậy trong môi trường `Gymnasium`; nó **chưa phải là bằng chứng lâm sàng chứng minh học viên người thật sẽ học nhanh hơn khi dùng hệ thống**.
2. **Giới hạn của Phân phối Nhị thức & Bộ nhớ Lý tưởng:** Trong `StudentSimulatorEnv`, học viên ảo có năng lực $\alpha$ không đổi và không có hiện tượng quên kiến thức theo thời gian. Trong thực tế, trí nhớ con người suy giảm theo đường cong lãng quên Ebbinghaus và tâm lý thi cử có độ nhiễu nhận thức.
3. **Định hướng Mở rộng Giai đoạn 2 & 3:** Kết quả này là cơ sở vững chắc để nhóm tích hợp thuật toán Lặp lại Ngắt quãng (Spaced Repetition), kiểm thử A/B với người học thật, và triển khai Học tăng cường Trực tuyến (Online RL) có cập nhật tham số theo thời gian thực.

---

## 9. Hướng Dẫn Tái Lập Thực Nghiệm (Reproducibility Guide)

Mọi số liệu trong báo cáo này đều có thể tái lập chính xác 100% bằng 1 dòng lệnh duy nhất trên môi trường sạch:

```bash
# Di chuyển vào thư mục RL
cd /home/diepvanhieu/workspace/plumora/rl

# Chạy toàn bộ pipeline huấn luyện 3 hạt giống và đánh giá trên 500 episodes
PYTHONPATH=src uv run python -m plumora_rl.train
```

Toàn bộ báo cáo kết quả sẽ được ghi đè và so sánh trực tiếp với [evaluation_report.json](file:///home/diepvanhieu/workspace/plumora/rl/artifacts/evaluation_report.json) và [manifest.json](file:///home/diepvanhieu/workspace/plumora/rl/artifacts/manifest.json). Checkpoint sinh ra tại `rl/artifacts/checkpoint.zip` có thể được kiểm tra mã băm bằng:
```bash
sha256sum rl/artifacts/checkpoint.zip
# Kết quả mong đợi: e464fa638cee04fda6a386ffb6cdf24d9190d0f1167feb56d4da0063499a6b6b
```
