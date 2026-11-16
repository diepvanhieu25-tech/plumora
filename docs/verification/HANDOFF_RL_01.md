# Handover: `RL-01` (24-dim Student Simulator, Baselines B1/B2/B3, Multi-Seed DQN Training & Evaluation) — `2026-11-16T20:26:00+07:00`

- **Mục tiêu nhiệm vụ (`RL-01`), tài liệu nguồn & tiêu chí áp dụng (`PL-RL-01`):**
  - Hiện thực hóa môi trường `StudentSimulatorEnv` 24 chiều (`12 mastery + 12 is_eligible`, không lộ biến ẩn $\alpha$), 3 thuật toán cơ sở (`B1 — Fixed Curriculum`, `B2 — Valid-Random`, `B3 — Greedy Mastery Heuristic`), huấn luyện mô hình `DQN (MlpPolicy)` trên 3 hạt giống độc lập `train_seeds = [101, 202, 303]` ($\ge 100.000$ timesteps/seed), chọn checkpoint tốt nhất trên `val_seed = 999` (`200 episodes`) và đánh giá độc lập trên tập kiểm thử `eval_seed = 2026` (`500 episodes` cố định dùng chung).
  - Xuất trọn bộ gói bằng chứng RL (`rl/artifacts/checkpoint.zip`, `manifest.json`, `training_log.json`, `evaluation_report.json`) để Backend `FastAPI` nạp và xác thực mã băm `SHA-256`.
  - Tài liệu nguồn đã duyệt (`D-04`, `D-05`, `D-06`, `D-07`, `D-08`, `D-14`): [intent.md](../intent.md) (`v1.0.0`), [spec.md](../spec.md) (`v1.0.0`), [design.md](../design.md) (`v1.0.0`), [research/RL_PLAN.md](../research/RL_PLAN.md) (`v1.0.0`), [plan.md](../plan.md) (`v1.0.0`), [decisions.md](../decisions.md) (`v1.1.0`), [rl-evidence.md](../../.agents/rules/rl-evidence.md).
- **Phạm vi đã hoàn tất:**
  - Nhánh Git: `feat/mvp-slice-1` (giữ nguyên không commit theo quy tắc phân quyền Gate 4).
  - Hoàn thiện `rl/src/plumora_rl/config.py`, `rl/src/plumora_rl/simulator.py`, `rl/src/plumora_rl/baselines.py`, `rl/src/plumora_rl/evaluate.py`, `rl/src/plumora_rl/train.py`.
  - Mở rộng và làm xanh 100% bộ kiểm thử hành vi `rl/tests/red/test_rl01_simulator_and_eval_red.py` (`6 passed`) cùng `rl/tests/test_simulator_and_eval.py` (`2 passed`) và `rl/tests/smoke/test_rl_env_smoke.py` (`1 passed`).
  - Xác nhận endpoint `GET /api/v1/health` của `backend/` nạp và xác thực đúng `checkpoint.zip` (`loaded: true`, `sha256_verified: true`).
- **Bằng chứng nạp Skill & Rule:**
  - Đã đọc và tuân thủ `.agents/skills/sdlc-code/SKILL.md` (cùng references `tdd_cycle_and_circuit_breaker.md`, `handoff_template.md`) và luật bắt buộc `.agents/rules/rl-evidence.md`.

---

## 1. Bảng Lệnh Kiểm Chứng Thực Thi (`Executed Verification Commands`)

| Lệnh Kiểm chứng Đã Chạy | Môi trường / Phiên bản | Exit Code & Kết quả Quan sát Thực tế | Đường dẫn Bằng chứng & Ranh giới |
| --- | --- | --- | --- |
| `cd rl && uv run pytest tests/red --tb=short` *(trước khi viết logic)* | `pytest 9.2.0` trên `plumora-rl` | Exit `1` (**Observed RED**): `6 failed` do `StudentSimulatorEnv.reset()` trả `NotImplementedError` và chưa có `rl/artifacts/*` | [`rl/tests/red/test_rl01_simulator_and_eval_red.py`](../../rl/tests/red/test_rl01_simulator_and_eval_red.py) |
| `cd rl && PYTHONPATH=src uv run python -m plumora_rl.train` | Python `3.12.16`, `gymnasium 1.4.0`, `stable-baselines3 2.9.2`, `torch 2.15.0+cpu` | Exit `0`:<br>- Seed `101`: `65.71s`, `val_reward = 98.15`, `val_invalid_rate = 0.0000`<br>- Seed `202`: `66.33s`, `val_reward = 98.14`, `val_invalid_rate = 0.0000`<br>- Seed `303` (**Selected**): `60.64s`, `val_reward = 98.19`, `val_invalid_rate = 0.0000`<br>- Held-out `eval_seed = 2026` (`500` episodes): `DQN_unmasked reward = 98.27` vs `B2 = 97.55`, `invalid_action_rate = 0.0000` | [`rl/artifacts/checkpoint.zip`](../../rl/artifacts/checkpoint.zip), [`rl/artifacts/manifest.json`](../../rl/artifacts/manifest.json), [`rl/artifacts/training_log.json`](../../rl/artifacts/training_log.json), [`rl/artifacts/evaluation_report.json`](../../rl/artifacts/evaluation_report.json) |
| `cd rl && uv run pytest && uv run ruff check . && uv run mypy src tests` | `pytest 9.2.0`, `ruff`, `mypy` | Exit `0`: `9 passed in 2.21s`, `All checks passed!`, `Success: no issues found in 9 source files` | [`rl/tests/`](../../rl/tests/) |
| `cd backend && uv run python -c "from fastapi.testclient import TestClient; from app.main import app; print(TestClient(app).get('/api/v1/health').json())"` | `FastAPI` trên `plumora-backend` kết nối `PostgreSQL 16` + `Redis 7` | Exit `0`: `{'status': 'ok', 'postgres': 'up', 'redis': 'up', 'rl_checkpoint': {'loaded': True, 'sha256_verified': True, 'sha256': 'e464fa638cee04fda6a386ffb6cdf24d9190d0f1167feb56d4da0063499a6b6b'}}` | [`backend/app/main.py`](../../backend/app/main.py) |
| `./scripts/ci_check.sh && git diff --check` | Toàn bộ Workspace (`backend`, `rl`, `frontend`) | Exit `0`: `=== ALL DAY-0 CI & SMOKE CHECKS PASSED ===` (Lint xanh, Typecheck xanh, Backend `2 passed`, RL `9 passed`, Frontend `1 passed` + `vite build` thành công, `git diff --check` sạch) | [`scripts/ci_check.sh`](../../scripts/ci_check.sh) |

---

## 2. Bảng Kết Quả Thực Nghiệm Độc Lập trên Held-Out Benchmark (`eval_seed = 2026`, `500 Episodes`)

Tất cả 5 chính sách được đánh giá trên cùng **500 hồ sơ học viên ảo cố định** (`ep_seed = 2026 * 10000 + ep_idx`, không lộ biến ẩn $\alpha \sim \text{Uniform}(0.35, 0.75)$). Checkpoint `DQN` được chọn từ `seed = 303` dựa trên tập Validation độc lập (`val_seed = 999`, `200 episodes`), với mã băm `SHA-256 = e464fa638cee04fda6a386ffb6cdf24d9190d0f1167feb56d4da0063499a6b6b`:

| Chính sách (`Policy`) | `completion_rate`<br>`Mean ± Std` / `Median (IQR)` | `steps_to_completion`<br>`Mean ± Std` / `Median (IQR)` | `episodic_reward`<br>`Mean ± Std` / `Median (IQR)` | `invalid_action_rate`<br>`Mean ± Std` / `Median (IQR)` |
| --- | --- | --- | --- | --- |
| **`B1_fixed_curriculum`** | `1.0000 ± 0.0000`<br>`1.0000 (0.0000)` | `17.9300 ± 4.1503`<br>`19.0000 (5.0000)` | `98.2570 ± 17.3809`<br>`107.5000 (16.5000)` | `0.0000 ± 0.0000`<br>`0.0000 (0.0000)` |
| **`B2_valid_random`** | `1.0000 ± 0.0000`<br>`1.0000 (0.0000)` | `19.1980 ± 4.8952`<br>`20.0000 (5.0000)` | `97.5510 ± 17.2364`<br>`106.5000 (16.6250)` | `0.0000 ± 0.0000`<br>`0.0000 (0.0000)` |
| **`B3_greedy_mastery`** | `1.0000 ± 0.0000`<br>`1.0000 (0.0000)` | `17.8580 ± 4.2584`<br>`19.0000 (5.0000)` | `98.2690 ± 17.3554`<br>`107.5000 (16.5000)` | `0.0000 ± 0.0000`<br>`0.0000 (0.0000)` |
| **`DQN_unmasked` (Seed 303)** | `1.0000 ± 0.0000`<br>`1.0000 (0.0000)` | `17.8760 ± 4.1972`<br>`19.0000 (5.0000)` | **`98.2700 ± 17.3580`**<br>`107.5000 (16.5000)` | **`0.0000 ± 0.0000`**<br>`0.0000 (0.0000)` |
| **`DQN_masked_q` (Serving)** | `1.0000 ± 0.0000`<br>`1.0000 (0.0000)` | `17.8760 ± 4.1972`<br>`19.0000 (5.0000)` | **`98.2700 ± 17.3580`**<br>`107.5000 (16.5000)` | **`0.0000 ± 0.0000`**<br>`0.0000 (0.0000)` |

### Phân tích Trung thực Khoa học & Giới hạn của `Student Simulator` (`.agents/rules/rl-evidence.md` & `D-08`)

1. **Khả năng tự học cấu trúc điều kiện tiên quyết DAG:**
   - Ngay cả khi không áp dụng mặt nạ lọc Q-value (`DQN_unmasked`), mạng `MlpPolicy` (`[128, 128]`) sau `100.000` timesteps đã học chính xác mối liên hệ giữa vector `obs[0..11]` (`mastery`) và `obs[12..23]` (`is_eligible`), đạt **`invalid_action_rate = 0.00%`** trên cả 3 hạt giống huấn luyện (`101`, `202`, `303`) và trên toàn bộ 500 episodes kiểm thử (`eval_seed = 2026`), vượt xa ngưỡng yêu cầu `< 5%` của `PL-RL-01`.
2. **So sánh với `B2 (Valid-Random)` và `B1` / `B3`:**
   - `DQN_unmasked` vượt rõ rệt `B2_valid_random` cả về tổng phần thưởng (`98.2700` vs `97.5510`) lẫn tốc độ hoàn thành khóa học (`17.876` bước vs `19.198` bước, tiết kiệm trung bình `~1.32` lượt học/quiz mỗi học viên nhờ tránh phân tán nhận thức qua nhiều bài dở dang cùng lúc).
   - So với hai thuật toán cơ sở có tri thức miền (`B1_fixed_curriculum` và `B3_greedy_mastery`), `DQN` đạt hiệu năng tương đương/nhỉnh nhẹ về `episodic_reward` (`98.2700` vs `98.2570` của `B1` và `98.2690` của `B3`) và cạnh tranh sát nút với `B3` về số bước (`17.876` vs `17.858`). Điều này hoàn toàn hợp lý về mặt toán học vì trên đồ thị DAG 12 khái niệm có quy tắc cập nhật `mastery = max(old, score)` đơn điệu, chiến lược học dứt điểm từng khái niệm đang mở khóa (`B3`) gần với nghiệm tối ưu toàn cục.
3. **Giới hạn của `Student Simulator`:**
   - Kết quả trên chứng minh mạng `DQN` hội tụ ổn định và tuân thủ cấu trúc DAG trong môi trường giả lập `Gymnasium` có giả định rõ ràng; **không đồng nhất kết quả simulator với bằng chứng cải thiện kết quả học tập trên học viên thật** (vốn có hiện tượng quên kiến thức theo thời gian và độ nhiễu câu hỏi thực tế).

---

## 3. Trạng thái Tiêu chí Nghiệm thu (`Criteria Status` tại mốc `RL-01`)

- **`PL-RL-01` — `GREEN` (Đã kiểm chứng đầy đủ):**
  - `StudentSimulatorEnv` tuân thủ chặt chẽ Observation 24 chiều (`float32`), Action `Discrete(12)`, hàm thưởng `-5.0` / `-3.0` / tiến độ / đích `+15.0`, cắt ngưỡng `max_steps = 40`, và không lộ biến ẩn `_alpha`.
  - Đã huấn luyện trên `train_seeds = (101, 202, 303)` (`100.000` timesteps/seed), chọn model trên `val_seed = 999` (`200` episodes) và đánh giá trên `eval_seed = 2026` (`500` episodes).
  - Xuất đầy đủ `checkpoint.zip`, `manifest.json`, `training_log.json`, `evaluation_report.json` với `SHA-256` khớp 100%.

---

## 4. Manifest SHA-256 của Các Tệp Tạo Mới / Cập Nhật trong `RL-01`

| Đường dẫn tương đối | Mã băm `SHA-256` |
| --- | --- |
| `.github/workflows/ci.yml` | `7d41656f94c3ec070d6d2960b5d06ba51e3efb9f902f1ba2a62e66ac7aa88979` |
| `backend/app/config.py` | `ba98d4e6052e6a682465bc4354e5fe7e5b7de327cdc16732e802cda5f83b914b` |
| `backend/app/main.py` | `0df73bb0552010d15eb7137286f0656fd3bec4201dc416174ffe098e540a521b` |
| `docs/README.md` | `a6004ede14ca8d489b25e5a48b364e3cc1a2d025233d561c30dc6e864eab4fc7` |
| `docs/plan.md` | `1bdabf554fada6d8325c9fe5e0b3651c01d31a05d2c01887c84efd815a95f7b2` |
| `rl/artifacts/checkpoint.zip` | `e464fa638cee04fda6a386ffb6cdf24d9190d0f1167feb56d4da0063499a6b6b` |
| `rl/artifacts/evaluation_report.json` | `c9b384187f858c6708a5ea1ad99ef7bc6a31b1c1f77f385ebdb02dbf3cd67c45` |
| `rl/artifacts/manifest.json` | `dfa34eb4dc5ae8a6c2617d9406556dc5b6c029631bcc11ae90d7e47717b6177d` |
| `rl/artifacts/training_log.json` | `a91925600404fbddbebdbfd9a4cd92faa9f5a5476146d7ffeffe7e81c998038b` |
| `rl/src/plumora_rl/__init__.py` | `f4e8f02e7f8739879f1132460077618b855cb1acb2077eb83649df9dd80679c5` |
| `rl/src/plumora_rl/baselines.py` | `4d4a0d09bfe8c0f0e01d58bc2e33a20a92f22e5fe0a4f657f3a0060eab2774c5` |
| `rl/src/plumora_rl/config.py` | `435f7647af5c954ef04aab23eabd31b9c529fab54abe917a3d04ce3d9329f3a9` |
| `rl/src/plumora_rl/evaluate.py` | `6d2345aa2bc5b4efd82dfa5468cafa3c6664d43412712288189b2753692b8eff` |
| `rl/src/plumora_rl/simulator.py` | `173777be2e43eb4cc3ae3651a6509afe7422ba84d4bc97d4ed3a3ad3a123b01c` |
| `rl/src/plumora_rl/train.py` | `dc6cfdf9a2d55899539265b2a2882a8711a90285c7280193e5554c184e94bddd` |
| `rl/tests/red/test_rl01_simulator_and_eval_red.py` | `8c577e328b8834c5b9c5663ec46eebdfa4613fc8262748603f959a3766fdfacb` |
| `rl/tests/smoke/test_rl_env_smoke.py` | `1dc8994018ca46121ebf39c4c34b2b1988219f5c3c9d46a486c09279cfa25506` |
| `rl/tests/test_simulator_and_eval.py` | `9fed65c56dc3d14169555339f1177e38cd9ad1839b7dd3c0e9b6ee25b9a68892` |
| `scripts/ci_check.sh` | `4f11cb3f5d8ba4c3e93ac912f6b6ded8268ab606af0c1861db7a6cc8a22f95e0` |

---

## 5. Bước Tiếp theo (`Next Step`)

- Nhiệm vụ **`SLICE-01`** (Lát cắt dọc đầu tiên: Backend FastAPI + PostgreSQL SSoT + Redis State Cache + RL Serving + Frontend React SPA 5 màn hình Stitch) đã đủ cả 2 phụ thuộc (`ENV-01` và `RL-01`) và được chuyển sang trạng thái **`ready`** trong [`docs/plan.md`](../plan.md).
