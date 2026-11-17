# Báo cáo Bàn giao & Nghiệm thu: Điều chỉnh Trải nghiệm Nghiệp vụ Thực tế (Product Realism Overhaul)

> **Dự án**: Plumora — Hệ thống khuyến nghị và quản lý lộ trình học tập cá nhân hóa bằng Học tăng cường (DQN)  
> **Nhánh**: `feat/product-realism`  
> **Ngày thực hiện**: 17/11/2026  
> **Mục tiêu**: Điều chỉnh Plumora thành hệ thống học tập có trải nghiệm thực tế, phục vụ bảo vệ đồ án tốt nghiệp, loại bỏ các nút bấm/phím tắt demo khỏi luồng học viên thông thường, sửa triệt để các lỗi R1–R4, bổ sung lịch sử làm bài, tách bạch thông báo hệ thống và phản ánh trung thực kết quả của mô hình DQN.

---

## 1. Tóm tắt Kết quả Thực hiện

Toàn bộ các yêu cầu trong `PLUMORA_PRODUCT_REALISM_DRAFT.md` và `PLUMORA_RECHECK_2026-11-17.md` đã được triển khai, kiểm thử TDD (quan sát RED trước khi GREEN), xây dựng bản dựng production và xác thực bằng trình duyệt Chromium thật:

1. **Hành trình Người học Thực tế (Realistic Learner Journey)**:
   - Học viên tự truy cập, đăng ký tài khoản mới qua form giao diện chuẩn với tên đăng nhập, tên hiển thị và mật khẩu băm Argon2id.
   - Bắt đầu với đúng tiến độ ban đầu của mình: **0/12 khái niệm hoàn thành (0%)**, không kế thừa hay gắn nhầm dữ liệu của tài khoản khác.
   - Phiên đăng nhập được quản lý bằng HttpOnly Cookie an toàn, **duy trì hợp lệ khi F5 tải lại trang** cả trong môi trường dev và production.
   - Xem lộ trình DAG 12 khái niệm qua 4 tầng; bài học bị khóa hiển thị lý do cụ thể và danh sách bài tiên quyết cần đạt chuẩn $\ge 75\%$.
   - Nhận đề xuất học tiếp từ mô hình DQN kèm giải thích trung thực, có căn cứ dữ liệu; tôn trọng quyền tự do của học viên (không ép buộc).
   - Đọc bài học với định dạng Markdown chuyên sâu, làm bài trắc nghiệm 4 câu, nhận kết quả Đạt/Chưa đạt tức thì kèm phân tích chi tiết.
   - Dễ dàng xem lại bài đọc hoặc làm lại bài kiểm tra để nâng cao mức độ thông thạo.
   - Tra cứu toàn bộ **Lịch sử làm bài (Quiz Attempts)** qua modal chuyên dụng với đầy đủ thông tin điểm số, thời gian, trạng thái đạt và các bài mới mở khóa.
   - Đăng xuất an toàn, xóa sạch dữ liệu phiên khỏi bộ nhớ client; đăng nhập lại ở phiên mới tiếp tục đúng dữ liệu đã lưu trữ.

2. **Tách biệt Hoàn toàn Công cụ Demo / Phát triển**:
   - Giao diện đăng nhập và bản đồ lộ trình chính của người học không còn chứa các nút chọn tài khoản mẫu hay thanh công cụ preset tiến độ.
   - Công cụ preset được kiểm soát từ phía server (`enable_dev_presets: bool = True` ở dev, cấu hình `False` trả về HTTP 403 `DEV_PRESETS_DISABLED` ở production).
   - Trên giao diện, các tiện ích thử nghiệm được gom gọn vào mục accordion riêng biệt, không can thiệp vào hành trình học viên thông thường.

3. **Tách rõ Đề xuất Học tăng cường (RL) và Thông báo Hệ thống**:
   - Hệ thống thông báo **Toast 4 biến thể ngữ nghĩa** (`success`, `info`, `warning`, `error`) với màu sắc và biểu tượng trực quan, độc lập với nội dung bài học.
   - Khuyến nghị AI phản ánh trung thực nguồn chính sách: DQN hay Fallback thứ tự tô-pô. Tuyệt đối không dùng Q-value làm "độ tin cậy", không dùng từ ngữ thổi phồng ("tối ưu nhất", "hoàn hảo tuyệt đối").
   - Ghi nhận trung thực mã băm SHA-256 của Checkpoint DQN và trạng thái bộ đệm Redis.

4. **Khắc phục Triệt để Các Lỗi Nền tảng (R1 – R4)**:
   - **R1 (Cookie Persistence)**: Áp dụng quy tắc RFC 6265bis: sử dụng cookie `plumora_session` khi chạy HTTP cục bộ và `__Host-plumora_session` khi chạy HTTPS production, giúp cookie không bị trình duyệt tự hủy.
   - **R2 (Concept Network Error Resilience)**: Bắt lỗi mạng khi tải chi tiết bài học, hiển thị alert banner kèm nút thử lại (`retry-fetch-concept-btn`), loại bỏ hoàn toàn unhandled promise rejection.
   - **R3 (Preset Stale Identity Map & Server Guard)**: Bổ sung `db.refresh(locked_user)` ngay sau khóa dòng `with_for_update()` để làm mới cache Identity Map của SQLAlchemy, đảm bảo `state_version` tăng chuẩn xác.
   - **R4 (Registration Race Condition)**: Bọc khối khởi tạo tài khoản trong `try...except IntegrityError:` và hoàn tác transaction, trả về HTTP 409 `USERNAME_TAKEN` thay vì mã lỗi 500.

---

## 2. Bảng Đối chiếu Finding → Hợp đồng → Kiểm thử → Khắc phục

| Mã | Vấn đề Thực tế | AC / Hợp đồng | Kiểm thử Hành vi | Giải pháp Khắc phục |
| :--- | :--- | :--- | :--- | :--- |
| **R1** | F5 tải lại trang làm mất phiên ở môi trường dev | D-11, RFC 6265bis | `backend/tests/test_recheck_r1_to_r4_red.py::test_r1_cookie_persistence_dev_cookie_name_does_not_use_host_prefix_without_secure` | Thêm thuộc tính `effective_session_cookie_name` vào cấu hình; trích xuất phiên từ cả 2 tiền tố cookie |
| **R2** | Lỗi mạng khi tải bài học gây unhandled promise rejection | D-03, UX Resilience | `frontend/src/__tests__/realism_r1_to_r4_red.test.tsx` | Try/catch trong `App.tsx`, hiển thị banner lỗi có nút retry và thông báo Toast lỗi |
| **R3** | Preset trùng phiên làm stale `state_version` | ACID SSoT, D-05 | `backend/tests/test_recheck_r1_to_r4_red.py::test_r3_preset_with_for_update_refreshes_user_model_preventing_stale_identity_map` | Gọi `db.refresh(locked_user)` sau khi `with_for_update()`; chặn preset ở production bằng 403 |
| **R4** | Đăng ký trùng username đồng thời trả về lỗi 500 | D-01, PL-AUTH-01 | `backend/tests/test_recheck_r1_to_r4_red.py::test_r4_concurrent_registration_duplicate_username_returns_409_never_500` | Bắt `IntegrityError`, rollback session, trả về 409 `USERNAME_TAKEN` |
| **REAL-01** | Học viên tự đăng ký và duy trì phiên | PL-AUTH-01 | `scripts/audit_product_realism.cjs` (bước 1-4) | Form đăng ký chuyển đổi tab, Argon2id, cookie persistence |
| **REAL-02** | Loại bỏ công cụ demo khỏi luồng học chính | Product Realism | `frontend/src/pages/AuthPage.tsx`, `RoadmapPage.tsx` | Thay danh sách tài khoản mẫu bằng bảng tổng quan 12 khái niệm 4 tầng |
| **REAL-03** | Khuyến nghị định hướng, không ép buộc | D-07, RL Ethics | `AiRecommendationBanner.tsx`, `DagNodeCard.tsx` | Bổ sung ghi chú quyền tự do lựa chọn, bỏ từ "tối ưu nhất", trung thực về điều kiện |
| **REAL-04** | Thông báo Toast 4 trạng thái | UI/UX Clarity | `Toast.tsx` | Hỗ trợ `success`, `info`, `warning`, `error` có icon, màu sắc và tự đóng sau 4.5s |
| **REAL-05** | Tra cứu lịch sử làm bài | PL-QUIZ-01, D-06 | `backend/tests/test_recheck_r1_to_r4_red.py::test_real_05_attempts_history_returns_chronological_records` | Endpoint `GET /api/v1/assessment/history` & component `AttemptHistoryModal.tsx` |

---

## 3. Bằng chứng Thực thi Toàn diện (Evidence Logs)

### 3.1. Day-0 CI & Pipeline (`./scripts/ci_check.sh`)
```
=== [1/6] Lint Check (Backend, RL, Frontend) ===
All checks passed! (Backend ruff: 0 errors)
All checks passed! (RL ruff: 0 errors)
> eslint . (Frontend eslint: 0 errors)

=== [2/6] Type Check (Backend, RL, Frontend) ===
Success: no issues found in 35 source files (Backend mypy)
Success: no issues found in 9 source files (RL mypy)
> tsc --noEmit (Frontend TypeScript: 0 errors)

=== [3/6] Unit & Behavioral Mock Tests (Backend, RL, Frontend) ===
Backend pytest: 29 passed in 4.96s
RL pytest: 9 passed in 3.59s
Frontend vitest (unit): 16 passed in 1.30s

=== [4/6] Frontend Production Build Check ===
> tsc -b && vite build
✓ built in 2.19s (dist/assets/index-D2_oGuXT.js: 346.17 kB)

=== [5/6] Backend Health Verification & Live Fullstack Integration ===
Backend at 127.0.0.1:8000 is active and healthy.
Live Fullstack Integration (e2e/live_fullstack_journey.spec.ts): 1 passed in 761ms

=== [6/6] Real Browser E2E Audit & Negative Control Verification ===
audit_mvp_hardening.cjs: allChecksPassed = true (0 errors, 20 checks passed)
audit_product_realism.cjs: allChecksPassed = true (0 errors, 12 checks passed)
Audit negative-control probe correctly failed with non-zero exit code as expected.
=== ALL DAY-0 CI, INTEGRATION & BROWSER E2E HARDENING CHECKS PASSED ===
```

### 3.2. Kết quả Kiểm thử Trình duyệt Thật (`scripts/audit_product_realism.cjs`)
```json
{
  "timestamp": "2026-11-17T12:07:39.289Z",
  "errors": [],
  "checks": {
    "unauthenticatedLanding": true,
    "initialFreshMastery": "Đã thông thạo: 0 / 12 khái niệm (0%)",
    "freshStateIsZero": true,
    "activeUsernameMatches": true,
    "sessionPersistedAcrossReload": true,
    "lockedReasonExplained": true,
    "recommendationGrounded": true,
    "lessonRendered": true,
    "quizPassed": true,
    "updatedMastery": "Đã thông thạo: 1 / 12 khái niệm (8%)",
    "masteryIncremented": true,
    "historyModalRecorded": true,
    "logoutTerminatedSession": true
  },
  "username": "real_1794917260214_588",
  "allChecksPassed": true
}
```

---

## 4. Xác nhận Hàng rào Kỹ thuật & Quyền hạn (Gates Verification)

- **G1 (Tiêu chí Nghiệm thu & Thiết kế Hợp đồng)**: Toàn bộ AC và hợp đồng API mới (`/api/v1/assessment/history`, `enable_dev_presets`, `effective_session_cookie_name`) đã được đặc tả chi tiết trong `docs/proposals/PRODUCT_REALISM_PLAN.md`.
- **G2 (Môi trường & RED Behavioral Tests)**: Môi trường kiểm thử được thiết lập độc lập với PostgreSQL 16 và Redis 7 healthy; kiểm thử RED được quan sát thất bại trước khi viết code sửa chữa.
- **G3 (Đánh giá Độc lập 4 Trục)**: Được giao phó cho subagent độc lập (`gate3-auditor`) kiểm tra trên branch `feat/product-realism`.
- **G4 (Quyền Merge & Production)**: Tuân thủ quy định: không tự ý commit, merge vào `main` hay push remote khi chưa có sự phê duyệt trực tiếp của người dùng.
