# Báo Cáo Bàn Giao: Khắc Phục Toàn Diện H1–H7 Chất Lượng MVP (Hardening Follow-up)

- **Ngày thực hiện:** 2026-11-17
- **Nhánh làm việc:** `fix/mvp-quality-hardening`
- **Mục tiêu:** Khắc phục trọn vẹn 7 phát hiện H1–H7 từ Báo cáo Đánh giá Độc lập (`PLUMORA_HARDENING_REVIEW_2026-11-17.md`), bảo toàn cải tiến hiện có, tuân thủ nghiêm ngặt chuẩn mực kỹ thuật và quy tắc cổng G1/G2.
- **Trạng thái Gate 3:** **IN REVIEW** (Không tự phong Approved; chờ review độc lập 4 trục trên snapshot hiện tại).

---

## 1. Bảng Đối Chiếu Ma Trận H1–H7: Hợp Đồng, RED Test, Cách Sửa & Bằng Chứng GREEN

| ID | Vấn đề / Phát hiện review | AC / Hợp đồng liên quan | RED Test kiểm chứng lỗi | Cách sửa cụ thể | Bằng chứng GREEN |
|---|---|---|---|---|---|
| **H1** | CI & E2E: Workflow thiếu trigger `fix/**`, không start backend trước khi chạy fullstack test; thiếu browser E2E thật trong CI runner; phụ thuộc server máy cục bộ. | `D-09`, `PL-E2E-01`, `.github/workflows/ci.yml` | `.github/workflows/ci.yml` thiếu trigger `fix/**`; `live_fullstack_journey.spec.ts` fail khi thiếu port 8000; thiếu bước browser E2E thật trong runner CI. | Cập nhật `.github/workflows/ci.yml` bổ sung `fix/**`, phân tầng 4 cấp kiểm thử độc lập: (1) Unit & mock behavioral (`npm run test:unit`), (2) Khởi động uvicorn backend nền + probe `/api/v1/health` với timeout 30s fail-fast rõ ràng, (3) Live fullstack test (`npm run test:integration`), (4) Khởi động frontend preview trên port 3000 + chạy Chromium E2E Audit và Negative Control. Bổ sung lifecycle tự động khởi động và thu dọn backend & frontend preview vào `scripts/ci_check.sh`. | `./scripts/ci_check.sh` chạy 6/6 bước xanh (exit 0) không phụ thuộc tiến trình có sẵn. |
| **H2** | Migration & Lịch sử: `seed_loader.py` thêm cột với `DEFAULT 1`/`[]` nuốt lỗi; replaying attempt cũ trả `state_version=1`/`[]` giả mạo; thiếu test upgrade DB từ schema cũ. | `D-06`, `D-10`, `docs/design.md:300` | `test_h2_legacy_attempt_replay_returns_null_and_no_fake_version` fail khi replay legacy attempt trả về 1 thay vì null; `test_h2_migration_error_raises_and_does_not_swallow`; `test_h2_schema_migration_upgrade_from_pre_hardening_schema`. | Xây dựng module migration có phiên bản (`backend/app/db/migrations.py`) với bảng `schema_migrations`, hỗ trợ đa phương ngữ (Postgres & SQLite), gỡ bỏ `DEFAULT 1` và `DEFAULT '[]'`. Sửa model `QuizAttemptModel` cho phép `state_version` và `newly_unlocked_json` là `nullable`. Replay attempt cũ trả đúng `null` trung thực không bịa lịch sử. Bổ sung nhãn trung thực "Phát lại bài nộp cũ (Bảo lưu nguyên trạng)" trong `QuizResultCard.tsx`. | 10/10 tests trong `test_quality_hardening_red.py` passed (gồm test migration upgrade, legacy attempt null, attempt mới, A→B→replay A và cross-concept 409). |
| **H3** | Cấu hình & Secret: `config.py` đọc `os.getenv` trong khi `Settings` đọc dotenv; sai thứ tự ưu tiên trong pydantic-settings khiến `.env` ghi đè `.env.local`; khi `APP_ENV=production` trong `.env` nhưng process env trống, hệ thống âm thầm sinh ephemeral secret. | `F3`, `docs/spec.md`, `backend/app/config.py` | `test_h3_settings_receives_production_from_dotenv_without_os_getenv_app_env` fail khi resolver sinh ephemeral key thay vì chặn khởi động; `test_h3_env_local_overrides_env_base_and_process_env_overrides_all` fail khi `.env` ghi đè `.env.local`. | Sắp xếp đúng thứ tự pydantic-settings: `env_file=(".env", "../.env", ".env.local", "../.env.local")` đảm bảo thứ tự ưu tiên: `process env > .env.local > .env`. Đưa `jwt_secret_key` thành thuộc tính của `Settings`. Hợp nhất `resolve_jwt_secret()` dùng chung đối tượng Settings đã resolve làm single source of truth. Production bắt buộc secret $\ge 32$ ký tự, cấm tuyệt đối sinh ephemeral secret. | `test_h3_settings_receives_production_from_dotenv_without_os_getenv_app_env`, `test_h3_env_local_overrides_env_base_and_process_env_overrides_all` và `test_f3_production_refuses_to_start_without_valid_secret` passed. |
| **H4** | Nhãn khuyến nghị trung thực: Banner luôn ghi `DQN POLICY` và "tối ưu nhất" kể cả khi `fallback_rule`; `LessonReader.tsx` hardcode nhãn DQN; rò rỉ chuỗi kỹ thuật `(policy_source: dqn)`. | `D-07`, `F1`, `AiRecommendationBanner.tsx` | UI probe ghi nhận banner mang headline `DQN POLICY` khi payload nhận `fallback_rule`/`degraded: true`. Frontend test `H4` trong `quality_hardening.test.tsx`. | Tái cấu trúc `AiRecommendationBanner.tsx`: ánh xạ chính xác theo `policy_source` (`fallback_rule` hiển thị `KHUYẾN NGHỊ THEO QUY TẮC ĐỒ THỊ (TOPO FALLBACK)`, `dqn_masked_q` hiển thị `KHUYẾN NGHỊ TỪ MÔ HÌNH DQN (MASKED Q)`). Loại bỏ tuyên bố "tối ưu nhất", đổi thành "đề xuất khái niệm phù hợp". Bỏ từ "tối ưu" trong loading state. Thay "Mô hình DQN xác nhận" bằng "Hệ thống xác nhận" trong completed banner. Gỡ bỏ huy hiệu hardcode `AI ĐỀ XUẤT TIẾP THEO (DQN POLICY)` trong `LessonReader.tsx`. Bổ sung hiển thị `degraded` và ánh xạ tên tiếng Việt trong `ProvenanceDrawer.tsx`. | 11/11 tests trong `quality_hardening.test.tsx` passed. Chromium probe audit xác nhận banner fallback chuẩn xác, không có từ khóa DQN hay "tối ưu nhất". |
| **H5** | Độ tin cậy audit: Script audit tính `allChecksPassed` nhưng false không làm exit 1; negative-control probe bị fake bằng cờ boolean; hardcode đường dẫn tuyệt đối `/home/diepvanhieu`. | `F6`, `scripts/audit_mvp_hardening.cjs` | Chạy audit khi điều kiện vi phạm vẫn exit 0 nếu không có unhandled crash; negative control không thực sự chạy qua logic assertion. | Sửa `audit_mvp_hardening.cjs`: tự động resolve Chromium và Playwright qua cache/hệ thống/môi trường động (`os.homedir()`); exit 1 nghiêm ngặt khi `!allChecksPassed || errors.length > 0`. Bổ sung kiểm tra thao tác xen kẽ A→B→replay A, nhãn fallback, focus dialog, focus restore và clipping mobile. Xóa bỏ cờ boolean fake; negative control inject lỗi nhãn fallback thật khiến assertion `fallbackLabelValid` tự nhiên thất bại. Xuất báo cáo artifact vào `docs/verification/artifacts/`. | Audit chạy thực tế đạt `allChecksPassed: true` (exit 0). Negative-control probe inject lỗi thật khiến script trả exit code 1 do vi phạm assertion. |
| **H6** | Mobile & Accessibility: Chip checkpoint tràn `right ≈ 502px` trên mobile 390px; modal và drawer không chuyển focus vào dialog khi mở, thiếu focus trap/restore; hook `useFocusTrap` bị re-render jitter; badge WCAG AA chưa kiểm chứng. | `D-13`, `ui-design-system.md` | UI probe Chromium đo 2 phần tử checkpoint có `right ≈ 502px` tại viewport 390px; `drawerInitialFocusInside: false`, `modalInitialFocusInside: false`. | Cắt ngắn chip checkpoint hiển thị 12 ký tự hash kèm tooltip và drawer mở rộng (`max-w-[180px] truncate`), cô lập radial accent decor trong container riêng (bỏ `overflow-hidden` khỏi section chính). Hoàn thiện hook chuẩn WAI-ARIA `useFocusTrap.ts` với `onEscapeRef` tránh jitter khi parent re-render, tự động chuyển focus vào dialog khi mở, khóa Tab/Shift+Tab bên trong và phục hồi focus về trigger button khi đóng. Gỡ bỏ badge `WCAG 2.1 AA` chưa qua kiểm định khỏi `README.md`. | Chromium probe tại 390px: `clippedCount = 0`, `scrollWidth = 390px` (0px overflow). `drawerInitialFocusInside: true`, `drawerFocusRestored: true`, `modalInitialFocusInside: true`, `modalTabTrapped: true`, `modalFocusRestored: true`. Phím Escape đóng và restore focus chuẩn xác. |
| **H7** | Báo cáo RL: Khẳng định chưa chứng minh (Q-value âm mọi trạng thái, greedy gần tối ưu toàn cục, DQN hội tụ toán học; tự phong Gate 3 APPROVED). | `rl-evidence.md`, `RL_EXPERIMENTAL_REPORT.md` | Reviewer chỉ ra các dòng 154, 162, 169 suy rộng quá mức mẫu 500 episodes; dòng 5 ghi Gate 3 APPROVED. | Sửa `docs/defense/RL_EXPERIMENTAL_REPORT.md`: (1) Dòng 5: Cập nhật thành `Gate 3: In Review`, (2) Mục 7.1: Giới hạn nhận định Q-value âm trên phân phối và mẫu đã đánh giá, (3) Mục 7.3: Nêu rõ DQN đạt số bước tương đương nghiệm chuyên gia tham lam B3 trên không gian 12 khái niệm mô phỏng thay vì tuyên bố "hội tụ toán học", (4) Mục 8.1: Nhấn mạnh kết quả mô phỏng không đại diện cho hiệu quả lâm sàng trên người thật. | `uv run pytest` và `mypy` trong `rl` đạt 100% (9 passed). Báo cáo khoa học bám sát số liệu thực nghiệm. |

---

## 2. Nhật Ký Thực Thi Kiểm Thử Độc Lập

### 2.1. Kiểm Tra Cục Bộ (Local Verified Checks)

| Công cụ / Lệnh kiểm tra | Phạm vi / Mục tiêu | Exit Code | Kết quả chi tiết |
|---|---|:---:|---|
| `cd backend && uv run ruff check .` | Lint backend | **0** | All checks passed (0 errors) |
| `cd backend && uv run mypy app tests` | Typecheck backend | **0** | Success: no issues found in 34 source files |
| `cd backend && uv run pytest` | Toàn bộ test suite backend | **0** | **24 passed** (gồm test migration upgrade & H3 precedence), 1 warning deprecation |
| `cd rl && uv run ruff check .` | Lint RL | **0** | All checks passed (0 errors) |
| `cd rl && uv run mypy src tests` | Typecheck RL | **0** | Success: no issues found in 9 source files |
| `cd rl && uv run pytest` | Test suite môi trường RL và simulator | **0** | **9 passed** (0 failures) |
| `cd frontend && npm run lint` | ESLint frontend | **0** | **0 errors, 0 warnings** (đã tách helper khỏi component) |
| `cd frontend && npm run typecheck` | TypeScript compilation frontend | **0** | `tsc --noEmit` đạt 0 lỗi |
| `cd frontend && npm run test:unit` | Vitest Unit & Behavioral Mock Tests | **0** | **15 passed** trong 3 test files (0 failures) |
| `cd frontend && npm run build` | Vite Production Bundle Build | **0** | Build thành công bundle `dist/` trong 1.88s |
| `cd frontend && npm run test:integration` | Live fullstack Golden Journey (jsdom $\to$ FastAPI $\to$ PG $\to$ Redis $\to$ DQN) | **0** | **1 passed** (728ms) |
| `node scripts/audit_mvp_hardening.cjs` | Chromium Headless E2E Browser Audit (Full Hardening Suite) | **0** | `allChecksPassed: true`, `errors: []`, `mobileClipping.clippedCount: 0`, `drawerInitialFocusInside: true`, `drawerFocusRestored: true`, `modalInitialFocusInside: true`, `modalTabTrapped: true`, `modalFocusRestored: true` |
| `node scripts/audit_mvp_hardening.cjs --negative-control` | Negative-control failure injection test | **1** | Xác nhận assertion `fallbackLabelValid` bắt được vi phạm nhãn và script trả mã exit 1 |
| `./scripts/ci_check.sh` | Toàn bộ pipeline kiểm tra Day-0 CI cục bộ (6 bước liên hoàn) | **0** | **ALL CHECKS PASSED** |
| `git diff --check` | Kiểm tra quy chuẩn khoảng trắng và diff | **0** | 0 cảnh báo whitespace |

### 2.2. Kiểm Tra Từ Xa (Remote CI)
- **Trạng thái:** **NOT RUN** (Chưa đẩy lên remote GitHub Actions do tuân thủ quy tắc G4: chưa có quyền push/merge riêng từ chủ dự án).
- **Sự chuẩn bị:** Cấu hình `.github/workflows/ci.yml` đã được cập nhật đầy đủ nhánh `fix/**`, khởi động backend nền, kiểm tra health probe và phân tầng kiểm thử sẵn sàng chạy ngay khi được cấp quyền push.

---

## 3. Quản Lý Artifacts & Bằng Chứng

Các tệp bằng chứng và kết quả thực nghiệm được lưu trữ có kiểm soát trong repository tại `docs/verification/artifacts/`:
1. [`audit_mvp_hardening_results.json`](artifacts/audit_mvp_hardening_results.json): Bản ghi JSON đầy đủ 15 kiểm tra runtime từ trình duyệt thật.
2. [`audit_mobile_probe.png`](artifacts/audit_mobile_probe.png): Ảnh chụp toàn trang giao diện tại màn hình mobile 390px (không bị clipping, scrollWidth = 390px).
3. [`audit_fallback_probe.png`](artifacts/audit_fallback_probe.png): Ảnh chụp giao diện thực tế khi nhận khuyến nghị `fallback_rule` và `degraded=true` (nhãn trung thực, không mang thương hiệu DQN).

---

## 4. Kết Luận & Đề Xuất Bước Kế Tiếp

- Toàn bộ 7 phát hiện H1–H7 đã được khắc phục triệt để bằng mã nguồn và kiểm thử thật, không suy đoán và không che giấu lỗi.
- Mọi dữ liệu người dùng thật và tài khoản mẫu ban đầu được giữ nguyên vẹn; các kiểm thử sử dụng tài khoản độc lập có tiền tố riêng biệt (`audit_h_*`, `audit_idem_*`, `audit_legacy_*`).
- **Bước kế tiếp đề xuất:**
  1. Chủ dự án xem xét báo cáo bàn giao này.
  2. Kích hoạt phiên review độc lập Gate 3 (4 trục: UI/UX & A11y, Code Quality, Security, Database) trên snapshot hiện tại.
  3. Sau khi Gate 3 đạt thẩm định độc lập, cấp quyền push nhánh `fix/mvp-quality-hardening` để nghiệm thu remote GitHub Actions CI.
