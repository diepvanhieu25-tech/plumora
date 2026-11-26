# Khung nghiên cứu RL

Phiên bản: `2.0.0` — **APPROVED (Gate 1 Baseline Giai đoạn 3 — Chủ dự án duyệt tại `D-16`..`D-26` ngày 2026-11-18; bảo lưu trọn vẹn lịch sử Gate 1 Baseline MVP `v1.0.0` duyệt tại `D-04`..`D-08` và `D-14` ngày 2026-11-16)**. Nguồn định hướng: Gymnasium + Stable-Baselines3 `DQN` (MVP `v1.0.0`) và mở rộng `GNN-PPO` + Đa lĩnh vực + `Safe Micro-batch Online RL` (Giai đoạn 3 `v2.0.0`) trong [intent.md](../intent.md) (`v2.0.0`), [spec.md](../spec.md) (`v2.0.0`), [design.md](../design.md) (`v2.0.0`) và [decisions.md](../decisions.md) (`v2.0.0`).

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
  - Khi học bài hợp lệ $a$, năng lực tiềm ẩn của học viên ở bài $a$ tăng theo $\alpha$ và độ khó tầng của bài, sau đó mô phỏng làm Quiz 4 câu theo $\text{Binomial}(4, p)$ để sinh `attempt_score` và cập nhật $\text{mastery}_a^{\text{new}} = \max(\text{mastery}_a^{\text{old}}, \text{attempt\textunderscore score})$ (`D-06`).
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

---

## Thiết kế Mở rộng Giai đoạn 3: `GNN-PPO`, Đa lĩnh vực & `Safe Micro-batch Online RL` (`v2.0.0` — APPROVED tại `D-20`, `D-21`, `D-25`, `D-26`)

- **Nguồn căn cứ:** [intent.md](../intent.md) (`v2.0.0`), [spec.md](../spec.md) (`v2.0.0`: `PL3-RL-01`, `PL3-GUARD-01`), [proposals/PHASE3_ANALYSIS.md](../proposals/PHASE3_ANALYSIS.md) và quyết định của chủ dự án (`D-20`, `D-21`, `D-25`, `D-26` ngày `2026-11-18`).
- **Mục tiêu nghiên cứu mở rộng:** Chứng minh sự kết hợp giữa **Graph Neural Networks (`GNN`)** đọc cấu trúc đồ thị không phụ thuộc lĩnh vực với thuật toán **Actor-Critic (`PPO`)** trên hồ sơ năng lực chiều sâu + đường cong nhớ *Ebbinghaus* giúp:
  1. Cá nhân hóa đồng thời **Khái niệm đích** và **Chế độ học** sát năng lực học viên hơn so với chỉ chọn bài MCQ phẳng.
  2. Chuyển giao chính sách học tập sang **lĩnh vực mới chưa từng thấy khi huấn luyện (*Zero-shot Domain Transfer*)** mà không bị phụ thuộc cố định vào số lượng node như mạng `MLP` truyền thống.
  3. Tinh chỉnh liên tục từ dữ liệu tương tác thật một cách an toàn thông qua **`Safe Micro-batch Online RL`**.

### 1. Biểu diễn Trạng thái Đồ thị Không phụ thuộc Lĩnh vực & Phân phối Học viên Ảo (`Domain-Agnostic Graph Observation & Simulator Dynamics`)

Một đồ thị lĩnh vực $\mathcal{G} = (\mathcal{V}, \mathcal{E})$ có $|\mathcal{V}| = N$ khái niệm (với $N$ thay đổi linh hoạt theo từng lĩnh vực: `backend` $N=12$, `frontend` $N=10$, `devops` $N=9$, `heldout_data_eng_graph` $N=10$, hoặc lĩnh vực mới do `Expert` tạo) và tập cạnh tiên quyết có hướng $\mathcal{E}$.

- **Vector Đặc trưng trên mỗi Node $v \in \mathcal{V}$ (`Node Feature Vector` $\mathbf{x}_v \in \mathbb{R}^{8}$, chuẩn hóa trong $[0.0, 1.0]$):**
  1. `depth_level_norm`: Mức hiểu đã kiểm chứng hiện tại ($0.0 = \text{Untested}, 0.25 = \text{Surface}, 0.50 = \text{Applied}, 0.75 = \text{Deep Understanding}, 1.00 = \text{Mastery}$).
  2. `confidence`: Độ chắc chắn của bằng chứng đánh giá hiện tại ($\in [0.0, 1.0]$).
  3. `retention_ebbinghaus`: Hệ số duy trì trí nhớ tức thời $R_v(t) = e^{-\Delta t_v / S_{\text{eff}, v}} \in (0.0, 1.0]$.
  4. `is_eligible`: Cờ nhị phân mở khóa tiên quyết ($1.0$ nếu $\forall u \in \text{prereq}(v): \text{depth\textunderscore level\textunderscore norm}_u \ge 0.75$, ngược lại $0.0$).
  5. `needs_review`: Cờ cảnh báo suy giảm trí nhớ ($1.0$ nếu $\text{depth\textunderscore level\textunderscore norm}_v \ge 0.50 \land R_v(t) < 0.60$, ngược lại $0.0$).
  6. `tier_difficulty`: Độ khó phân tầng chuẩn hóa của khái niệm ($\text{tier} / 4.0 \in \{0.25, 0.50, 0.75, 1.00\}$).
  7. `code_practice_score`: Điểm bài thực hành Code Sandbox gần nhất của node ($\in [0.0, 1.0]$).
  8. `is_goal_path`: Cờ nhị phân ($1.0$ nếu node nằm trên đường đi tiên quyết dẫn tới mục tiêu lĩnh vực hiện tại của học viên).
- **Phân phối Tham số Học viên Ảo Khóa chặt (`Virtual Learner Parameter Distributions` — Cấm lộ vào Observation):**
  - Tốc độ tiếp thu kiến thức nền tảng: $\alpha \sim \text{Uniform}(0.35, 0.75)$.
  - Hệ số tốc độ quên cá nhân (*Forgetting Rate Multiplier*): $\lambda_{\text{forget}} \sim \text{Uniform}(0.8, 1.2)$, điều chỉnh độ bền hiệu dụng $S_{\text{eff}, v} = S_v / \lambda_{\text{forget}}$.
  - Năng lực thực hành lập trình tiềm ẩn: $\beta_{\text{code}} \sim \text{Uniform}(0.35, 0.80)$.
  - Bước thời gian mô phỏng mỗi hành động: **$\Delta t = 1.0$ ngày / step** (sau mỗi step, mọi node $u \ne v$ đã học có $\Delta t_u \leftarrow \Delta t_u + 1.0$ và suy giảm $R_u(t) = e^{-\Delta t_u / S_{\text{eff}, u}}$).
  - **Không lộ biến ẩn (`No Data Leakage`):** Cả 3 biến ẩn $(\alpha, \lambda_{\text{forget}}, \beta_{\text{code}})$ chỉ nằm bên trong `MultiDomainStudentSimulatorEnv`, tuyệt đối không xuất hiện trong $\mathbf{x}_v$.

### 2. Không gian Hành động Phân tách (`Factored Action Space`) & Cài đặt 3 Lớp `GNN Graph Encoder` bằng PyTorch Tensor Thuần

- **Không gian hành động của RL (`Action Space`):**
  Tại mỗi bước quyết định cấp lộ trình, mô hình RL chọn một cặp hành động $a = (v, m)$ với:
  - $v \in \{0, \dots, N-1\}$: Khái niệm đích trong đồ thị hiện tại.
  - $m \in \{0, 1, 2, 3\}$: Chế độ học tập tương ứng:
    - $0 = \text{Learn\textunderscore New}$ (Học lý thuyết & đánh giá nền tảng Tầng 1–2 khi chưa đạt `Applied`).
    - $1 = \text{Deep\textunderscore Probe}$ (Đào sâu tình huống/đánh đổi/nội tại Tầng 3–5 để nâng từ `Applied` lên `Deep`/`Mastery`).
    - $2 = \text{Code\textunderscore Practice}$ (Thực hành *Code Review & Refactoring* trên Sandbox để củng cố kỹ năng áp dụng & bản chất).
    - $3 = \text{Spaced\textunderscore Review}$ (Ôn tập ngắt quãng phục hồi $R_v(t) \rightarrow 1.0$ và tăng độ bền trí nhớ $S_v$).
  - *(Lưu ý ranh giới)*: Khi đã vào trong một phiên đánh giá của node $v$, việc chuyển câu hỏi từ Tầng $1 \rightarrow 5$ do **Assessment State Machine** điều khiển tất định theo kết quả trả lời, không làm phình không gian hành động của RL.
- **Kiến trúc `GNN Actor-Critic` (`GNN-PPO`) cài đặt bằng PyTorch Tensor / Directed Adjacency Message Passing thuần:**
  1. **Bộ mã hóa Đồ thị 3 Lớp (`3-Layer Directed Adjacency GNN Encoder`):**
     Để chạy cực nhanh, ổn định 100% trên **Local CPU và GitHub Actions CI** mà không phụ thuộc các thư viện C++ biên dịch nặng (`torch-scatter`/`torch-sparse`), bộ mã hóa sử dụng phép nhân ma trận kề có hướng chuẩn hóa bậc bằng **PyTorch Tensor thuần (`torch.matmul` / `nn.Linear`)**:
     - Gọi $\mathbf{H}^{(0)} = \text{Linear}_{8 \to 64}(\mathbf{X}) \in \mathbb{R}^{N \times 64}$ là biểu diễn khởi tạo của $N$ node.
     - Với hai ma trận kề chuẩn hóa bậc theo chiều cạnh đi vào từ tiên quyết $\tilde{\mathbf{A}}_{\text{in}} = \mathbf{D}_{\text{in}}^{-1}\mathbf{A}_{\text{prereq}\to\text{node}}$ và chiều cạnh đi ra tới bài phụ thuộc $\tilde{\mathbf{A}}_{\text{out}} = \mathbf{D}_{\text{out}}^{-1}\mathbf{A}_{\text{node}\to\text{dep}}$, công thức truyền thông điệp tại lớp $l \in \{0, 1, 2\}$ ($L = 3$ lớp) là:
       $$\mathbf{H}^{(l+1)} = \text{LayerNorm}\left(\mathbf{H}^{(l)} + \text{GELU}\left(\mathbf{H}^{(l)}\mathbf{W}_{\text{self}}^{(l)} + \tilde{\mathbf{A}}_{\text{in}}\mathbf{H}^{(l)}\mathbf{W}_{\text{prereq}}^{(l)} + \tilde{\mathbf{A}}_{\text{out}}\mathbf{H}^{(l)}\mathbf{W}_{\text{dep}}^{(l)}\right)\right)$$
     - Vector ngữ cảnh toàn đồ thị được tổng hợp qua phép gộp trung bình có mặt nạ:
       $$\mathbf{g} = \text{MeanPool}\left(\{\mathbf{h}_v^{(3)}\}_{v \in \mathcal{V}}\right) = \frac{1}{N}\sum_{v=0}^{N-1} \mathbf{h}_v^{(3)} \in \mathbb{R}^{64}$$
  2. **Nhánh Actor không phụ thuộc kích thước đồ thị (`Node-wise Scoring Head`):** Với mỗi node $v \in \mathcal{V}$ và chế độ $m \in \{0..3\}$, mạng tính logit $z_{v, m} = f_{\theta}([\mathbf{h}_v^{(3)} \,\|\, \mathbf{g}]) \in \mathbb{R}^{4}$ (tổng cộng $N \times 4$ logits). Nhờ chia sẻ tham số $\mathbf{W}_{\text{self}}, \mathbf{W}_{\text{prereq}}, \mathbf{W}_{\text{dep}}, f_{\theta}$ theo từng node, cùng một bộ trọng số đã huấn luyện có thể suy luận trên đồ thị có $N=9, 10, 12$ hay $N=50$ node bất kỳ mà không phải huấn luyện lại.
  3. **Nhánh Critic (`Value Head`):** Dự đoán giá trị trạng thái toàn đồ thị $V_{\phi}(\mathcal{G}) = v_{\phi}(\mathbf{g}) \in \mathbb{R}$.

### 3. Hàm Phần thưởng Đa mục tiêu, Chi phí Nhận thức & Điều kiện Dừng (`Reward, Cognitive Cost & Termination`)

Tuân thủ bất biến `INV-DEPTH-01` (không dùng điểm số thô chưa kiểm chứng của LLM làm reward trực tiếp):
- **Vi phạm tiên quyết DAG (`is_eligible[v] == 0`):** Phạt $R = -5.0$ (tăng `prerequisite_violation`, không đổi năng lực).
- **Lặp thừa vô ích** (chọn $\text{Learn\textunderscore New}$ khi đã đạt $\text{Mastery} = 1.00$ và $R_v(t) \ge 0.85$, hoặc chọn $\text{Spaced\textunderscore Review}$ khi $R_v(t) \ge 0.90$): Phạt $R = -3.0$ (tăng `redundant_action`).
- **Hành động hợp lệ $(v, m)$:**
  $$R = -0.4 + 5.0 \times \Delta \text{depth\textunderscore verified}_v + 3.0 \times \Delta R_v^{\text{recovered}} + 2.5 \times \Delta \text{code\textunderscore verified}_v - c_{\text{cognitive}}(m) + 15.0 \times \mathbb{I}(\text{GoalMastered})$$
  trong đó:
  - $\Delta \text{depth\textunderscore verified}_v = \max(0, \text{depth}_v^{\text{new}} - \text{depth}_v^{\text{old}})$ là mức tăng chiều sâu đã kiểm chứng.
  - $\Delta R_v^{\text{recovered}} = (1.0 - R_v^{\text{before}}) \times \mathbb{I}(R_v^{\text{before}} < 0.60 \land \text{step\textunderscore passed})$ là mức phục hồi trí nhớ khi ôn tập đúng bài đang suy giảm nhớ.
  - $\Delta \text{code\textunderscore verified}_v = \max(0, \text{code\textunderscore score}_v^{\text{new}} - \text{code\textunderscore score}_v^{\text{old}})$.
  - **Chi phí nhận thức $c_{\text{cognitive}}(m)$ khóa cố định cho 4 chế độ học:**
    - $c_{\text{cognitive}}(\text{Learn\textunderscore New}) = 0.15$
    - $c_{\text{cognitive}}(\text{Deep\textunderscore Probe}) = 0.30$
    - $c_{\text{cognitive}}(\text{Code\textunderscore Practice}) = 0.35$
    - $c_{\text{cognitive}}(\text{Spaced\textunderscore Review}) = 0.10$
- **Điều kiện Kết thúc Episode (`terminated` & `truncated` — Đã khóa):**
  - **`terminated = True` ($\text{GoalMastered}$):** Khi **tất cả các node $v \in \mathcal{V}$ trong đồ thị đích** đồng thời đạt mức hiểu bản chất trở lên (**`depth_level_norm >= 0.75`**) **VÀ** duy trì trí nhớ trên ngưỡng an toàn (**$R_v(t) \ge 0.60$**).
  - **`truncated = True`:** Khi số bước trong episode chạm ngưỡng **`max_steps = 60`** đối với kịch bản đồ thị đơn miền (`Single-Domain Episode`), hoặc **`max_steps = 120`** đối với kịch bản chuỗi đa miền liên tiếp (`Multi-Domain Curriculum Episode`).

### 4. Kịch bản Thực nghiệm Đối sánh 4 Cấp, Quy tắc Đệm $N_{\max}=16$ & Đồ thị Kiểm thử Thứ 4 (`PL3-RL-01`)

#### A. Quy tắc Đệm Vector Phẳng (`Padded Flat Observation` $N_{\max} = 16$) cho `DQN-MLP` và `PPO-MLP`
Để đối sánh công bằng giữa các mạng `MLP` truyền thống (đòi hỏi kích thước đầu vào/đầu ra cố định) và `GNN-PPO` trên các đồ thị có số lượng node $N \in \{9, 10, 12\}$ khác nhau:
- **Kích thước đệm tối đa:** Khóa cố định **$N_{\max} = 16$ node**.
- **Observation phẳng (`shape = (128,)`, `float32`):** Ghép nối $\mathbf{x}_0, \dots, \mathbf{x}_{N-1}$ ($N \times 8$ chiều) và đệm giá trị `0.0` (`zero-padding`) cho $(16 - N) \times 8$ chiều còn lại.
- **Action Space phẳng (`Discrete(64)` = $16 \text{ node} \times 4 \text{ mode}$):** Ở chế độ `Unmasked`, nếu `DQN-MLP` hoặc `PPO-MLP` chọn chỉ số node đệm $v \ge N$, môi trường tính là hành động không hợp lệ ($R = -5.0$, tăng `invalid_action_rate`). Ở chế độ `Masked`, `action_mask` nhị phân khóa toàn bộ các hành động có $v \ge N$ hoặc `is_eligible[v] == 0`.
- **4 Nhóm Thuật toán Đối sánh trên cùng Simulator đa lĩnh vực:**
  1. **`Heuristics (B1 / B2 / B3)`:** Mở rộng cho đa lĩnh vực và 4 chế độ học (ưu tiên `Spaced_Review` khi tồn tại node có $R_v(t) < 0.60$, sau đó chọn bài hợp lệ theo thứ tự tầng `B1`, ngẫu nhiên hợp lệ `B2`, hoặc tham lam hoàn thành dứt điểm node đang học dở lên `0.75` `B3`).
  2. **`DQN-MLP` (Baseline kế thừa MVP):** Huấn luyện trên vector phẳng đã đệm $16 \times 8 = 128$ chiều, Action `Discrete(64)`.
  3. **`PPO-MLP` (Ablation — Chỉ nâng cấp thuật toán RL sang Actor-Critic):** Huấn luyện `PPO` trên cùng vector phẳng đã đệm $128$ chiều (không có lớp truyền thông điệp đồ thị `GNN`).
  4. **`GNN-PPO` (Mô hình Đề xuất Giai đoạn 3):** Kết hợp bộ mã hóa 3 lớp `GNN` bằng PyTorch Tensor thuần + `PPO` Actor-Critic (báo cáo cả chế độ `Unmasked` và `Policy Guardrail Masked`).

#### B. Cấu trúc Khóa Cố định của Đồ thị Kiểm thử Thứ 4: `heldout_data_eng_graph` (10 Node — 4 Tầng DAG)
Để kiểm chứng khả năng **Chuyển giao sang Lĩnh vực Mới Không Cần Huấn Luyện Lại (*Zero-shot Domain Transfer*)**, các mô hình chỉ được huấn luyện trên 3 lĩnh vực (`backend` 12 node, `frontend` 10 node, `devops` 9 node) và sau đó được đưa vào đánh giá trực tiếp (đóng băng trọng số, `eval_seed = 2026`, `500` episodes) trên đồ thị lĩnh vực thứ 4 **`heldout_data_eng_graph` (*Data Engineering & Analytics Pipeline* — 10 node chia 4 tầng, có cấu trúc rẽ nhánh và gộp nhánh khác biệt)**:

| Thứ tự (`node_idx`) | Mã khái niệm (`slug`) | Tên khái niệm kiểm thử (`Data Engineering`) | Tầng (`tier`) | Khái niệm tiên quyết trong `heldout_data_eng_graph` (`prerequisites`) | Giao thoa (`is_shared`) |
| --- | --- | --- | --- | --- | --- |
| `0` | `os-basics` | Hệ điều hành, Filesystem & I/O cơ bản | Tầng 1 | *(Không có — Root node)* | **`true`** *(Chung với `backend`, `devops`)* |
| `1` | `db-relational` | CSDL Quan hệ & Truy vấn SQL Phân tích | Tầng 1 | *(Không có — Root node)* | **`true`** *(Chung với `backend`)* |
| `2` | `db-transactions` | Transaction (ACID), Isolation & Indexing | Tầng 2 | `db-relational` | **`true`** *(Chung với `backend`)* |
| `3` | `db-nosql` | CSDL NoSQL & Lưu trữ Bán cấu trúc (JSON/KV) | Tầng 2 | `db-relational` | **`true`** *(Chung với `backend`)* |
| `4` | `de-batch-etl` | Thiết kế Đường ống Trích xuất & Biến đổi Dữ liệu Lô (Batch ETL) | Tầng 2 | `db-relational`, `os-basics` | `false` *(Đặc thù Data Eng)* |
| `5` | `de-columnar-storage` | Định dạng Lưu trữ Cột (Parquet/ORC) & Partitioning | Tầng 3 | `de-batch-etl`, `db-nosql` | `false` *(Đặc thù Data Eng)* |
| `6` | `de-data-warehouse` | Mô hình hóa Kho Dữ liệu (Star/Snowflake Schema & OLAP) | Tầng 3 | `db-transactions`, `de-batch-etl` | `false` *(Đặc thù Data Eng)* |
| `7` | `de-stream-kafka` | Kiến trúc Xử lý Luồng Sự kiện Thời gian thực (Kafka / Event Log) | Tầng 3 | `os-basics`, `db-nosql` | `false` *(Đặc thù Data Eng)* |
| `8` | `de-spark-distributed` | Tính toán Phân tán Dữ liệu Lớn (Spark DAG, Shuffle & Memory Tuning) | Tầng 4 | `de-columnar-storage`, `de-data-warehouse`, `de-stream-kafka` | `false` *(Đặc thù Data Eng)* |
| `9` | `de-data-quality-lineage` | Kiểm định Chất lượng Dữ liệu, Idempotent Backfill & Data Lineage | Tầng 4 | `de-data-warehouse`, `de-spark-distributed` | `false` *(Đặc thù Data Eng)* |

- **Lý do khoa học của phép thử *Zero-shot Transfer*:** Vì `heldout_data_eng_graph` đổi thứ tự chỉ số `node_idx` và cấu trúc nối cạnh DAG so với 3 đồ thị huấn luyện, mạng `DQN-MLP` và `PPO-MLP` (vốn học trọng số gắn cứng vào vị trí cột $i$ của vector phẳng 128 chiều) sẽ bị lệch ngữ nghĩa vị trí, trong khi `GNN-PPO` đọc trực tiếp quan hệ tiên quyết $\tilde{\mathbf{A}}_{\text{in}}, \tilde{\mathbf{A}}_{\text{out}}$ và đặc trưng từng node $\mathbf{x}_v$ nên giữ nguyên khả năng chọn đúng node hợp lệ và chế độ học tối ưu.

### 5. Quy trình `Safe Micro-batch Online RL` & Kiểm định An toàn (`INV-ONLINE-RL-01`)

1. **Thu thập Tương tác Đã Kiểm duyệt (`Verified Experience Buffer`):** Mỗi khi học viên hoàn thành một bước học/đánh giá thật (nhận qua `CompetencyUpdatedEvent`), bộ chuyển trạng thái $(\mathcal{G}_t, a_t, R_t, \mathcal{G}_{t+1})$ được kiểm tra tính hợp lệ và lưu vào bảng `rl_experience_buffer`.
2. **Tinh chỉnh theo Lô có Ràng buộc KL (`KL-Constrained PPO Fine-tuning`):** Khi đủ lô (mặc định `batch_size = 128` hoặc `Admin` kích hoạt chạy thử nghiệm trên `SCR-18`), tiến trình huấn luyện nạp checkpoint đang phục vụ ($\pi_{\text{prod}}$) và cập nhật trọng số với hệ số phạt lệch phân phối $\beta_{\text{KL}} \cdot D_{\text{KL}}(\pi_{\text{prod}} \,\|\, \pi_{\text{cand}}) \le \delta_{\max}$ ($\delta_{\max} = 0.02$) để chống hiện tượng quên thảm khốc (*catastrophic forgetting*).
3. **Cổng Kiểm định Tự động (`Automated Safety Evaluation Gate`):** Bản ứng viên $\pi_{\text{cand}}$ bắt buộc chạy qua bộ 200 kịch bản kiểm định chuẩn:
   - Điều kiện đạt (`PASS`): `invalid_action_rate_unmasked < 5.0%`, `masked_violation_rate == 0.0%`, và `mean_episodic_reward >= 0.98 * mean_reward(prod)`.
4. **Phê duyệt của `Admin` & `1-Click Rollback` (`SCR-19`):** Chỉ khi đạt `Safety Evaluation Gate`, `Admin` mới có thể bấm **Activate** để chuyển con trỏ serving sang `checkpoint_cand.zip` (kèm mã băm `SHA-256` mới); mọi checkpoint trước đó được lưu trong `model_registry` để hỗ trợ **Rollback 1-Click** tức thời ($< 2000\text{ms}$).
