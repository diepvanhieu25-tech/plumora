# Hồ sơ Bàn giao Gate 2 — ĐỢT 1 (`P3-SLICE-1`: Việc 1.1 $\rightarrow$ Việc 1.5)

- **Ngày:** 2026-11-19
- **Nhánh làm việc:** `feat/p3-slice-1-depth-assessment`
- **Cơ sở phê duyệt (Gate 1 Baseline):** `v2.0.0` (`D-16`..`D-26` trong `docs/decisions.md`)
- **Tiêu chí nghiệm thu đạt chuẩn:** `PL3-KG-01`, `PL3-ASSESS-01`, `PL3-GRADER-01`, `PL3-TUTOR-01`, `PL3-MEMORY-01`

---

## 1. Tóm tắt Kết quả Triển khai (Việc 1.1 $\rightarrow$ Việc 1.5)

1. **Mở rộng Schema & Seed Đa lĩnh vực (`PL3-KG-01`, Việc 1.1):**
   - Mở rộng chiến lược *Expand* trong `backend/app/db/models.py` & `backend/app/db/migrations.py` (`0004_add_user_role_column`), giữ tương thích ngược 100% với MVP `/api/v1/*`.
   - Bổ sung 3 đồ thị lĩnh vực: `backend` (12 node), `frontend` (10 node, 4 node giao thoa), `devops` (9 node, 5 node giao thoa) với 7 node giao thoa liên thông tức thời qua `user_node_competency` và đồng bộ 2 chiều với `user_concept_mastery`.
   - Bộ kiểm tra chu trình đồ thị `dag_validator.py` (Kahn's Topological Sort + DFS trích xuất `cycle_path`, mã lỗi `422 DAG_CYCLE_DETECTED`).
2. **Đánh giá 2 Chế độ: Adaptive Placement & 5-Depth Probing State Machine (`PL3-ASSESS-01`, Việc 1.2):**
   - `placement_engine.py`: Chẩn đoán đầu vào tối đa 6 câu, nhảy tầng DAG khi đạt, chặn trần khởi tạo tại `0.75` (`confidence = 0.60`, $S_0 = 3.0$).
   - `depth_state_machine.py`: Máy trạng thái đào sâu 5 tầng (*What $\rightarrow$ Internals*), dừng chạm *Knowledge Ceiling* khi sai 2 lượt liên tiếp cùng tầng, ánh xạ tất định 3 chiều và hỗ trợ nhánh `insufficient_evidence` không ghi đè năng lực cũ (`INV-DEPTH-01`).
3. **Code Sandbox Cô lập & AI Tutor Rubric Adapter (`PL3-GRADER-01`, `PL3-TUTOR-01`, Việc 1.3):**
   - `sandbox_worker.py`: Thực thi Python/SQL/JS cô lập qua subprocess không mạng, kiểm tra AST chặn module/builtin nguy hiểm (`422 SANDBOX_SECURITY_VIOLATION`), áp `RLIMIT_AS`/`RLIMIT_CPU` và cắt vòng lặp vô hạn trong $\le 3000\text{ms}$ (`408 SANDBOX_TIMEOUT`, `INV-SANDBOX-01`).
   - `rubric_grader.py`: `CircuitBreakerRubricService` bọc `LlmRubricGraderAdapter` và tự động chuyển sang `DeterministicRubricGrader` (`grader_source = "deterministic_fallback"`) khi offline/timeout mà không bao giờ lỗi `500`.
4. **Đường cong Quên lãng *Ebbinghaus* (`PL3-MEMORY-01`, Việc 1.4):**
   - `ebbinghaus.py`: Khởi tạo $S_0 = 3.0$ ngày, tính suy giảm $R(t) = e^{-\Delta t/S}$ (hỗ trợ `simulated_time_offset_days` trong môi trường `dev`/`test`), bật `needs_review` khi $R(t) < 0.60$, và cập nhật $S_{\text{new}}$ khi ôn tập đạt/chưa đạt.
5. **Giao diện Học viên Mở rộng `SCR-09`..`SCR-14` (`INV-UI-01`, Việc 1.5):**
   - Hoàn thiện 6 màn hình mới chuẩn Botanical Sprout & Sunlit Canopy, 100% SVG `lucide-react`, 0 emoji: `MultiDomainHubPage.tsx` (`SCR-09`), `AdaptivePlacementPage.tsx` (`SCR-10`), `MultiDomainRoadmapPage.tsx` (`SCR-11`), `DepthProbePage.tsx` (`SCR-12`), `CodeSandboxPage.tsx` (`SCR-13`), `AiTutorRubricDrawer.tsx` (`SCR-14`) và `MultiDomainKgNodeCard.tsx`.

---

## 2. Bằng chứng Kiểm chứng Toàn diện (`./scripts/ci_check.sh` — Exit 0)

| Lớp Kiểm chứng | Phạm vi & Lệnh thực thi | Kết quả |
| --- | --- | --- |
| **Lint & Typecheck** | `ruff check .`, `mypy app tests` (Backend 55 files, RL 9 files), `eslint .`, `tsc --noEmit` | **PASS (0 lỗi)** |
| **Backend Pytest** | `cd backend && uv run pytest` (29 MVP tests + 13 Phase 3 Slice 1 tests) | **42/42 PASSED** |
| **RL Pytest** | `cd rl && uv run pytest` | **9/9 PASSED** |
| **Frontend Vitest Unit** | `cd frontend && npm run test:unit` (16 MVP tests + `p3_slice1_ui.test.tsx`) | **17/17 PASSED** |
| **Production Build & Live Integration** | `npm run build` + `npm run test:integration` | **PASSED** |
| **Real Chromium E2E Audits** | `audit_mvp_hardening.cjs` (+ Negative Control), `audit_product_realism.cjs`, `audit_p3_slice1.cjs` (`SCR-09`..`SCR-14`, mobile `390px` `0px` overflow, `0` emojis) | **100% PASSED** |

---

## 3. Bước tiếp theo
- Đợt 1 (`P3-SLICE-1`) đã sẵn sàng cho Gate 3 Review hoặc chuyển tiếp sang Đợt 2 (`P3-SLICE-2`: Nâng cấp `Simulator` đa ngành & Huấn luyện/Đối sánh 4 cấp `GNN-PPO`).
