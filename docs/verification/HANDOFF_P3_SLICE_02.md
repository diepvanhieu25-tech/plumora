# Hồ sơ Bàn giao Gate 2 — ĐỢT 2 (`P3-SLICE-2`: Việc 2.1 $\rightarrow$ Việc 2.3)

- **Ngày:** 2026-11-19
- **Nhánh làm việc:** `feat/p3-slice-2-gnn-ppo`
- **Cơ sở phê duyệt (Gate 1 Baseline):** `v2.0.0` (`D-20`, `D-21`, `D-25`, `D-26`)
- **Tiêu chí nghiệm thu đạt chuẩn:** `PL3-RL-01`, `PL3-GUARD-01`

---

## 1. Tóm tắt Kết quả Triển khai (Việc 2.1 $\rightarrow$ Việc 2.3)

1. **Việc 2.1 — Môi trường Giả lập Đa lĩnh vực (`MultiDomainStudentSimulatorEnv`):**
   - Triển khai tại `rl/src/plumora_rl/multidomain_sim.py` hỗ trợ 4 đồ thị: `backend` (12 node), `frontend` (10 node), `devops` (9 node) và đồ thị kiểm thử độc lập `heldout_data_eng_graph` (10 node).
   - Mỗi node biểu diễn bằng vector 8 chiều chuẩn hóa $[0, 1]$ (`depth_level_norm`, `confidence`, `retention_ebbinghaus`, `is_eligible`, `needs_review`, `tier_difficulty`, `code_practice_score`, `is_goal_path`).
   - Bảo toàn bất biến không lộ biến ẩn (`alpha`, `lambda_forget`, `beta_code` chỉ tồn tại nội bộ Simulator).
   - Hỗ trợ không gian hành động phân tách $(v, m)$ với 4 chế độ (`Learn_New`, `Deep_Probe`, `Code_Practice`, `Spaced_Review`), bước thời gian $\Delta t = 1.0$ ngày/step và wrapper đệm phẳng $N_{\max}=16$ (`128` chiều, `Discrete(64)`) cho `DQN-MLP` và `PPO-MLP`.
2. **Việc 2.2 — Mạng `GNN-PPO` 3 Lớp PyTorch Tensor & Thực nghiệm Đối sánh 4 Cấp:**
   - Triển khai `GnnActorCritic` tại `rl/src/plumora_rl/gnn_ppo.py` dùng phép nhân ma trận kề có hướng chuẩn hóa bậc ($\tilde{\mathbf{A}}_{\text{in}}, \tilde{\mathbf{A}}_{\text{out}}$) với 3 lớp `DirectedGnnLayer` + `MeanPool` + `Node-wise Actor Head`.
   - Huấn luyện qua `train_seeds = [101, 202, 303]`, chọn mô hình tốt nhất trên `val_seed = 999` (`selected_seed = 101`), xuất `rl/artifacts/gnn_ppo_v2_base.zip` (`SHA-256 = 9977d5f606427d0eb25970b1ce8cf23fa0232e2d7ff0fe392e80d2413d534201`) cùng `rl/artifacts/manifest_phase3.json` và `rl/artifacts/evaluation_phase3_report.json`.
3. **Việc 2.3 — Tích hợp Serving `GNN-PPO` + `Policy Guardrail` trên `SCR-11` (`PL3-GUARD-01`):**
   - Triển khai `backend/app/modules/recommendation_v2/` (`gnn_loader.py` kiểm định `SHA-256` & suy luận thuần NumPy $< 5\text{ms}$, `service.py` áp dụng `Policy Guardrail` ép 0% vi phạm DAG và ưu tiên node có $R(t) < 0.60$).
   - Nối vào `POST /api/v2/recommendations` và hiển thị trung thực `policy_source` (`Mô hình GNN-PPO` / `GNN-PPO + Policy Guardrail` / `Quy tắc Đồ thị (Fallback)`) + mã băm `SHA-256` trên `MultiDomainRoadmapPage.tsx` (`SCR-11`).

---

## 2. Kết quả Thực nghiệm Đối sánh 4 Cấp (`eval_seed = 2026`, `500 episodes`)

| Phương pháp | Kịch bản A: 3 Ngành đã biết (`Mean ± Std` / `Completion`) | Kịch bản B: *Zero-shot Transfer* `heldout_data_eng_graph` (`Mean ± Std` / `Completion`) | Tỷ lệ vi phạm (`Unmasked` / `Masked`) |
| --- | --- | --- | --- |
| **`Heuristic B1`** *(Tier-order)* | `44.7152 ± 6.2025` (`2.4%`) | `45.7332 ± 5.9808` (`0.4%`) | `0.0%` / `0.0%` |
| **`Heuristic B2`** *(Random-eligible)* | `0.5780 ± 22.8860` (`0.0%`) | `2.4377 ± 21.6138` (`0.0%`) | `0.0%` / `0.0%` |
| **`Heuristic B3`** *(Greedy-mastery)* | `58.1104 ± 7.8744` (`1.2%`) | `58.1649 ± 7.6597` (`0.2%`) | `0.0%` / `0.0%` |
| **`DQN-MLP`** *(Padded 128-dim)* | `-151.5628 ± 5.5413` (`0.0%`) | `-148.2334 ± 4.9309` (`0.0%`) | — |
| **`PPO-MLP`** *(Padded 128-dim)* | `-157.6880 ± 6.8729` (`0.0%`) | `-148.9750 ± 4.2991` (`0.0%`) | — |
| **`GNN-PPO (Unmasked)`** | **`66.6476 ± 8.7348`** (`37.2%`) | **`67.3580 ± 9.7991`** (`39.2%`) | **`0.0%`** / `0.0%` |
| **`GNN-PPO (Guardrail Masked)`** | **`61.7239 ± 9.0600`** (`34.6%`) | **`62.0429 ± 9.9426`** (`35.2%`) | `0.0%` / **`0.0%`** |

*(Lưu ý theo `.agents/rules/rl-evidence.md`: Đây là kết quả thực nghiệm trên Simulator mô phỏng giả định, không phải bằng chứng hiệu quả học tập trên người thật.)*

---

## 3. Bằng chứng Kiểm chứng Toàn diện (`./scripts/ci_check.sh` — Exit 0)
- **Lint & Typecheck:** Ruff, ESLint, Mypy (`59` file Backend, `13` file RL), TSC — **0 lỗi**.
- **Tests:** Backend `44/44` pytest passed (gồm `test_gnn_ppo_guardrail_serving.py` kiểm chứng `p95 < 250ms` & fallback), RL `12/12` pytest passed (gồm `test_gnn_ppo_multidomain.py`), Frontend `17/17` Vitest passed.
- **Live Integration & Real Chromium E2E:** `audit_mvp_hardening.cjs` (+ Negative Control), `audit_product_realism.cjs`, `audit_p3_slice1.cjs` — **100% PASSED**.

---

## 4. Bước tiếp theo
- Sẵn sàng chuyển sang **ĐỢT 3 (`P3-SLICE-3`)**: Tách 4 Microservices (`auth_svc`, `content_svc`, `assess_svc`, `rec_ai_svc`), `Transactional Outbox` + `Redis Streams`, `Safe Micro-batch Online RL`, Cổng `Expert`/`Admin` (`SCR-15`..`SCR-20`) và `k8s/` manifests.
