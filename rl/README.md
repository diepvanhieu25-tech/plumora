# Plumora RL Research & Shared Zero-Torch Kernel (`v4.0`)

Thư mục `rl/` chứa toàn bộ môi trường mô phỏng học viên đa lĩnh vực (`Gymnasium`), mô hình **`GNN-PPO`** 3 lớp bằng PyTorch Tensor thuần, bộ khung đối sánh thực nghiệm 4 cấp kèm *Zero-shot Domain Transfer*, cũng như **Lõi Toán/RL không phụ thuộc PyTorch (`plumora_rl.domain` & `plumora_rl.inference`)** dùng chung trực tiếp với cụm Microservices Backend.

---

## 1. Cấu trúc Gói `plumora_rl`

| Module | Phụ thuộc PyTorch / Gymnasium | Vai trò chính |
| :--- | :---: | :--- |
| `plumora_rl.domain` | **Không (`Zero-Torch`, thuần NumPy)** | Nguồn chân lý duy nhất (SSoT) cho `GraphObservationBuilder` ($\tilde{\mathbf{A}} = \mathbf{D}^{-1}\mathbf{A}$), `PolicyGuardrailStrategy` (`INV-SEQ-01`, `INV-SEQ-02`, `INV-SEQ-03`, khóa `DEEP_PROBE` ở `1.00 Mastery`, khóa `CODE_PRACTICE` khi `code_score >= 1.0` ở `depth < 0.75`), `EbbinghausMemoryModel` ($R(t) = e^{-\Delta t/S}$) và `MultiObjectiveRewardCalculator`. |
| `plumora_rl.inference` | **Không (`Zero-Torch`, thuần NumPy)** | `NumpyGnnPredictor` suy luận mạng GNN 3 lớp khớp tuyệt đối PyTorch ($\text{atol} \le 10^{-5}$) và cập nhật `micro_batch_ppo_update` có ràng buộc `KL-divergence` cho `recommendation-ai-service`. |
| `plumora_rl.multidomain_sim` | Có (`Gymnasium`) | Môi trường `MultiDomainStudentSimulatorEnv` (`v4.0.0`, `dt=0.25d`, 30% prior-state reset) trên 4 đồ thị DAG (`backend` 12, `frontend` 10, `devops` 9 + đồ thị giữ kín `heldout_data_eng_graph` 10 node), đồng bộ bất biến `INV-SEQ-01..03`. |
| `plumora_rl.gnn_ppo` | Có (`PyTorch`) | Kiến trúc `GnnActorCritic` 3 lớp truyền thông điệp có hướng + huấn luyện `PPO-Clip` theo lô kèm hàm phạt NLL xác suất hợp lệ chống bão hòa gradient. |
| `plumora_rl.evaluate_phase3` | Có (`PyTorch`, `SB3`) | CLI huấn luyện công bằng cùng ngân sách `timesteps_per_seed = 60,000` qua `train_seeds = [101, 202, 303]`, chọn hạt giống trên `val_seed = 999` (`200` episodes) và đánh giá độc lập trên `eval_seed = 2026` (`500` episodes). |

---

## 2. Gói Bằng chứng Thực nghiệm Hiện hành (`rl/artifacts/`)

- **`gnn_ppo_v2_base.zip`:** Checkpoint cơ sở (`selected_seed = 101`, `60,000` steps/seed, `SHA-256 = 824bebf1c988b914e31b293787403de8b65f7f9d3d72c3e6caf68a1f3998d2f6`).
- **`manifest_phase3.json` & `evaluation_phase3_report.json`:** Gói đối chiếu đầy đủ (`mean/std/median/iqr` cho `reward` và `steps_to_completion`, `invalid_action_rate` tính cả `prerequisite_violation` và `redundant_action`, `masked_violation_rate == 0.0%`).
- *(Lưu ý khoa học theo `.agents/rules/rl-evidence.md`: Kết quả thu được trên Simulator mô phỏng động học học viên và đường cong Ebbinghaus, không đồng nhất với bằng chứng lâm sàng trên người học thật.)*

---

## 3. Lệnh Kiểm thử & Tái lập Thực nghiệm

```bash
cd rl

uv sync --frozen
uv run ruff check .
uv run mypy src tests
uv run pytest

# Tái lập toàn bộ huấn luyện 3 seeds & đánh giá 500 episodes (eval_seed=2026)
PYTHONPATH=src uv run python -m plumora_rl.evaluate_phase3 --eval-seed 2026 --episodes 500
sha256sum artifacts/gnn_ppo_v2_base.zip
```
