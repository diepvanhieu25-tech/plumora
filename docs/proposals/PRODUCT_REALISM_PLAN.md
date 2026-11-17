# Kế Hoạch Chuyển Đổi Trải Nghiệm Nghiệp Vụ Thực Tế Plumora (Product Realism Plan)

- **Trạng thái:** DRAFT — Đang chờ duyệt từ Chủ dự án
- **Ngày lập:** 2026-11-17
- **Nhánh thực hiện:** `feat/product-realism`
- **Mục tiêu:** Chuyển đổi Plumora từ hệ thống trình diễn kỹ thuật/demo sang một hệ thống học tập cá nhân hóa có trải nghiệm nghiệp vụ thực tế hoàn chỉnh, đáp ứng chuẩn mực đồ án tốt nghiệp xuất sắc. Không mở rộng công nghệ mới (giữ nguyên 12 khái niệm Backend, FastAPI Modular Monolith, PostgreSQL 16, Redis 7, DQN Stable-Baselines3, React SPA).

---

## 1. Bảng Đối Chiếu Hiện Trạng → Hành Vi Đích → Tiêu Chí Chấp Nhận (AC) → Tác Động & Kiểm Chứng

| Nhóm Vấn Đề | Hiện Trạng Cần Thay Đổi | Hành Vi Đích Nghiệp Vụ Thực Tế | AC Liên Quan | Tác Động API / DB / UI | Phương Pháp Kiểm Chứng |
|---|---|---|:---:|---|---|
| **1. Giữ phiên sau tải lại (Session Persistence)** | Cookie mặc định `__Host-plumora_session` nhưng `secure=False` ở dev/local khiến trình duyệt loại bỏ cookie ngay lập tức. Sau reload, frontend mất token RAM, bị văng ra form đăng nhập (**R1**). Script audit cũ tự inject Bearer token che mất lỗi này. | Đăng nhập/Đăng ký thành công, trình duyệt nhận cookie HttpOnly hợp lệ. Khi người học F5/tải lại trang trong browser context mới, hệ thống tự động gọi `/api/v1/auth/me` với cookie gửi kèm, phục hồi phiên và lộ trình học tập chính xác. | `REAL-01`, `REAL-06`, `R1` | - **Backend:** Phân định tên cookie: dùng `plumora_session` khi chạy HTTP dev/local và tự động áp dụng `__Host-plumora_session` chỉ khi `secure=True` (production HTTPS). Hỗ trợ đọc cả hai tên cookie.<br>- **Frontend:** Giữ nguyên `credentials: 'include'`.<br>- **Audit Script:** Bỏ hoàn toàn việc inject Authorization header nhân tạo. | - Regression test backend kiểm tra set-cookie hợp lệ.<br>- Browser context mới: Đăng nhập $\to$ Reload $\to$ Giữ nguyên trạng thái `user` mà không dùng token inject. |
| **2. Luồng Người Học Sạch Sẽ & Kiểm Soát Demo Server-side** | Màn hình đăng nhập `AuthPage.tsx` gắn sẵn 3 nút chọn tài khoản seed (`learner_new`, v.v.). Màn hình lộ trình có thanh `DemoPresetToolbar`. Preset nạp user không refresh identity map gây mất lần tăng version (**R3**). | Luồng người học thông thường sạch sẽ 100%: Form đăng nhập/đăng ký với ô nhập trống, không có tài khoản mẫu. Bỏ thanh preset khỏi màn hình học viên. Các công cụ demo/preset (nếu dùng cho giảng viên/nhà phát triển) được kiểm soát nghiêm ngặt phía server qua cờ `ENABLE_DEV_PRESETS` (trả `403` khi tắt). Sửa lỗi identity map stale trong router preset. | `REAL-02`, `R3` | - **Backend:** Thêm cấu hình `enable_dev_presets: bool = True` (mặc định tắt ở production); thêm `db.refresh(locked_user)` ngay sau `with_for_update()` trong `assessment/router.py`.<br>- **Frontend:** Gỡ bỏ `SEEDED_PROFILES` khỏi `AuthPage.tsx`; gỡ bỏ `DemoPresetToolbar` khỏi giao diện người học. | - Test 2 luồng đồng thời gọi preset xác minh `state_version` tăng tuần tự chính xác.<br>- Test kiểm tra `ENABLE_DEV_PRESETS=False` chặn đứng API preset với mã 403.<br>- Browser audit xác minh giao diện đăng nhập không chứa profile seed. |
| **3. Kháng Lỗi Mạng & Trạng Thái Lỗi Độc Lập** | Hàm `handleOpenConcept` trong `App.tsx` gọi `apiGetConceptDetail` không có khối `catch`, gây unhandled promise rejection khi mất mạng hoặc fetch abort (**R2**). Lỗi tải đề xuất AI làm trắng cả lộ trình. Toast màu xanh bị dùng chung cho cả thông báo lỗi. | Khi fetch bài học lỗi, bắt lỗi rõ ràng, hiển thị thông báo lỗi thân thiện kèm nút "Thử lại" (Retry), không sập trang. Độc lập trạng thái lỗi: lỗi recommendation không làm mất roadmap; nộp bài thành công nhưng xin đề xuất lỗi không biến thành "nộp bài thất bại". Toast hỗ trợ 4 trạng thái ngữ nghĩa (`success`, `info`, `warning`, `error`). | `REAL-07`, `R2`, Section 2D | - **Frontend:** Thêm try/catch cho `apiGetConceptDetail`; tách riêng error state cho roadmap, recommendation, lesson, quiz; tái cấu trúc `Toast.tsx` hỗ trợ 4 màu sắc/icon theo chuẩn WAI-ARIA. | - Fault injection abort fetch concept $\to$ kiểm tra xuất hiện thông báo lỗi kèm nút Retry, không có unhandled rejection.<br>- Fault injection route `/recommendations` 500 $\to$ lộ trình vẫn hiển thị bình thường. |
| **4. Đồng Thời Khi Đăng Ký Tài Khoản** | `register_user` trong `backend/app/modules/auth/router.py` chỉ precheck username, không bắt `IntegrityError` khi có nhiều request đồng thời trùng username $\to$ HTTP 500 (**R4**). | Khi có 2 hoặc nhiều request đăng ký cùng lúc với cùng 1 username, đúng 1 request thành công (201 Created), các request còn lại được bắt lỗi và trả về HTTP 409 Conflict (`USERNAME_TAKEN`), tuyệt đối không có lỗi 500. | `REAL-01`, `R4` | - **Backend:** Bọc `db.flush()` và `db.commit()` trong khối `try...except IntegrityError:`, thực hiện `db.rollback()` và ném `409 Conflict`. | - Backend concurrency test gửi 5 luồng đăng ký cùng 1 username $\to$ ghi nhận chính xác 1 mã 201 và 4 mã 409. |
| **5. Đề Xuất Học Tập & Quyền Tự Do Lựa Chọn** | Banner đề xuất trình bày như mệnh lệnh áp đặt; nhãn Q-value dễ bị hiểu nhầm là độ tự tin; thiếu phân định giữa luật tiên quyết DAG (bài đủ điều kiện) và chính sách RL (bài ưu tiên). | - Đề xuất học tiếp mang tính định hướng, học viên có toàn quyền chọn bất kỳ bài học nào khác đang mở khóa (Eligible).<br>- Giải thích đề xuất có căn cứ từ dữ liệu thật: nêu rõ các bài tiên quyết đã đạt chuẩn $\ge 75\%$, trong tập bài đủ điều kiện học thì DQN ưu tiên bài nào.<br>- Các bài bị khóa hiển thị rõ ràng lý do: "Cần hoàn thành [Tên các bài tiên quyết] $\ge 75\%$".<br>- Không bịa đặt lý do nhân quả, không gọi Q-value là độ tự tin. | `REAL-03`, `REAL-08`, Section 2A, 2B | - **Frontend:** Tinh chỉnh `AiRecommendationBanner.tsx` bổ sung ghi chú quyền tự do chọn bài; bổ sung giải thích căn cứ thật; chuẩn hóa hiển thị điều kiện tiên quyết chưa đạt trong `DagNodeCard.tsx`. | - Kiểm tra giao diện hiển thị danh sách bài tiên quyết chưa đạt trên node bị khóa.<br>- Kiểm tra banner phản ánh đúng nguồn chính sách thật và cho phép chọn bài khác. |
| **6. Xem Lịch Sử Làm Bài & Tiến Độ Học Viên** | Đã lưu bảng `quiz_attempts` trong cơ sở dữ liệu nhưng chưa có API cho học viên xem lại lịch sử các lần làm bài của chính mình và chưa có UI hiển thị. | Cung cấp API `GET /api/v1/assessment/history` trả về danh sách lịch sử nộp bài của học viên hiện tại (slug, tiêu đề, điểm, đạt/chưa đạt, số câu đúng/tổng, thời gian). Giao diện có mục "Lịch sử học tập" trực quan giúp người học theo dõi sự tiến bộ. | `REAL-05`, Section 1, 2C | - **Backend:** Bổ sung router `GET /api/v1/assessment/history` và hàm truy vấn `QuizAttemptModel`.<br>- **Frontend:** Thêm component `AttemptHistoryModal` (hoặc view lịch sử) có nút mở từ Header / Thẻ tiến độ. | - Test API lịch sử trả về đúng số lần nộp bài của học viên, sắp xếp giảm dần theo thời gian.<br>- Browser E2E: Học viên làm 2 lần quiz $\to$ mở xem lịch sử $\to$ thấy cả 2 lần với điểm số và ngày giờ chính xác. |

---

## 2. Kế Hoạch Triển Khai Tuần Tự Theo Các Lát Cắt Nghiệp Vụ (Implementation Slices)

```
[Phase 1: Chuẩn bị & RED Tests]
  ├── Viết test kiểm chứng R1, R2, R3, R4 (Backend + Frontend)
  └── Quan sát trạng thái RED

[Phase 2: Sửa 4 Lỗi Nền Tảng R1–R4]
  ├── R1: Chuẩn hóa Cookie Session (HTTP dev vs HTTPS prod)
  ├── R4: Bắt IntegrityError khi đăng ký đồng thời (HTTP 409)
  ├── R3: Thêm db.refresh sau FOR UPDATE trong Preset router & server guard
  └── R2: Bọc try/catch cho apiGetConceptDetail kèm Retry UI
  └── Chạy kiểm thử xác nhận GREEN cho R1–R4

[Phase 3: Lát cắt 1 — Xác Thực Thực Tế & Quản Lý Phiên (REAL-01, REAL-02, REAL-06)]
  ├── Thanh lọc AuthPage: bỏ Seed profiles, giữ form đăng ký/đăng nhập chuẩn
  ├── Xóa bỏ prefilled inputs trong App.tsx
  ├── Xác minh Session Persistence qua F5 reload trong browser context mới
  └── Đảm bảo cô lập dữ liệu 100% giữa các người dùng

[Phase 4: Lát cắt 2 — Đề Xuất RL Thích Ứng & Quyền Chọn Bài (REAL-03, REAL-08)]
  ├── Cập nhật AiRecommendationBanner: giải thích dựa trên dữ liệu thật
  ├── Phân định rõ "Bài đủ điều kiện (DAG)" và "Bài được ưu tiên (DQN)"
  ├── Khẳng định quyền tự do chọn bài học hợp lệ khác
  └── Hiển thị chi tiết lý do khóa (thiếu bài tiên quyết nào) trên DagNodeCard

[Phase 5: Lát cắt 3 — Lưu Tiến Độ & Lịch Sử Làm Bài (REAL-04, REAL-05)]
  ├── Xây dựng API GET /api/v1/assessment/history
  ├── Xây dựng UI Modal Lịch sử làm bài (AttemptHistoryModal)
  ├── Thẻ kết quả QuizResultCard: phân định điểm lượt này, điểm bảo lưu, bài mới mở
  └── Đảm bảo replay không sinh lượt lịch sử mới

[Phase 6: Lát cắt 4 — Thông Báo Hệ Thống & Độc Lập Lỗi (REAL-07, Section 2D)]
  ├── Nâng cấp Toast.tsx với 4 biến thể (success, info, warning, error)
  ├── Tách biệt hoàn toàn thông báo hệ thống và nội dung khuyến nghị RL
  └── Error boundary độc lập cho Roadmap, Lesson, Quiz, Recommendation

[Phase 7: Kiểm Thử Nghiệm Thu Trình Duyệt Thực Tế (Browser Acceptance E2E)]
  ├── Xây dựng kịch bản kiểm thử E2E người dùng thật từ context mới
  ├── Tự đăng ký qua form → đăng nhập → học → quiz → xem lịch sử → reload → tiếp tục
  ├── Kiểm tra trường hợp đạt, chưa đạt, retry mạng, session hết hạn
  └── Chụp ảnh và video ghi lại toàn bộ hành trình
```

---

## 3. Các Quyết Định Nghiệp Vụ & Kiến Trúc Cần Xác Nhận

Dưới đây là 3 phương án kỹ thuật cụ thể đã chuẩn bị để thực thi đúng định hướng:

1. **Về Session Cookie (`R1` / `REAL-01`):**
   - *Phương án:* Trong môi trường phát triển cục bộ (`APP_ENV != "production"`), sử dụng tên cookie `plumora_session` với `secure=False, samesite="lax", path="/"`. Trong môi trường production (`APP_ENV == "production"`), tự động nâng cấp thành `__Host-plumora_session` với `secure=True, samesite="lax", path="/"`. Backend `extract_current_user` kiểm tra cả hai tên để tương thích ngược.
   - *Tác động:* Trình duyệt Chromium/Firefox chấp nhận và lưu trữ cookie ngay trên `http://localhost`, giải quyết triệt để lỗi mất đăng nhập sau khi reload mà không cần lưu token thiếu an toàn ở `localStorage`.

2. **Về Công Cụ Demo Preset (`REAL-02` / `R3`):**
   - *Phương án:* Bổ sung cấu hình `ENABLE_DEV_PRESETS: bool = False` trong môi trường production (mặc định `True` khi chạy local testing). Trên giao diện người học thông thường, loại bỏ hoàn toàn các nút/toolbar preset. Nếu cờ tắt, endpoint `POST /api/v1/me/preset` trả về HTTP 403 Forbidden.
   - *Tác động:* Bảo vệ hệ thống vận hành thực tế không bị thao túng tiến độ từ giao diện người học, đồng thời giữ khả năng kiểm thử mô hình khi cần.

3. **Về Lịch Sử Làm Bài (`REAL-05`):**
   - *Phương án:* Xây dựng endpoint `GET /api/v1/assessment/history` trả về danh sách tối đa 50 lượt nộp bài gần nhất của học viên từ bảng `quiz_attempts` (kèm thông tin khái niệm). Trên Header/Roadmap thêm nút "Lịch sử học tập" mở modal hiển thị danh sách các lần nộp.
   - *Tác động:* Người học có thể xem lại điểm số từng lần, thời gian nộp và tiến trình cải thiện điểm số qua các lần làm lại.
