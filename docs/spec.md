# Đặc tả hành vi Plumora

Phiên bản: `2.0.0` — **APPROVED (Gate 1 Baseline Giai đoạn 3 — Chủ dự án duyệt tại `D-16`..`D-26` ngày 2026-11-18; bảo lưu trọn vẹn lịch sử Gate 1 Baseline MVP `v1.0.0` duyệt tại `D-14` / `O-10` ngày 2026-11-16)**. Căn cứ: [intent](intent.md) (`v2.0.0`), [brief](brief/project-direction.md), [báo cáo phân tích Giai đoạn 3](proposals/PHASE3_ANALYSIS.md), [quyết định](decisions.md) (`v2.0.0`, `D-01`–`D-26`), [System Design](design.md) (`v2.0.0`) và [UI Design System](ui-design-system.md) (`v2.0.0`).

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

---

## 10. Đặc tả Mở rộng Giai đoạn sau MVP — Đích Giai đoạn 3 (`v2.0.0` — APPROVED tại `D-16`..`D-26`)

- **Nguồn căn cứ:** [intent.md](intent.md) (`v2.0.0`), [proposals/PHASE3_ANALYSIS.md](proposals/PHASE3_ANALYSIS.md) và các quyết định `D-16`–`D-26` trong [decisions.md](decisions.md) (Chủ dự án phê duyệt ngày `2026-11-18`).
- **Nguyên tắc tương thích ngược:** Giữ nguyên toàn bộ bất biến MVP (`INV-DAG-01`, `INV-MASTERY-01`, `INV-IDEMP-01`, `INV-RL-01`) và mở rộng cho đồ thị đa lĩnh vực, đánh giá chiều sâu 5 tầng, Code Sandbox, AI Tutor, Spaced Repetition (*Ebbinghaus*), `GNN-PPO` + `Safe Micro-batch Online RL` và kiến trúc 4 Microservices.

### 10.1. Vai trò & Phân quyền RBAC Mở rộng (`PL3-ROLE-01`, `D-17`)

| Vai trò (`role`) | Quyền hạn được phép | Hành vi bị cấm (`403 Forbidden`) |
| --- | --- | --- |
| **`learner`** | Xem/chuyển đổi đồ thị đa lĩnh vực (`SCR-09`, `SCR-11`), làm bài chẩn đoán đầu vào (*Adaptive Placement* — `SCR-10`), học lý thuyết, làm bài đánh giá đào sâu 5 tầng (`SCR-12`) & thực hành Code Sandbox (`SCR-13`), nhận phản hồi AI Tutor & ôn tập *Ebbinghaus* (`SCR-14`) và nhận khuyến nghị lộ trình của chính `current_user.id`. | Truy cập dữ liệu học viên khác (chống IDOR); gọi API biên soạn Knowledge Graph/Rubric (`/api/v2/expert/*`) hoặc API kiểm định/rollback mô hình (`/api/v2/admin/*`). |
| **`expert`** | Toàn bộ quyền đọc nội dung + **tạo mới/cập nhật/duyệt Knowledge Graph đa lĩnh vực** (`SCR-15`: thêm lĩnh vực, node, cạnh tiên quyết không cần sửa mã nguồn), biên soạn **ngân hàng câu hỏi 5 tầng đào sâu, 4 dạng bài thực tế & Rubric chấm điểm** (`SCR-16`), thiết kế **bài tập Code Sandbox & Test Cases** (`SCR-17`). | Thay đổi điểm số của học viên; kích hoạt hoặc rollback checkpoint mô hình RL trên production runtime (`/api/v2/admin/*`). |
| **`admin`** | Giám sát chỉ số vận hành hệ thống (`SCR-20`) & **Online RL Monitor** (`SCR-18`), xem kết quả **Safety Evaluation Gate** của các checkpoint ứng viên từ `Safe Micro-batch Online RL`, **duyệt phát hành (Activate)** checkpoint mới hoặc **Rollback 1-Click** (`SCR-19`) về phiên bản an toàn trước đó; quản lý phân quyền vai trò. | Can thiệp sửa trực tiếp lịch sử bài nộp (`attempt_records`) của học viên. |

### 10.2. Đồ thị Đa lĩnh vực & Danh mục Node Cố định (`PL3-KG-01`, `D-18`)

Hệ thống cung cấp sẵn **3 lĩnh vực mẫu cố định có giao thoa khái niệm** (`backend`: 12 node tại Mục 2, `frontend`: 10 node, `devops`: 9 node), cùng đồ thị kiểm thử độc lập thứ 4 `heldout_data_eng_graph` (10 node — đặc tả tại [`docs/research/RL_PLAN.md`](research/RL_PLAN.md) Mục 4):

#### A. Bảng Danh mục 10 Khái niệm Lĩnh vực `frontend` (4 Tầng DAG — 4 Node Giao thoa + 6 Node Đặc thù)

| Thứ tự (`node_idx`) | Mã khái niệm (`slug`) | Tên bài học / Khái niệm | Tầng (`tier`) | Khái niệm tiên quyết trong `frontend` (`prerequisites`) | Giao thoa (`is_shared`) |
| --- | --- | --- | --- | --- | --- |
| `0` | `net-internet` | Internet & Mô hình Mạng cơ bản (IP, DNS, TCP/UDP) | Tầng 1 | *(Không có — Root node)* | **`true`** *(Chung với `backend`, `devops`)* |
| `1` | `fe-dom-events` | Cây DOM, Browser Rendering Pipeline & Event Loop | Tầng 1 | *(Không có — Root node)* | `false` *(Đặc thù Frontend)* |
| `2` | `web-http` | Giao thức HTTP/HTTPS (Methods, Status, Headers, CORS) | Tầng 2 | `net-internet` | **`true`** *(Chung với `backend`, `devops`)* |
| `3` | `fe-js-async` | Bất đồng bộ trong JavaScript (Promises, Async/Await, Microtasks) | Tầng 2 | `fe-dom-events` | `false` *(Đặc thù Frontend)* |
| `4` | `fe-component-state` | Kiến trúc Component, Unidirectional Data Flow & State Management | Tầng 2 | `fe-dom-events` | `false` *(Đặc thù Frontend)* |
| `5` | `api-rest` | Thiết kế & Tích hợp RESTful API chuẩn | Tầng 3 | `web-http` | **`true`** *(Chung với `backend`)* |
| `6` | `fe-data-fetching` | Client Data Fetching, Caching, Stale-While-Revalidate & Optimistic UI | Tầng 3 | `fe-js-async`, `fe-component-state`, `api-rest` | `false` *(Đặc thù Frontend)* |
| `7` | `sec-authn` | Xác thực & Quản lý Phiên (HttpOnly Cookie, JWT, RBAC Flow) | Tầng 4 | `api-rest` | **`true`** *(Chung với `backend`)* |
| `8` | `fe-xss-csrf` | Bảo mật Giao diện Web (Chống XSS, CSRF, CSP & Sanitization) | Tầng 4 | `fe-component-state`, `sec-authn` | `false` *(Đặc thù Frontend)* |
| `9` | `fe-perf-caching` | Tối ưu Hiệu năng Web (Code Splitting, Memoization, Core Web Vitals) | Tầng 4 | `fe-data-fetching` | `false` *(Đặc thù Frontend)* |

#### B. Bảng Danh mục 9 Khái niệm Lĩnh vực `devops` (4 Tầng DAG — 5 Node Giao thoa + 4 Node Đặc thù)

| Thứ tự (`node_idx`) | Mã khái niệm (`slug`) | Tên bài học / Khái niệm | Tầng (`tier`) | Khái niệm tiên quyết trong `devops` (`prerequisites`) | Giao thoa (`is_shared`) |
| --- | --- | --- | --- | --- | --- |
| `0` | `os-basics` | Hệ điều hành Linux, Process/Thread, Filesystem & I/O cơ bản | Tầng 1 | *(Không có — Root node)* | **`true`** *(Chung với `backend`)* |
| `1` | `net-internet` | Internet & Mô hình Mạng cơ bản (IP, DNS, TCP/UDP, Routing) | Tầng 1 | *(Không có — Root node)* | **`true`** *(Chung với `backend`, `frontend`)* |
| `2` | `web-http` | Giao thức HTTP/HTTPS & TLS Termination | Tầng 2 | `net-internet` | **`true`** *(Chung với `backend`, `frontend`)* |
| `3` | `docker-containers` | Ảo hóa mức OS, Namespaces/Cgroups & Đóng gói Docker Container | Tầng 2 | `os-basics`, `net-internet` | `false` *(Đặc thù DevOps)* |
| `4` | `reverse-proxy-caching` | Reverse Proxy, Load Balancing & HTTP Edge Caching (Nginx) | Tầng 3 | `web-http`, `docker-containers` | `false` *(Đặc thù DevOps — bao hàm HA/DB Replication routing)* |
| `5` | `cache-redis` | Vận hành Redis Cluster, Persistence (RDB/AOF) & State Store | Tầng 3 | `docker-containers`, `web-http` | **`true`** *(Chung với `backend`)* |
| `6` | `ci-cd-pipelines` | Tự động hóa Kiểm thử, Build Artifact & Đường ống CI/CD | Tầng 3 | `docker-containers` | `false` *(Đặc thù DevOps)* |
| `7` | `k8s-orchestration` | Điều phối Container với Kubernetes (Pods, Deployments, HPA, Readiness) | Tầng 4 | `reverse-proxy-caching`, `ci-cd-pipelines`, `cache-redis` | `false` *(Đặc thù DevOps)* |
| `8` | `sec-api` | Bảo mật Hạ tầng & API Gateway (Rate Limit, Secret Management, Network Policy) | Tầng 4 | `reverse-proxy-caching`, `k8s-orchestration` | **`true`** *(Chung với `backend`)* |

- **Chuyển giao tri thức ở các node giao thoa (`Cross-Domain Shared Nodes`):** Bảng `user_node_competency` lưu năng lực theo `(user_id, concept_slug)`. Khi học viên đã đạt mức hiểu (`depth_level_norm`) và hệ số duy trì trí nhớ $R(t)$ trên một node dùng chung ở lĩnh vực A (ví dụ `web-http` trong `backend`), năng lực của node đó được phản ánh tức thời khi học viên chuyển sang lĩnh vực B (`frontend` hoặc `devops`) và tính ngay vào điều kiện mở khóa `is_eligible` của các node phụ thuộc.
- **Tạo lĩnh vực động bởi `Expert`:** `Expert` có thể định nghĩa lĩnh vực mới qua API/UI (`POST /api/v2/expert/domains`, `POST /api/v2/expert/domains/{slug}/nodes`, `POST /api/v2/expert/domains/{slug}/edges`) kèm kiểm tra đồ thị có hướng không chu trình bằng thuật toán sắp xếp tô-pô Kahn / DFS (trả `422 DAG_CYCLE_DETECTED` nếu tạo vòng lặp).

### 10.3. Công thức Định lượng Đánh giá Năng lực 2 Chế độ, Code Sandbox, AI Tutor & *Ebbinghaus* (`PL3-ASSESS-01`, `PL3-GRADER-01`, `PL3-TUTOR-01`, `PL3-MEMORY-01`, `D-19`, `D-20`)

#### 1. Chế độ 1 — Chẩn đoán đầu vào nhanh (`Adaptive Placement` — Tối đa 5–6 câu):
- **Cơ chế lấy mẫu & Nhảy tầng theo DAG:**
  - Phiên `Adaptive Placement` của một lĩnh vực chỉ hỏi **tối đa $K_{\max} \in [5, 6]$ câu hỏi chẩn đoán phân tầng** (tập trung từ Tầng 1 $\rightarrow$ Tầng 3).
  - **Bước 1:** Bắt đầu từ các Root Nodes ở Tầng 1 (ví dụ `net-internet`, `fe-dom-events`).
  - **Bước 2 (Nhảy tầng tiến — Step-up):** Nếu học viên trả lời đúng/đạt chuẩn ($\text{score} \ge 0.75$) câu chẩn đoán ở node $u$ thuộc Tầng $k$, hệ thống cấp mức hiểu khởi tạo cho $u$ và tự động nhảy lên khảo sát node phụ thuộc trực tiếp $v \in \text{children}(u)$ ở Tầng $k+1$. Nếu câu ở Tầng $k+1$ cũng đạt chuẩn ($\ge 0.75$), các node tiên quyết trực tiếp của nó ở Tầng $k$ được xác nhận đủ điều kiện mở khóa.
  - **Bước 3 (Dừng nhánh — Branch Ceiling):** Nếu học viên trả lời sai ($< 0.75$) tại node $u$, hệ thống dừng khảo sát toàn bộ nhánh hậu duệ của $u$ (giữ `depth_level_norm = 0.00`, `confidence = 0.30`).
- **Trần mức hiểu khởi tạo (`Placement Cap`):**
  - Mức hiểu tối đa được cấp qua `Adaptive Placement` bị chặn trên tại **`Deep Understanding` (`depth_level_norm = 0.75`)** kèm **`confidence = 0.60`** và độ bền trí nhớ khởi tạo $S_0 = 3.0$ ngày.
  - Bài chẩn đoán đầu vào **tuyệt đối không cấp ngay mức `Mastery = 1.00`**; học viên bắt buộc phải thực hiện phiên Đào sâu Tầng 4–5 hoặc bài thực hành Code Sandbox để đạt `Mastery = 1.00` với `confidence >= 0.85`.

#### 2. Chế độ 2 — Máy Trạng thái Đào sâu 5 Tầng (`5-Depth Probing State Machine`):
- **5 tầng độ sâu & 4 dạng bài thực tế:**
  - **Tầng 1 (*What — Khái niệm*)** & **Tầng 2 (*How — Cơ chế*):** Trắc nghiệm nhiều bước / tình huống cơ bản (chấm tất định).
  - **Tầng 3 (*When & Pitfalls — Ứng dụng & Cạm bẫy*)**, **Tầng 4 (*Trade-offs — Đánh đổi kiến trúc*)**, **Tầng 5 (*Internals — Tối ưu & Nội tại*):** Kết hợp 4 dạng bài thực tế: (1) *Troubleshooting (Chẩn đoán sự cố)*, (2) *Code Review & Refactoring (trên Code Sandbox)*, (3) *Constraint Shifting (Đổi ràng buộc hệ thống)*, (4) *Reverse Explanation / Teach-back (Giải thích ngược theo Rubric)*.
- **Quy tắc chuyển tầng & chạm Trần hiểu biết (`Knowledge Ceiling`):**
  - Phiên đánh giá bắt đầu tại tầng tương ứng với mức hiểu hiện tại của học viên (mặc định Tầng 1 nếu `depth_level_norm < 0.25`, hoặc Tầng 3 nếu đã đạt `Applied = 0.50`).
  - Đạt ngưỡng ở tầng $d$ ($\text{step\_score}_d \ge 0.75$) $\rightarrow$ chuyển sang câu hỏi/bài thực tế ở tầng $d+1$ (cho tới khi hoàn tất Tầng 5).
  - Chưa đạt ($\text{step\_score}_d < 0.75$) ở **2 lượt thử liên tiếp trong cùng tầng $d$** $\rightarrow$ kích hoạt trạng thái **Chạm Trần Hiểu Biết (`Knowledge Ceiling Reached`)** tại tầng $d-1$, kết thúc phiên và tổng hợp mức hiểu.
- **Bảng Ánh xạ Tất định 3 Chiều (`Tầng cao nhất đạt chuẩn d` $\times$ `Dạng bài thực tế` $\times$ `Điểm Rubric/Sandbox` $\rightarrow$ `Mức hiểu & Confidence`):**

| Tầng cao nhất đạt chuẩn $d \in \{0..5\}$ | Điều kiện Dạng bài Thực tế & Điểm Kiểm chứng (`step_score >= 0.75`) | Mức hiểu chuẩn hóa (`depth_level_norm`) | Nhãn Mức hiểu (`depth_label`) | Khoảng `confidence` $\in [0.0, 1.0]$ | Mở khóa Tiên quyết DAG (`is_mastered_for_dag`) |
| --- | --- | --- | --- | --- | --- |
| **$d = 0$** *(Chưa đạt Tầng 1)* | Trả lời sai 2 lượt liên tiếp ngay tại Tầng 1 | **`0.00`** | `Untested / Below Surface` | `0.50` | `false` |
| **$d = 1$** *(Đạt Tầng 1 — What)* | Đạt MCQ Khái niệm Tầng 1 ($\ge 0.75$), chạm trần tại Tầng 2 | **`0.25`** | `Surface` *(Biết bề mặt)* | `0.65` | `false` |
| **$d = 2$** *(Đạt Tầng 2 — How)* | Đạt bài Cơ chế Tầng 2 ($\ge 0.75$), chạm trần tại Tầng 3 | **`0.50`** | `Applied` *(Biết áp dụng)* | `0.75` | `false` |
| **$d \in \{3, 4\}$** *(Đạt Tầng 3–4)* | Đạt tối thiểu 1 bài thực tế (*Troubleshooting* / *Constraint Shifting* / *Code Sandbox*) với điểm Rubric hoặc Test Cases $\ge 0.75$ | **`0.75`** | `Deep Understanding` *(Hiểu bản chất)* | `0.85` | **`true`** *(Đạt ngưỡng $\ge 0.75$ mở khóa các node phụ thuộc)* |
| **$d = 5$** *(Đạt trọn Tầng 5 — Internals)* | Đạt bài Tầng 4–5 **VÀ** hoàn thành bài thực hành *Code Sandbox* (pass $100\%$ test cases) hoặc bài *Trade-offs/Internals Rubric* $\ge 0.85$ | **`1.00`** | `Mastery` *(Làm chủ hoàn toàn)* | `0.95` | **`true`** |
| **Bỏ dở / Chưa đủ bằng chứng** | Phiên bị ngắt giữa chừng (mới làm $< 2$ bước và chưa chạm *Knowledge Ceiling*) hoặc `confidence < 0.50` | *Giữ nguyên `depth_level_norm` cũ* | `insufficient_evidence` | `< 0.50` | *Giữ nguyên trạng thái cũ (`INV-MASTERY-01`)* |

#### 3. Chấm điểm Đa phương thức (Code Sandbox & LLM Rubric Adapter):
- **Code Sandbox cô lập (`PL3-GRADER-01`):** Chấm các bài `Python`, `SQL`, `JavaScript` bằng bộ unit test cases thật trong container/worker cô lập (`network_mode: none`, `read_only: true`, `timeout <= 3000ms`, `RAM <= 128MB`). Điểm bài code được tính bằng $\text{code\_score} = \frac{\text{passed\_tests}}{\text{total\_tests}} \in [0.0, 1.0]$.
- **Chấm tự luận ngắn theo Rubric & AI Tutor (`PL3-TUTOR-01`):** Mỗi câu hỏi Tầng 3–5 có bảng `GradingRubric` gồm $M$ tiêu chí ($w_j \in (0, 1], \sum_{j=1}^M w_j = 1.0$, kèm danh sách từ khóa/khái niệm bắt buộc và mẫu giải thích). `LLM Adapter` chấm từng tiêu chí $s_j \in \{0.0, 0.5, 1.0\} \Rightarrow \text{rubric\_score} = \sum_{j=1}^M w_j s_j$ và sinh phản hồi **AI Tutor**. Khi offline, timeout ($> 4000\text{ms}$) hoặc lỗi API ngoài, `Circuit Breaker` tự động chuyển sang `DeterministicRubricGrader` (đối sánh tổ hợp từ khóa ngữ nghĩa & cấu trúc câu trả lời theo Rubric) và trả `grader_source = "deterministic_fallback"`.

#### 4. Công thức Đường cong Lãng quên *Ebbinghaus* (`PL3-MEMORY-01`):
- **Khởi tạo độ bền trí nhớ ($S_0$):** Khi học viên lần đầu tiên đạt mức hiểu từ `Applied` trở lên (`depth_level_norm >= 0.50`) tại một khái niệm, hệ thống khởi tạo độ bền trí nhớ **$S_0 = 3.0$ ngày**, ghi nhận `last_practiced_at = now()`, $\Delta t = 0 \Rightarrow R(t) = 1.00$.
- **Suy giảm theo thời gian thực & Tham số kiểm thử (`simulated_time_offset_days`):**
  - Khoảng thời gian trôi qua (tính bằng ngày):
    $$\Delta t = \frac{\text{now}() - \text{last\_practiced\_at}}{86400} + \text{simulated\_time\_offset\_days}$$
    *(trong đó `simulated_time_offset_days >= 0.0` mặc định bằng `0.0`, được phép truyền qua API kiểm thử/Demo ở môi trường `dev`/`test` để kiểm chứng tự động sự suy giảm trí nhớ mà không phải chờ thời gian thực).*
  - Hệ số duy trì trí nhớ tức thời:
    $$R(t) = e^{-\Delta t / S} \in (0.0, 1.0]$$
  - Khi $\text{depth\_level\_norm} \ge 0.50$ và **$R(t) < 0.60$**, cờ `needs_review` bật thành `true` (`1.0`).
- **Công thức cập nhật độ bền $S_{\text{new}}$ sau phiên Ôn tập (`Spaced_Review` hoặc `Deep_Probe`):**
  - **Nếu lượt ôn tập Đạt chuẩn ($\text{score} \ge 0.75$):** Khôi phục tức thời $\Delta t = 0 \Rightarrow R(t) = 1.00$, tắt cờ `needs_review = false`, và tăng độ bền trí nhớ theo công thức có trần:
    $$S_{\text{new}} = \min\left(60.0,\; S_{\text{old}} \times (1.0 + 0.8 \times \text{score})\right)$$
  - **Nếu lượt ôn tập Chưa đạt ($\text{score} < 0.75$):** Bảo lưu nguyên vẹn mức hiểu lịch sử cao nhất `peak_depth_level_norm` (`INV-MASTERY-01`), nhưng giảm nhẹ độ bền trí nhớ (không thấp hơn sàn $1.5$ ngày):
    $$S_{\text{new}} = \max\left(1.5,\; 0.7 \times S_{\text{old}}\right)$$

### 10.4. Bất biến An toàn Mở rộng & Yêu cầu Phi chức năng Đo lường được (`System Invariants & Measurable NFRs v2.0.0`)

- **Bất biến An toàn Mở rộng (`System Invariants v2.0.0`):**
  - `INV-DEPTH-01` (**Tách 3 chiều đánh giá & Tách điểm LLM khỏi Reward trực tiếp**): Không quy đổi trực tiếp 1 tầng câu hỏi đơn lẻ thành mức `Mastery`; không dùng điểm số thô của LLM làm tín hiệu `Reward` trực tiếp cho RL mà chỉ tính trên sự dịch chuyển mức hiểu đã qua kiểm chứng Rubric/Test-case. Khi `confidence < 0.50` hoặc bỏ dở giữa chừng, phiên trả về `insufficient_evidence` và không ghi đè mức hiểu đã xác lập.
  - `INV-SANDBOX-01` (**Cô lập thực thi mã người dùng**): Worker chấm code tuyệt đối không có kết nối mạng ngoài (`network_mode: none`), không mount Docker socket (`docker.sock`), không chạy quyền `root`, giới hạn `RAM <= 128MB` và bắt buộc hủy tiến trình khi vượt quá `3000ms` (`SANDBOX_TIMEOUT`).
  - `INV-ONLINE-RL-01` (**Kiểm duyệt lộ trình tự động & An toàn Online RL**): Mọi đề xuất của `GNN-PPO` phải đi qua `Policy Guardrail` (chặn bài vi phạm tiên quyết DAG, ưu tiên bài có $R(t) < 0.60$ cần ôn tập). Mọi bản cập nhật trọng số từ `Safe Micro-batch Online RL` chỉ tạo ra `candidate_checkpoint` và phải vượt qua `Safety Evaluation Gate` + được `Admin` kích hoạt mới được thay thế mô hình đang phục vụ; hỗ trợ `1-Click Rollback` tức thì.
- **Yêu cầu Phi chức năng Đo lường được Giai đoạn 3 (`Measurable NFRs v2.0.0`):**
  1. **Độ trễ suy luận `GNN-PPO` (`NFR-LATENCY-RL`):** API `POST /api/v2/recommendations` (đọc Graph Observation $N \times 8$ từ Redis + suy luận 3 lớp `GNN-PPO` + `Policy Guardrail`) đạt **$p95 < 250\text{ms}$** trên máy cá nhân chạy Local Docker Compose.
  2. **Giới hạn tài nguyên & Thời gian chạy Code Sandbox (`NFR-SANDBOX-LIMIT`):** Mỗi lượt thực thi mã trong `Isolated Code Sandbox Worker` bị giới hạn cứng **`timeout <= 3000ms`**, **`RAM <= 128MB`**, **`CPU <= 0.5 core`**, **`pids_limit <= 64`**; 100% đoạn mã chứa vòng lặp vô hạn (`while True: pass`) phải bị cắt và trả về mã lỗi `408 SANDBOX_TIMEOUT` trong $\le 3.2\text{s}$.
  3. **Độ trễ đồng bộ sự kiện Liên dịch vụ (`NFR-OUTBOX-LAG`):** Độ trễ từ khi `assessment-grader-service` `COMMIT` bản ghi vào `outbox_events` đến khi được phát lên `Redis Streams` và tiêu thụ bởi `recommendation-ai-service` đạt **$p95 < 500\text{ms}$**.
  4. **Kiểm thử tải cục bộ Cụm 4 Microservices (`NFR-LOAD-20VU`):** Ở `P3-SLICE-4`, bài kiểm thử tải cục bộ mô phỏng **20 người dùng đồng thời (`20 concurrent virtual users`)** thực hiện luồng xem đồ thị đa lĩnh vực, nộp bài đánh giá và xin khuyến nghị `GNN-PPO` liên tục trong 60 giây đạt **tỷ lệ lỗi HTTP $5\text{xx} = 0.0\%$** và độ trễ tổng thể API đọc/khuyến nghị $p95 < 400\text{ms}$.

### 10.5. Bảng Tiêu chí Nghiệm thu Mở rộng (`AC-ID` cho Giai đoạn 3)

| AC-ID | Đầu vào → Hành động → Kết quả mong muốn (kèm nhánh lỗi / kiểm thử âm) | Quyết định nguồn | Lát cắt mục tiêu | Phương thức Kiểm chứng (`Verification Harness`) |
| --- | --- | --- | --- | --- |
| `PL3-KG-01` | Xem/chuyển đổi giữa 3 lĩnh vực (`backend` 12 node, `frontend` 10 node, `devops` 9 node) hoặc `Expert` tạo lĩnh vực mới → hiển thị đúng đồ thị DAG, đồng bộ tức thời năng lực tại các **node giao thoa** (`net-internet`, `os-basics`, `web-http`, `api-rest`, `cache-redis`, `sec-authn`, `sec-api`); từ chối cạnh tạo chu trình với mã `422 DAG_CYCLE_DETECTED` | `D-18` | `P3-SLICE-1` | `pytest tests/test_multi_domain_kg.py` (kiểm tra 3 đồ thị, shared node sync, Kahn cycle detection `422`) + `Vitest` / `Playwright` trên `SCR-09`, `SCR-11`, `SCR-15` |
| `PL3-ASSESS-01` | Học viên làm bài *Adaptive Placement* (tối đa 5–6 câu, trần khởi tạo `0.75` / `confidence = 0.60`) hoặc phiên đào sâu 5 tầng (`5-Depth State Machine`) → mở khóa tuần tự từ Tầng 1–2 lên Tầng 3–5 khi đạt, tự động dừng khi chạm *Knowledge Ceiling* và cập nhật đúng bảng ánh xạ 3 chiều (`Surface` / `Applied` / `Deep` / `Mastery` + `confidence`, hoặc `insufficient_evidence` khi bỏ dở) | `D-16`, `D-19` | `P3-SLICE-1` | `pytest tests/test_depth_state_machine.py` (kiểm tra placement cap `0.75`, step-up/ceiling transition, `insufficient_evidence`) + `Playwright` trên `SCR-10`, `SCR-12` |
| `PL3-GRADER-01` | Học viên nộp bài *Code Review & Refactoring* / *Code Submission* kèm `submission_id` → Worker Sandbox cô lập chấm test cases thật và trả kết quả chuẩn xác; mã có vòng lặp vô hạn, cấp phát quá `128MB` RAM hoặc truy cập mạng/file hệ thống bị chặn an toàn trong $\le 3000\text{ms}$ (`INV-SANDBOX-01`) | `D-19`, `D-22` | `P3-SLICE-1` | `pytest tests/test_code_sandbox_security.py` (happy path pass tests + negative tests: `while True` timeout $\le 3\text{s}$, socket/network block, read-only FS, idempotent `submission_id`) + `SCR-13` |
| `PL3-TUTOR-01` | Học viên nộp câu trả lời tình huống/đánh đổi/giải thích ngược ở Tầng 3–5 → chấm theo Rubric có cấu trúc qua `LLM Adapter` kèm lời giải thích **AI Tutor**; khi tắt kết nối LLM ngoài hoặc timeout, `Circuit Breaker` tự động fallback sang `DeterministicRubricGrader` (`grader_source = "deterministic_fallback"`) mà không lỗi 500 | `D-19`, `D-23` | `P3-SLICE-1` | `pytest tests/test_llm_rubric_adapter.py` (mock LLM success + ngắt mạng kiểm chứng `Circuit Breaker` & `deterministic_fallback`) + `Playwright` trên `SCR-12`, `SCR-14` |
| `PL3-MEMORY-01` | Thời gian trôi qua ($\Delta t > 0$ hoặc qua `simulated_time_offset_days`) làm suy giảm hệ số nhớ $R(t) = e^{-\Delta t / S}$ (với $S_0 = 3.0$ ngày) → node có $R(t) < 0.60$ hiển thị cảnh báo cần ôn tập (`Needs Review`), và sau khi hoàn thành chế độ `Spaced_Review` ($\ge 0.75$) thì $R(t)$ phục hồi về $1.0$ đồng thời tăng độ bền $S_{\text{new}} = \min(60.0, S_{\text{old}}(1 + 0.8 \cdot \text{score}))$ | `D-19`, `D-20` | `P3-SLICE-1` | `pytest tests/test_ebbinghaus_memory.py` (kiểm tra $S_0=3.0$, decay với `simulated_time_offset_days=5`, ngưỡng $R(t)<0.60$, công thức $S_{\text{new}}$ khi pass/fail) + `SCR-11`, `SCR-14` |
| `PL3-RL-01` | Huấn luyện & đánh giá ngoại tuyến trên Simulator đa lĩnh vực (Node Features 8 chiều, Action $(v, m)$) → đối sánh 4 cấp (`Heuristics B1/B2/B3` vs `DQN-MLP` đệm $N_{\max}=16$ vs `PPO-MLP` vs `GNN-PPO` 3 lớp PyTorch Tensor) trên cả Đa lĩnh vực và *Zero-shot Domain Transfer* (`heldout_data_eng_graph` 10 node); xuất đầy đủ gói bằng chứng `SHA-256` | `D-20`, `D-21` | `P3-SLICE-2` | `pytest rl/tests/test_gnn_ppo_multidomain.py` + CLI `python -m plumora_rl.evaluate_phase3 --eval-seed 2026 --episodes 500` kiểm chứng KPI Transfer & `SHA-256` manifest |
| `PL3-GUARD-01` | Xin khuyến nghị bước học tiếp theo `(concept_slug, learning_mode)` từ `GNN-PPO` → `Policy Guardrail` tự động chặn mọi đề xuất sai tiên quyết DAG (`masked_violation_rate == 0.0%`), ưu tiên bài suy giảm nhớ $R(t) < 0.60$ (`Spaced_Review`), báo cáo trung thực `policy_source` (`gnn_ppo`, `gnn_ppo_masked`, `fallback_rule`) với độ trễ $p95 < 250\text{ms}$ | `D-19`, `D-20` | `P3-SLICE-2`, `P3-SLICE-3` | `pytest tests/test_gnn_ppo_guardrail_serving.py` (kiểm tra unmasked vs masked, ưu tiên `Needs Review`, fallback khi hỏng checkpoint, đo $p95 < 250\text{ms}$) + `SCR-11` |
| `PL3-ROLE-01` | Đăng nhập với 3 vai trò (`learner`, `expert`, `admin`) → phân quyền RBAC nghiêm ngặt trên UI và API: `expert` biên soạn KG, câu hỏi 5 tầng/Rubric & bài tập Code Sandbox (`SCR-15..SCR-17`), `admin` giám sát Online RL, duyệt phát hành qua `Safety Gate` hoặc **Rollback 1-Click** checkpoint & giám sát cụm dịch vụ (`SCR-18..SCR-20`); truy cập trái quyền bị chặn `403 Forbidden` | `D-17`, `D-21`, `D-26` | `P3-SLICE-3` | `pytest tests/test_rbac_expert_admin.py` (ma trận quyền 3 vai trò, chống leo thang đặc quyền `403`, kiểm thử `Safety Gate` & `1-Click Rollback`) + `Playwright` trên `SCR-15`..`SCR-20` |
| `PL3-ARCH-01` | Chạy cụm **4 Microservices + API Gateway** thống nhất trên Docker Compose (`docker compose up -d --build` theo `D-27`, kèm thư mục `k8s/` giữ ở mức *Experimental Production Blueprint* ngoài phạm vi nghiệm thu hiện tại) → mỗi service sở hữu Schema PostgreSQL riêng (`auth_svc`, `content_svc`, `assess_svc`, `rec_ai_svc`), đồng bộ sự kiện qua `Transactional Outbox` + `Redis Streams` chống xử lý trùng (`event_id`, $p95 < 500\text{ms}$) và vượt qua bài kiểm thử tải trực tiếp `20 concurrent users` ($5\text{xx} = 0.0\%$) | `D-22`, `D-24`, `D-25`, `D-27`, `D-30` | `P3-SLICE-3`, `P3-SLICE-4`, `REM-02..04` | `pytest tests/test_microservices_outbox_streams.py` + `tests/test_rem02_rem03_microservices_hardening.py` + `scripts/benchmark_p3_slice4.py` (`20 VU` trực tiếp trên cụm Docker Microservices sống) |
