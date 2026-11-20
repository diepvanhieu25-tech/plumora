# Kịch Bản Kiểm Thử Hệ Thống Thực (Manual System Testing Script — Plumora `v2.0.0`)

> **Mục đích:** Hướng dẫn chủ dự án tự mở trình duyệt kiểm thử trực tiếp toàn bộ hệ thống Plumora Phase 3 (`v2.0.0`) đang chạy trên cụm Docker thật (`plumora-frontend`, `plumora-backend`, `plumora-postgres`, `plumora-redis`).

---

## 1. Thông Tin Truy Cập & Tài Khoản Kiểm Thử Thật

- **Giao diện Web (Frontend):** `http://localhost:3000`
- **API Swagger Docs (Backend):** `http://localhost:8000/docs`
- **Health Check Endpoint:** `http://localhost:8000/api/v1/health`

| Vai trò | Đường dẫn Cổng Đăng nhập | Tên đăng nhập (`username`) | Mật khẩu (`password`) | Ghi chú |
| --- | --- | --- | --- | --- |
| **Learner (Mới)** | `http://localhost:3000/login` | `learner_new` | `PlumoraDemo#2026` | 0/12 node — phù hợp test *Adaptive Placement* |
| **Learner (Nền tảng)** | `http://localhost:3000/login` | `learner_foundation` | `PlumoraDemo#2026` | 4/12 node — phù hợp test lộ trình `GNN-PPO`, Quiz & Sandbox |
| **Learner (Tầng API)** | `http://localhost:3000/login` | `learner_api_stage` | `PlumoraDemo#2026` | 7/12 node — mở nhiều node nâng cao |
| **Expert (Chuyên gia)** | `http://localhost:3000/expert/login` | `expert_demo` | `PlumoraDemo#2026` | Quản trị Knowledge Graph, câu hỏi 5 tầng & Code Challenge |
| **Admin (Quản trị)** | `http://localhost:3000/admin/login` | `admin_demo` | `PlumoraDemo#2026` | Giám sát Safe Online RL, Safety Gate, Rollback & Health |

> **Lưu ý kiểm tra trạng thái Docker trước khi test:**
> ```bash
> docker compose ps
> ```
> Cả 4 container (`plumora-frontend`, `plumora-backend`, `plumora-postgres`, `plumora-redis`) phải ở trạng thái `Up` / `healthy`.

---

## 2. Kịch Bản Kiểm Thử Chi Tiết Theo Vai Trò

### Phần A — Kiểm thử Phân quyền Tách Cổng & Bảo mật (`RBAC 403`)
1. Mở `http://localhost:3000/admin/login`.
2. Thử đăng nhập bằng tài khoản `learner_foundation` / `PlumoraDemo#2026`.
   - **Kỳ vọng:** Hệ thống từ chối với lỗi `403 FORBIDDEN_ROLE` (không cho phép Learner vào cổng Admin).
3. Mở trực tiếp URL `http://localhost:3000/expert/domains` khi đang chưa đăng nhập (hoặc đang đăng nhập Learner).
   - **Kỳ vọng:** Bị chặn điều hướng / hiển thị trang `403 Forbidden` hoặc yêu cầu đăng nhập đúng cổng.

---

### Phần B — Luồng Học viên (`SCR-01`, `SCR-09`..`SCR-14`)

1. **Đăng nhập Học viên (`SCR-01`):**
   - Truy cập `http://localhost:3000/login`, đăng nhập `learner_foundation` / `PlumoraDemo#2026`.
   - **Kỳ vọng:** Chuyển vào **Multi-Domain Hub (`SCR-09`)**, hiển thị 3 lĩnh vực (`backend`, `frontend`, `devops`).
2. **Đánh giá Định vị Thích ứng (`SCR-10` — Adaptive Placement):**
   - Chọn một lĩnh vực và bấm vào nút **Đánh giá Định vị (Adaptive Placement)** (hoặc test với `learner_new`).
   - Trả lời lần lượt các câu hỏi; theo dõi thanh tiến trình và độ tin cậy cập nhật theo từng bước.
   - **Kỳ vọng:** Hoàn thành xong, mức điểm khởi tạo bị giới hạn trần `<= 0.75` theo quy tắc `PL3-ASSESS-01`.
3. **Bản đồ Tri thức Đa ngành & Khuyến nghị `GNN-PPO` (`SCR-11`):**
   - Mở lộ trình của lĩnh vực `backend` (hoặc `frontend` / `devops`).
   - Quan sát Banner khuyến nghị AI (`GNN-PPO` + `Policy Guardrail`) ở đầu trang và trạng thái các node trên đồ thị DAG (node đã học, node mở khóa, node khóa, node giao thoa đa ngành, và chỉ số suy giảm trí nhớ Ebbinghaus $R(t)$).
   - Bấm vào một node **đang khóa** $\rightarrow$ **Kỳ vọng:** Hệ thống hiển thị cảnh báo điều kiện tiên quyết, không cho học nhảy cóc.
4. **Học & Thăm dò Chiều sâu 5 Tầng (`SCR-12` — Depth Probe):**
   - Bấm vào node được AI khuyến nghị (hoặc một node đang mở khóa).
   - Chọn chế độ **Thăm dò Chiều sâu 5 Tầng** (`SCR-12`), trả lời câu hỏi trắc nghiệm / tự luận ngắn qua các tầng (Tầng 1 $\rightarrow$ Tầng 5).
   - **Kỳ vọng:** Phản hồi chấm điểm tức thì; mở ngăn kéo **AI Tutor & Rubric (`SCR-14`)** để xem phân tích tiêu chí chấm điểm (hoạt động ổn định ngay cả khi không có LLM API key nhờ `Deterministic Fallback`).
5. **Thực hành Code Sandbox Cô lập (`SCR-13`):**
   - Mở tab/màn hình **Code Sandbox** trên một khái niệm có bài tập lập trình (ví dụ `net-internet`).
   - **Case 1 (Code hợp lệ):** Viết lời giải đúng yêu cầu và bấm **Chạy & Nộp bài** $\rightarrow$ **Kỳ vọng:** Trả kết quả Pass các test case trong thời gian `< 3000ms`.
   - **Case 2 (Kiểm thử bảo mật Sandbox):** Thử nhập `import os` hoặc `().__class__.__base__.__subclasses__()` và bấm nộp $\rightarrow$ **Kỳ vọng:** Bị chặn ngay với mã lỗi bảo mật (`422 SANDBOX_SECURITY_VIOLATION`).
   - **Case 3 (Chống treo CPU):** Thử nhập `while True: pass` $\rightarrow$ **Kỳ vọng:** Bị ngắt đúng ngưỡng timeout (`~3000ms`, `408 SANDBOX_TIMEOUT`).

---

### Phần C — Luồng Chuyên gia (`SCR-15`..`SCR-17`)

1. Mở `http://localhost:3000/expert/login`, đăng nhập `expert_demo` / `PlumoraDemo#2026`.
2. **Quản lý Lĩnh vực & Kiểm tra Chu trình DAG (`SCR-15`):**
   - Xem danh sách các lĩnh vực (`backend`, `frontend`, `devops`) và sơ đồ phụ thuộc.
   - Thử tạo một cạnh phụ thuộc tạo chu trình (A $\rightarrow$ B $\rightarrow$ A) $\rightarrow$ **Kỳ vọng:** Hệ thống chặn với lỗi `422` (thuật toán Kahn phát hiện chu trình DAG).
3. **Quản lý Ngân hàng Câu hỏi & Rubric (`SCR-16`):**
   - Xem / tạo câu hỏi thuộc Tầng 1–5; thử tạo câu hỏi có tổng trọng số Rubric khác `1.0` $\rightarrow$ **Kỳ vọng:** Hệ thống báo lỗi validation (`422`).
4. **Quản lý Code Challenge (`SCR-17`):**
   - Mở danh sách Code Challenge, kiểm tra phần test case mẫu và chạy kiểm thử xác thực qua Sandbox trước khi lưu.

---

### Phần D — Luồng Quản trị Hệ thống & Online RL (`SCR-18`..`SCR-20`)

1. Mở `http://localhost:3000/admin/login`, đăng nhập `admin_demo` / `PlumoraDemo#2026`.
2. **Giám sát Safe Online RL & Buffer (`SCR-18`):**
   - Quan sát 4 thẻ KPI: `Verified Experience Buffer`, `Guardrail & Safety Gate`, `Ràng buộc Chống Quên (KL)`, và `Prod Checkpoint Đang Phục vụ`.
   - Thử chỉnh `Kích thước Lô (batch_size)` lớn hơn `buffer_count` hiện có $\rightarrow$ **Kỳ vọng:** Nút **"Chạy Lô Tinh chỉnh Safe Micro-batch Online RL"** tự động khóa (`disabled`) kèm nhãn `Thiếu mẫu (...)`.
3. **Safety Gate & Model Registry / 1-Click Rollback (`SCR-19`):**
   - Kiểm tra bảng **4-Tier Benchmark**, biểu đồ so sánh `In-Domain vs Zero-Shot Transfer`, và danh sách **Kho Checkpoints Bất biến**.
   - Thử tìm kiếm theo `version_tag` / `SHA-256` và lọc `ALL` / `PASSED` / `BLOCKED`.
   - Bấm **"Kích hoạt vào Production"** trên một checkpoint `PASSED` (nếu có) $\rightarrow$ mở Modal xác nhận (thử bấm `Escape` để kiểm tra đóng modal bằng bàn phím), hoặc bấm **"1-Click Rollback"** $\rightarrow$ **Kỳ vọng:** Chuyển đổi thành công `< 2000ms` và cập nhật lại badge `ACTIVE PROD`.
4. **Giám sát Cụm 4 Microservices & Outbox (`SCR-20`):**
   - Kiểm tra 4 thẻ KPI (`Tổng số Microservices`, `Độ trễ Redis Streams`, `Hàng đợi Outbox Tồn đọng`, `Cache Hit Graph-State`).
   - Kiểm tra 4 card dịch vụ (`user-auth-service`, `content-kg-service`, `assessment-grader-service`, `recommendation-ai-service`) cùng schema riêng (`auth_svc`, `content_svc`, `assess_svc`, `rec_ai_svc`).
   - Bấm **"Làm mới Trạng thái"** $\rightarrow$ **Kỳ vọng:** Hiển thị thời gian cập nhật mới nhất và độ trễ API thực tế (ms).

---

### Phần E — Kiểm tra Responsive Mobile & Đăng xuất An toàn
1. Mở **DevTools (`F12`) $\rightarrow$ Toggle Device Toolbar** chọn kích thước **`390 x 844` (iPhone 12/13/14)**.
2. Lướt qua các màn hình Học viên, Chuyên gia, Quản trị:
   - **Kỳ vọng:** Không có thanh cuộn ngang (`0px` horizontal overflow), các nút bấm trên Mobile dễ chạm.
3. Bấm **Đăng xuất** ở góc trên bên phải:
   - **Kỳ vọng:** Quay về trang đăng nhập, xóa sạch trạng thái phiên; nếu dùng lại token cũ gọi `/api/v1/auth/me` sẽ bị từ chối `401 AUTH_REQUIRED`.
