# Đặc tả hành vi Plumora

Phiên bản: `1.0.0` — **APPROVED (Gate 1 Baseline — Chủ dự án duyệt tại `D-14` / `O-10` ngày 2026-11-16)**. Căn cứ: [intent](intent.md) (`v1.0.0`), [brief](brief/project-direction.md), [quyết định](decisions.md) (`v1.0.0`, `D-01`–`D-14`), [System Design](design.md) (`v1.0.0`) và [UI Design System](ui-design-system.md) (`v1.0.0`).

Toàn bộ các câu hỏi thiết kế và nghiệp vụ (`O-01`–`O-10`) đã được chủ dự án chốt và phê duyệt chính thức cho **Gate 1 (G1)** (`PL-AUTH-01`, `PL-CONTENT-01`, `PL-QUIZ-01`, `PL-PROGRESS-01`, `PL-REC-01`, `PL-REC-02`, `PL-RL-01`, `PL-E2E-01`). Nhiệm vụ `ENV-01` (Gate 2 Readiness) đã được mở khóa (`ready`).

## 1. Vai trò người dùng, Khởi tạo trạng thái và Quản lý nội dung (`D-05` / `O-02` — Đã chốt)

- **Vai trò duy nhất trên giao diện:** `Learner` (Học viên). Không có màn hình quản trị nội dung (Admin CRUD CMS) trên web.
- **Nguồn nội dung chuẩn:** Toàn bộ 12 khái niệm (bài lý thuyết Markdown, câu hỏi trắc nghiệm MCQ và cạnh đồ thị tiên quyết DAG) được định nghĩa trong file cấu hình Seed (`JSON`/`YAML`) quản lý trong Git và nạp tự động (idempotent seed) vào PostgreSQL.
- **Trạng thái khởi tạo & Hồ sơ mẫu (Demo Presets):**
  - Học viên mới mặc định có điểm thông thạo (Mastery) `0.0` ở tất cả 12 node; hai node gốc Tầng 1 (`net-internet`, `os-basics`) được mở khóa sẵn.
  - Hệ thống cung cấp bộ **Hồ sơ mẫu (Demo Presets)** (ví dụ: *Học viên mới bắt đầu*, *Đã hoàn thành nền tảng Mạng & SQL*, *Đang học dở tầng API*) để nạp nhanh trạng thái vào phiên làm việc khi demo bảo vệ.

## 2. Danh mục 12 khái niệm Backend và Đồ thị tiên quyết DAG (`D-05` / `O-02` — Đã chốt)

| Thứ tự (`action_id`) | Mã khái niệm (`slug`) | Tên bài học / Khái niệm | Tầng (Tier) | Khái niệm tiên quyết (`prerequisites`) |
| --- | --- | --- | --- | --- |
| `0` | `net-internet` | Internet & Mô hình Mạng cơ bản (IP, DNS, TCP/UDP) | Tầng 1 | *(Không có — Root node)* |
| `1` | `os-basics` | Hệ điều hành, Process/Thread & I/O cơ bản | Tầng 1 | *(Không có — Root node)* |
| `2` | `web-http` | Giao thức HTTP/HTTPS (Methods, Status, Headers) | Tầng 2 | `net-internet` |
| `3` | `db-relational` | CSDL Quan hệ & SQL cơ bản | Tầng 2 | `os-basics` |
| `4` | `db-transactions` | Transaction (ACID) & Indexing trong RDBMS | Tầng 2 | `db-relational` |
| `5` | `db-nosql` | CSDL NoSQL (Document & Key-Value Store) | Tầng 2 | `db-relational` |
| `6` | `api-rest` | Thiết kế RESTful API chuẩn | Tầng 3 | `web-http` |
| `7` | `api-validation` | Validation, Serialization & Xử lý lỗi API | Tầng 3 | `api-rest` |
| `8` | `api-data` | Kết nối API với Database & Query Patterns | Tầng 3 | `db-transactions`, `api-rest` |
| `9` | `cache-redis` | Caching & Quản lý State với Redis | Tầng 3 | `db-nosql`, `api-rest` |
| `10` | `sec-authn` | Xác thực & Phân quyền (Session/JWT, RBAC) | Tầng 4 | `api-rest`, `cache-redis` |
| `11` | `sec-api` | Bảo mật API cơ bản (SQLi, Rate Limit, CORS) | Tầng 4 | `api-validation`, `api-data`, `sec-authn` |

**Quy tắc mở khóa (Unlock Invariant):** Một khái niệm $u$ được coi là **Đủ điều kiện học (Unlocked / Eligible)** khi và chỉ khi mọi khái niệm tiên quyết $p \in \text{prerequisites}(u)$ đều đã đạt trạng thái thông thạo ($\text{mastery}(p) \ge 0.75$).

## 3. Quy tắc Quiz, Chấm điểm và Cập nhật Mastery (`D-06` / `O-03` — Đã chốt)

- **Cấu trúc đề Quiz:** Mỗi lượt làm bài của một khái niệm gồm **cố định 4 câu hỏi trắc nghiệm khách quan (Single-choice MCQ)**, lấy từ ngân hàng Seed 4–6 câu của khái niệm đó. Mỗi câu có 4 phương án (`A, B, C, D`) và duy nhất 1 đáp án đúng.
- **Điều kiện hợp lệ khi nộp bài:** Học viên phải chọn đủ 4 đáp án cho 4 câu hỏi trong bài; thiếu câu trả lời hoặc gửi ID câu hỏi/phương án không thuộc bài học sẽ bị từ chối (`422 Unprocessable Entity` / `400 Bad Request`).
- **Công thức chấm điểm lượt làm bài (`attempt_score`):**
  $$\text{attempt\_score} = \frac{\text{correct\_count}}{4} \in \{0.00, 0.25, 0.50, 0.75, 1.00\}$$
  - Biên dưới ngưỡng thông thạo: $2/4 = 0.50$ (`passed = false`).
  - Biên chạm đúng ngưỡng thông thạo: $3/4 = 0.75$ (`passed = true`).
  - Biên trên ngưỡng thông thạo: $4/4 = 1.00$ (`passed = true`).
- **Quy tắc làm lại (Retake) & Cập nhật thông thạo (`High-Water Mark`):**
  - Cho phép học viên làm lại Quiz của một khái niệm đã mở khóa không giới hạn số lần.
  - Mọi lượt nộp hợp lệ đều tạo bản ghi `QuizAttempt` lưu `attempt_score` và `passed` của đúng lượt đó.
  - Điểm thông thạo tích lũy của khái niệm $i$ ($\text{mastery}_i$) được cập nhật theo hàm đơn điệu không giảm:
    $$\text{mastery}_i^{\text{new}} = \max\left(\text{mastery}_i^{\text{old}}, \text{attempt\_score}\right)$$
  - Khi $\text{mastery}_i^{\text{new}} \ge 0.75$, khái niệm $i$ giữ trạng thái `Mastered` và không bao giờ làm khóa ngược lại các khái niệm phụ thuộc phía sau nếu học viên làm lại đạt điểm thấp hơn ở lượt sau.

## 4. Hợp đồng Khuyến nghị RL và Xử lý Hành động Không hợp lệ (`D-07` / `O-04` — Đã chốt)

- **Đầu vào Policy (Observation `shape=(24,)`, `float32`):**
  - `obs[0..11]`: Vector điểm `mastery` hiện tại của 12 khái niệm ($\in \{0.00, 0.25, 0.50, 0.75, 1.00\}$).
  - `obs[12..23]`: Vector nhị phân `is_eligible` ($1.0$ nếu khái niệm đủ điều kiện tiên quyết theo quy tắc mục 2 và $\text{mastery}_i < 0.75$; $0.0$ trong trường hợp còn lại).
- **Không gian hành động (`Discrete(12)`):** Mỗi hành động $a \in \{0, \dots, 11\}$ ứng với đúng khái niệm có `action_id = a` tại mục 2.
- **Quy tắc Serving & Safety Guardrail trên API:**
  1. **Trạng thái hoàn thành toàn bộ (`all_mastered`):** Nếu cả 12/12 khái niệm đều có $\text{mastery}_i \ge 0.75$, API trả về trạng thái hoàn thành khóa học (`status = "completed"`, `recommended_concept = null`).
  2. **Đề xuất trực tiếp từ `DQN` (`policy_source = "dqn"`):** Khi checkpoint hợp lệ được nạp và hành động $a^* = \arg\max_{a} Q(s, a)$ có `is_eligible[a*] == 1.0`, trả về khái niệm $a^*$ kèm `policy_source = "dqn"`, `guardrail_applied = false`, `checkpoint_sha256`.
  3. **Lọc Q-value theo điều kiện tiên quyết (`policy_source = "dqn_masked_q"`):** Nếu $a^* = \arg\max_{a} Q(s, a)$ rơi vào bài bị khóa hoặc đã thông thạo, hệ thống chọn $a_{\text{valid}}^* = \arg\max_{a : \text{is\_eligible}[a]=1} Q(s, a)$ và trả về kèm metadata trung thực: `policy_source = "dqn_masked_q"`, `raw_action_id = a*`, `guardrail_applied = true`, `checkpoint_sha256`.
  4. **Fallback khi thiếu hoặc hỏng Checkpoint (`policy_source = "fallback_rule"`):** Nếu không nạp được checkpoint đã kiểm chứng, hệ thống chọn bài đầu tiên hợp lệ theo thứ tự tầng DAG (`is_eligible == 1.0`) và trả về `policy_source = "fallback_rule"`, `degraded = true`, tuyệt đối không gắn nhãn `dqn`.

## 5. Cấu trúc Màn hình Mini-LMS, Hệ màu Chồi Cây Non và Trạng thái UX (`D-09`, `D-12`, `D-13` / `O-06`, `O-09` — Đã chốt)

- **Công nghệ & Hệ thống Thiết kế ([`ui-design-system.md`](ui-design-system.md) `v0.2.0`):** React SPA (`Vite` + `TypeScript` + `Tailwind CSS` + `Radix` + `lucide-react`), bảng phối màu **Chồi Cây Non (*Botanical Sprout & Sunlit Canopy*: Xanh Chồi Rừng `#15803D`, Vàng Nắng Sớm `#D97706` cho bài AI đề xuất, Xanh Ngọc Lá Mạ `#0D9488` cho bài mới mở khóa, Xám Đá Ấm `#57534E` cho bài đang khóa, nền `#F6F8F5`)**, tuân thủ độ tương phản `WCAG 2.1 AA`.
- **Quy tắc Biểu tượng (`INV-UI-01` — `D-12`, `D-13`):** **Cấm tuyệt đối sử dụng ký tự Emoji** trên toàn bộ giao diện ứng dụng; chỉ sử dụng bộ SVG Vector Icons đồng nhất từ `lucide-react` (`<Sprout />`, `<Compass />`, `<CheckCircle2 />`, `<CircleDot />`, `<Lock />`, `<BookOpen />`, `<FileCheck2 />`).
- **Danh mục 8 màn hình/trạng thái (`SCR-01`–`SCR-08`) quanh 3 không gian chính:**
  1. **`Roadmap DAG View` (`SCR-02`, kèm Modal `SCR-05`, Drawer `SCR-06`, Hoàn thành `SCR-07`):** Hiển thị đồ thị 12 khái niệm chia 4 tầng với 4 trạng thái trực quan (`Locked`, `Unlocked / Eligible`, `Recommended by DQN`, `Mastered >= 75%`); tích hợp thanh chuyển đổi nhanh **Demo Presets** (`D-05`) và thẻ **AI Recommendation Banner** hiển thị bài được gợi ý kèm metadata (`policy_source`, `state_source`, `guardrail_applied`, `checkpoint_sha256` rút gọn).
  2. **`Lesson Reader View` (`SCR-03`, kèm Chặn khóa `SCR-08`):** Hiển thị bài giảng Markdown của khái niệm đã mở khóa, danh sách khái niệm tiên quyết, điểm `mastery` hiện tại và nút chuyển sang làm Quiz.
  3. **`Quiz & Mastery Feedback View` (`SCR-04`):** Hiển thị 4 câu hỏi Single-choice (`D-06`), khóa nút nộp khi chưa chọn đủ 4 câu (`Disabled`), hiển thị kết quả chấm điểm tức thì (`attempt_score`, ngưỡng `75%`, cập nhật `mastery_new = max(old, attempt_score)`) và nút nhận bài khuyến nghị tiếp theo.
- **Năm trạng thái UX bắt buộc trên mọi màn hình:** `Ideal` (đầy đủ dữ liệu), `Loading` (skeleton/spinner khi đang tải API), `Empty` (chưa có lịch sử làm bài), `Error` (thông báo lỗi rõ ràng kèm nút thử lại khi API/mạng lỗi), `Disabled` (khóa bài chưa đủ điều kiện tiên quyết hoặc nút nộp bài khi chưa chọn đủ 4 câu).

## 6. Hợp đồng Lưu trữ PostgreSQL, Redis State Cache, Idempotency và Fallback (`D-10` / `O-07` — Đã chốt)

- **Nguồn dữ liệu chuẩn (`Single Source of Truth — SSoT`):** `PostgreSQL` là nguồn chuẩn bền vững duy nhất cho toàn bộ bảng `concepts`, `concept_prerequisites`, `quiz_questions`, `users`, `user_concept_mastery`, `quiz_attempts`, và `recommendation_logs`.
- **Vai trò của `Redis` (`Read-through / Write-through State Cache`):** Lưu vector Observation 24 chiều đã tính sẵn tại key `plumora:state:{user_id}` kèm `state_version` (số nguyên tăng dần) và `TTL = 3600s`.
- **Tính nguyên tử & Đồng bộ Cache (ACID Transaction + Write-through):**
  - Khi học viên nộp Quiz hoặc chọn Demo Preset, hệ thống thực thi **1 ACID Transaction trên PostgreSQL**: kiểm tra idempotency, ghi `quiz_attempts`, cập nhật `mastery_new = max(mastery_old, attempt_score)`, tăng `state_version`.
  - Sau khi PostgreSQL `COMMIT`, backend cập nhật (Write-through) hoặc xóa key `plumora:state:{user_id}` trên Redis.
- **Tính lũy đẳng khi nộp Quiz (`Idempotency Contract`):**
  - Mỗi request nộp bài Quiz bắt buộc có `submission_id` (UUID). Bảng `quiz_attempts` có ràng buộc `UNIQUE (user_id, submission_id)`.
  - Nếu client gửi lặp cùng `(user_id, submission_id)`, backend không chấm lại, không tạo thêm bản ghi và không thay đổi `state_version`, mà trả về nguyên vẹn kết quả đã lưu của lần nộp đầu tiên.
- **Cơ chế chịu lỗi khi Redis Miss hoặc Down (`Graceful Degradation`):**
  - Khi suy luận khuyến nghị `DQN`: nếu đọc được từ Redis thì trả `state_source = "redis_cache"`.
  - Nếu Cache Miss: đọc từ PostgreSQL, dựng lại vector 24 chiều, ghi lại vào Redis (`cache_warm`) và trả `state_source = "postgres_cache_warm"`.
  - Nếu Redis mất kết nối hoặc timeout: backend tự động đọc trực tiếp từ PostgreSQL để dựng vector 24 chiều cho `DQN`, ghi log cảnh báo và trả `state_source = "postgres_fallback"` mà không làm gián đoạn API.

## 7. Hợp đồng Xác thực, Dữ liệu Cá nhân, Tài khoản Demo và Phân quyền (`D-11` / `O-08` — Đã chốt)

- **Đăng nhập, Đăng ký & Đăng xuất (`Authentication`):**
  - Hỗ trợ `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout` và `GET /api/v1/auth/me`.
  - Mật khẩu người dùng được băm một chiều bằng thuật toán an toàn (`Argon2id` hoặc `bcrypt`) trước khi lưu vào PostgreSQL; tuyệt đối không lưu hoặc ghi log mật khẩu dạng rõ (plaintext).
  - Phiên xác thực sử dụng `HttpOnly, SameSite=Lax` Cookie hoặc `JWT Bearer Token (HS256)` ký bằng khóa bí mật nạp từ biến môi trường (`AUTH_SECRET_KEY`).
- **Tối thiểu hóa dữ liệu cá nhân (`Data Minimization`):**
  - Bảng `users` chỉ lưu: `id` (UUID), `username` (`UNIQUE`, 3–32 ký tự chữ/số/gạch dưới), `display_name` (1–64 ký tự), `password_hash`, `state_version` (integer $\ge 1$) và `created_at`. Không thu thập email cá nhân thật, số điện thoại hay thông tin định danh nhạy cảm.
- **Tài khoản Demo thật & Nạp Hồ sơ mẫu (`Demo Accounts & Presets` — Không dùng Privileged Bypass):**
  - Seed sẵn **3 tài khoản học viên mẫu thật trong PostgreSQL** đi qua đúng luồng đăng nhập, kiểm tra mật khẩu và truy vấn PostgreSQL/Redis thật 100%:
    1. `learner_new`: cả 12 node đều có `mastery = 0.0` (mở khóa Tầng 1: `net-internet`, `os-basics`).
    2. `learner_foundation`: đã đạt `mastery >= 0.75` ở `net-internet`, `os-basics`, `web-http`, `db-relational`.
    3. `learner_api_stage`: đã đạt `mastery >= 0.75` ở toàn bộ Tầng 1–2 và `api-rest`, đang mở khóa các bài Tầng 3–4.
  - Endpoint `POST /api/v1/me/preset` cho phép người học đã đăng nhập đặt lại tiến độ 12 node của **chính tài khoản `current_user.id`** theo một trong 3 preset chuẩn (`new_learner`, `foundation_ready`, `api_stage_ready`) thông qua ACID transaction trên PostgreSQL và đồng bộ Redis (`D-10`).
- **Phạm vi quyền & Chống truy cập chéo (`Ownership & Anti-IDOR`):**
  - Chỉ có 1 vai trò `Learner` (`D-05`).
  - Mọi endpoint tiến độ, nộp Quiz, áp dụng Preset và xin khuyến nghị đều bắt buộc xác thực (trả `401 Unauthorized` nếu chưa đăng nhập hoặc token không hợp lệ) và chỉ thao tác trên `current_user.id` trích xuất từ phiên xác thực phía server.

## 8. Bất biến hệ thống (System Invariants), Kiểm thử âm và Yêu cầu phi chức năng (NFRs)

- **Bất biến hệ thống (`Invariants`):**
  1. `INV-DAG-01`: Không học viên nào có thể nộp bài Quiz cho một khái niệm đang ở trạng thái `Locked` ($\exists p \in \text{prerequisites}(u) : \text{mastery}(p) < 0.75$); server bắt buộc từ chối với mã `403 Forbidden` (`CONCEPT_LOCKED`).
  2. `INV-MASTERY-01`: Với mọi lượt nộp bài Quiz hợp lệ của cùng một người học trên một khái niệm, $\text{mastery}^{\text{new}} = \max(\text{mastery}^{\text{old}}, \text{attempt\_score}) \ge \text{mastery}^{\text{old}}$ (không bao giờ giảm điểm thông thạo tích lũy trừ khi người học chủ động gọi `POST /api/v1/me/preset`).
  3. `INV-IDEMP-01`: Gửi lặp cùng `(user_id, submission_id)` luôn trả về cùng `attempt_id`, `attempt_score` và `state_version`, không sinh thêm dòng thứ hai trong `quiz_attempts`.
  4. `INV-RL-01`: Mọi phản hồi khuyến nghị phải khai báo trung thực `policy_source` $\in \{\text{"dqn"}, \text{"dqn\_masked\_q"}, \text{"fallback\_rule"}\}$ và `state_source` $\in \{\text{"redis\_cache"}, \text{"postgres\_cache\_warm"}, \text{"postgres\_fallback"}\}$.
- **Yêu cầu phi chức năng đề xuất cho môi trường Local Docker Compose (`D-04`):**
  - Độ trễ suy luận API khuyến nghị (`POST /api/v1/recommendations`) ở mức tải đơn người dùng khi Demo trên máy cá nhân: mục tiêu $p95 < 200\text{ms}$ khi checkpoint đã nạp sẵn trong bộ nhớ process `FastAPI`.
  - Thời gian huấn luyện 1 seed (`100.000 timesteps`) của `DQN` trên `Student Simulator` 24 chiều: hoàn tất trong vài phút trên CPU máy cá nhân tiêu chuẩn.

## 9. Bảng tiêu chí nghiệm thu (`AC-ID`)

| AC-ID | Đầu vào → hành động → kết quả mong muốn (bao gồm nhánh lỗi / kiểm thử âm) | Quyết định nguồn |
| --- | --- | --- |
| `PL-AUTH-01` | Đăng ký / đăng nhập tài khoản mới hoặc 1 trong 3 tài khoản Seed (`learner_new`, `learner_foundation`, `learner_api_stage`) → gọi `/api/v1/auth/me` và các API bảo vệ → thành công khi có phiên hợp lệ, trả `401 Unauthorized` khi thiếu/sai thông tin xác thực; mật khẩu được băm an toàn, không lộ dữ liệu người học khác | `D-11` (`O-08`) |
| `PL-CONTENT-01` | Seed 12 khái niệm Backend & DAG (`D-05`) → xem `SCR-02 Roadmap DAG View` / `SCR-03 Lesson Reader View` hoặc chọn Demo Preset (`D-09`, `D-11`, `D-12`, `D-13`) → hiển thị đúng 12 node, 4 tầng tiên quyết, bảng màu Chồi Cây Non, 100% SVG icons `lucide-react` (không có emoji) và đủ 5 trạng thái UX (`Ideal`, `Loading`, `Empty`, `Error`, `Disabled`) | `D-05`, `D-09`, `D-11`, `D-12`, `D-13` (`O-02`, `O-06`, `O-08`, `O-09`) |
| `PL-QUIZ-01` | Bài Quiz 4 câu Single-choice của khái niệm đã mở khóa (`D-06`) → nộp đáp án kèm `submission_id` (`D-10`) → máy chủ tính đúng `attempt_score` và `passed` tại 3 mốc biên $2/4 (50\%)$, $3/4 (75\%)$, $4/4 (100\%)$; từ chối bài đang `Locked` (`403`) hoặc bài nộp thiếu câu / sai cấu trúc (`422`) | `D-06`, `D-10`, `D-11` (`O-03`, `O-07`, `O-08`) |
| `PL-PROGRESS-01` | Quiz hợp lệ → lưu `QuizAttempt` trong ACID transaction, cập nhật `mastery = max(old, attempt_score)` + tăng `state_version` + đồng bộ Redis (`D-06`, `D-10`) và tải lại → kết quả/mastery nhất quán, không khóa ngược DAG; nộp lặp cùng `submission_id` trả lại kết quả cũ không tạo bản ghi trùng | `D-06`, `D-10`, `D-11` (`O-03`, `O-07`, `O-08`) |
| `PL-REC-01` | Trạng thái 24 chiều hợp lệ từ Redis/PostgreSQL và checkpoint (`D-07`, `D-10`) → xin khuyến nghị → trả bài hợp lệ (`is_eligible == 1.0`) kèm metadata trung thực (`dqn` hoặc `dqn_masked_q`, `state_source`, `checkpoint_sha256`, `guardrail_applied`) | `D-05`, `D-07`, `D-10` (`O-02`, `O-04`, `O-07`) |
| `PL-REC-02` | Thiếu/hỏng checkpoint, Redis dừng hoạt động hoặc đã hoàn thành 12/12 bài (`D-07`, `D-10`) → xin khuyến nghị → trả trạng thái `completed`, `fallback_rule` (`degraded = true`) hoặc `state_source = "postgres_fallback"`, tuyệt đối không giả nhãn `dqn` | `D-07`, `D-10` (`O-04`, `O-07`) |
| `PL-RL-01` | Config/seeds cố định (`train_seeds=[101,202,303]`, `val_seed=999`, `eval_seed=2026` với `500` episodes) → train/evaluate trên `Student Simulator` 24 chiều (`D-04`–`D-08`) → xuất đủ `checkpoint.zip`, `SHA-256`, `training_log`, `evaluation_report` so sánh với `B1`, `B2`, `B3`; đạt `invalid_action_rate < 5%` cho `DQN (Unmasked)` và vượt `B2`, ghi đủ giới hạn | `D-04`–`D-08` (`O-01`–`O-05`) |
| `PL-E2E-01` | Người học hợp lệ (`D-11`) → đăng nhập → xem lộ trình → học lý thuyết → làm Quiz → cập nhật tiến độ → nhận khuyến nghị `DQN` → tải lại trang → hành trình thật 100% với API, PostgreSQL, Redis và checkpoint thực; không thay SUT bằng test fixture DOM | `D-04`–`D-11` (`O-01`–`O-08`) |

## Cần bổ sung trước G1

Actor/quyền, lifecycle nội dung và attempt, các nhánh lỗi và trạng thái UI, giới hạn input, bảo vệ dữ liệu, invariants, hợp đồng API và kiểm thử âm. NFR phải có điều kiện đo, workload, môi trường và ngưỡng do chủ dự án duyệt; chưa đặt số giả.

Mỗi AC được duyệt phải truy về yêu cầu nguồn, thiết kế, nhiệm vụ và kiểm thử. Dữ liệu fixture có thể kiểm soát đầu vào; kết quả kiểm thử phải quan sát ứng dụng thật.
