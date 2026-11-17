# Hướng dẫn Toàn diện Antigravity CLI và Slash Commands cho Plumora

Tài liệu hướng dẫn chính thức dành cho các thành viên phát triển và tác tử AI (AI Agents) trong dự án **Plumora** (Hệ thống khuyến nghị và quản lý lộ trình học tập thích ứng sử dụng Học tăng cường - Reinforcement Learning).

Phiên bản đối chiếu hệ thống: **Antigravity CLI `1.5.9`** (`agy --version`, exit code `0`).
Nền tảng tri thức: Google Antigravity Documentation (`https://antigravity.google/docs`).

---

## 1. Tổng quan Kiến trúc Tùy biến Antigravity trong Plumora

Hệ sinh thái Google Antigravity cung cấp nền tảng phát triển dựa trên tác tử (Agent-first Development Platform). Để đảm bảo chất lượng kỹ thuật của đồ án tốt nghiệp, Plumora tích hợp bộ quy tắc Direwolf SDLC cùng hệ thống tùy biến đa tầng của Antigravity.

```
                    ┌────────────────────────────────────────────────────────┐
                    │               Antigravity CLI (agy) / IDE              │
                    └───────────────────────────┬────────────────────────────┘
                                                │
         ┌──────────────────────────────────────┼──────────────────────────────────────┐
         ▼                                      ▼                                      ▼
┌──────────────────┐                  ┌──────────────────┐                  ┌──────────────────┐
│   Instructions   │                  │   Agent Skills   │                  │  Slash Commands  │
│     & Rules      │                  │   (.agents/)     │                  │  & Automation    │
│  • AGENTS.md     │                  │  • sdlc-plan     │                  │  • /plan         │
│  • rl-evidence   │                  │  • sdlc-code     │                  │  • /goal         │
│  (Thường trực &  │                  │  • sdlc-review   │                  │  • /grill-me     │
│   Model decision)│                  │  • sdlc-release  │                  │  • /boost, v.v.  │
└──────────────────┘                  └──────────────────┘                  └──────────────────┘
```

### 1.1. Cơ chế Chỉ dẫn (Instructions) và Quy tắc (Rules)
* **Quy tắc thường trực (`always_on`):** Tệp `AGENTS.md` tại thư mục gốc được Antigravity tự động nạp vào mọi lượt hội thoại. Chứa các ranh giới cốt lõi: giới hạn MVP Pha 1, yêu cầu giao tiếp tiếng Việt kèm thuật ngữ tiếng Anh, bảo toàn tính trung thực của RL, và nguyên tắc nghiêm cấm bỏ qua kiểm tra an ninh hoặc giả lập kiểm thử.
* **Quy tắc theo quyết định mô hình (`model_decision`):** Nằm trong `.agents/rules/` (ví dụ: `rl-evidence.md`). Antigravity chỉ nạp phần mô tả vào chỉ mục; khi nhiệm vụ liên quan đến mô phỏng (simulator), huấn luyện DQN, đánh giá hay phục vụ suy luận (serving), tác tử sẽ chủ động đọc toàn văn quy tắc.
* **Khử trùng lặp (Deduplication):** Mọi quy tắc được khử trùng lặp theo đường dẫn tệp tuyệt đối; không bao giờ bị nạp nhiều lần trong cùng một lượt trò chuyện.

### 1.2. Kỹ năng Tác tử (Agent Skills) & Cơ chế Progressive Disclosure
* **Cơ chế công bố tăng dần (Progressive Disclosure):** Các kỹ năng trong `.agents/skills/` không bị nhồi nhét toàn bộ vào cửa sổ ngữ cảnh (context window). Ban đầu, Antigravity chỉ tiêm (inject) tên và phần mô tả tóm tắt (`description` trong `SKILL.md`). Khi nhiệm vụ khớp với mô tả, tác tử mới kích hoạt và đọc các chỉ dẫn chi tiết cùng tài liệu tham chiếu (`references/`).
* **Bốn kỹ năng cốt lõi của Plumora:**
  1. `sdlc-plan`: Phân tích ý định nghiệp vụ, làm rõ quyết định (`/grill-me`), phân rã ca sử dụng, thiết kế hệ thống và lập kế hoạch DAG (Gate 1).
  2. `sdlc-code`: Chuẩn bị môi trường kiểm thử (Docker Compose, Day-0 CI), xây dựng test đỏ (RED tests), lập trình TDD và bàn giao bằng chứng Gate 2.
  3. `sdlc-review`: Đánh giá độc lập 4 trục (UI/UX, Chất lượng mã, Bảo mật, Cơ sở dữ liệu) và thẩm định bằng chứng RL trong phiên cô lập (Gate 3).
  4. `sdlc-release`: Đóng gói phát hành, kiểm tra container hóa Docker, biên soạn kịch bản chạy thử (demo runbook) phục vụ hội đồng bảo vệ (Gate 4).

---

## 2. Cẩm nang Sử dụng Antigravity CLI (`agy`)

Antigravity CLI (`agy`) là giao diện dòng lệnh gọn nhẹ, hiệu năng cao, hỗ trợ làm việc tương tác qua giao diện dòng lệnh đồ họa (TUI) hoặc chạy tự động hóa trong CI/CD.

### 2.1. Cú pháp Cơ bản
```bash
agy [flags] [subcommand] [prompt]
```

### 2.2. Bảng Tham số Toàn diện (CLI Flags)

| Cờ lệnh (Flag) | Kiểu dữ liệu | Ý nghĩa & Hướng dẫn sử dụng trong Plumora |
| :--- | :--- | :--- |
| `--mode` | `plan` \| `accept-edits` \| `auto` | Thiết lập chế độ thực thi của tác tử (xem chi tiết mục 2.4). Mặc định khuyến nghị cho phân tích là `plan`. |
| `--model` | `string` | Chỉ định mô hình AI cho phiên làm việc (ví dụ: `Gemini 3.8 Flash`, `Gemini Pro`). Trong Plumora, mặc định kế thừa mô hình của người dùng. |
| `--effort` | `low` \| `medium` \| `high` \| `xhigh` \| `max` | Điều chỉnh độ sâu suy luận (Reasoning Effort / Chain-of-Thought). Dùng `high`/`max` khi thiết kế thuật toán RL hoặc xử lý race condition. |
| `-c`, `--continue` | `boolean` | Tiếp tục phiên hội thoại gần nhất tại thư mục hiện tại. Giúp giữ mạch công việc khi bị ngắt kết nối. |
| `--conversation` | `string` (UUID) | Khôi phục chính xác một phiên làm việc lịch sử theo Conversation ID (nằm trong thư mục `.gemini/antigravity-cli/brain/<UUID>`). |
| `-p`, `--print`, `--prompt` | `string` | Chế độ chạy 1 lần không tương tác (Print mode). Tác tử thực thi prompt, in kết quả ra màn hình rồi kết thúc. Rất hữu ích cho CI/CD. |
| `-i`, `--prompt-interactive`| `string` | Chạy một prompt khởi đầu ngay khi mở CLI rồi chuyển sang phiên tương tác bình thường. |
| `--print-timeout` | `duration` (VD: `5m`) | Giới hạn thời gian tối đa khi chạy print mode (`-p`). Mặc định `0s` (chờ đến khi hoàn tất). |
| `--output-format` | `text` \| `json` \| `stream-json` | Định dạng đầu ra trong print mode. Dùng `json` hoặc `stream-json` khi tích hợp vào shell script kiểm tra tự động. |
| `--input-format` | `text` \| `stream-json` | Định dạng đầu vào chuẩn cho print mode (hỗ trợ đọc chuỗi sự kiện NDJSON qua pipe). |
| `--json-schema` | `string` (JSON/Path)| Ép buộc đầu ra của tác tử phải tuân thủ nghiêm ngặt một JSON Schema cấu trúc (hữu ích khi xuất báo cáo thẩm định tự động). |
| `--add-dir` | `path` (lặp lại) | Bổ sung thêm thư mục ngoài vào không gian làm việc (workspace). Mặc định Plumora chạy tại gốc repo. |
| `--project` | `string` | Chỉ định Project ID hoặc tên dự án cho phiên làm việc hiện tại. |
| `--new-project` | `boolean` | Tạo một dự án mới hoàn toàn cho phiên làm việc. |
| `--sandbox` | `boolean` | Bật chế độ chạy lệnh trong môi trường hạn chế (restricted terminal sandbox) để ngăn tác tử thực hiện thao tác nguy hiểm. |
| `--dangerously-skip-permissions`| `boolean` | **CẢNH BÁO CAO:** Tự động chấp thuận mọi yêu cầu cấp quyền công cụ mà không hỏi lại người dùng. **Chỉ dùng trong container cô lập hoàn toàn.** |
| `--disable-slash-commands` | `boolean` | Vô hiệu hóa việc mở rộng lệnh gạch chéo (slash command) và kỹ năng trong print mode. |
| `--settings` | `string` (JSON/Path)| Nạp cấu hình tạm thời ghi đè cho riêng phiên hiện tại (không lưu vào `settings.json`). |
| `--log-file` | `path` | Chỉ định đường dẫn tệp ghi log chi tiết của CLI. |
| `--remote-agent` | `boolean` | Thực thi phiên hội thoại qua tác tử đám mây từ xa (Remote Agent). |
| `--remote-control` | `boolean` | Tạo kết nối điều khiển từ xa cho phiên CLI khi khởi động. |

### 2.3. Bảng Lệnh con Hệ thống (Subcommands)

```bash
# Xem danh sách mô hình khả dụng
agy models

# Xem danh sách các tác tử đã đăng ký
agy agents

# Quản lý máy chủ MCP (Model Context Protocol)
agy mcp list
agy mcp add <name> <command> [args...]
agy mcp remove <name>

# Quản lý các Plugin tích hợp
agy plugin list
agy plugin install <plugin-id>
agy plugin enable/disable <plugin-id>

# Xem nhật ký cập nhật chính thức của Antigravity
agy changelog

# Cấu hình biến môi trường và shell completion
agy install

# Nâng cấp Antigravity CLI lên bản mới nhất
agy update
```

### 2.4. Ba Chế độ Thực thi (Execution Modes)
1. **`plan` (Lập kế hoạch & Khảo sát):** Tác tử tập trung vào việc đọc tệp, thu thập thông tin, giải thích, thiết kế kiến trúc và đề xuất giải pháp. Tác tử sẽ hạn chế việc tự ý sửa đổi mã nguồn workspace. Phù hợp cho giai đoạn Gate 1 (`sdlc-plan`).
2. **`accept-edits` (Chấp nhận sửa đổi tệp):** Tác tử được phép tạo mới và chỉnh sửa các tệp trong workspace mà không cần người dùng xác nhận từng thao tác sửa đổi. Phù hợp cho giai đoạn viết mã TDD (`sdlc-code`).
3. **`auto` (Tự động hoàn toàn):** Mở rộng từ `accept-edits`, cho phép tự động chạy các lệnh terminal trong phạm vi chính sách phân quyền (permissions) và sandbox đã định hình. Phù hợp khi chạy tác vụ tự chủ dài hạn (`/goal`).

> [!TIP]
> Bạn có thể nhấn tổ hợp phím **`Shift + Tab`** ngay trong phiên tương tác CLI để chuyển đổi xoay vòng giữa 3 chế độ này bất kỳ lúc nào.

### 2.5. Phím tắt và Thao tác Điều khiển trong CLI TUI
* **`Ctrl + D Ctrl + D`** (hoặc gõ `/exit`, `/quit`): Lưu trạng thái và thoát CLI an toàn.
* **`Ctrl + C`**: Hủy tiến trình hoặc ngắt câu trả lời đang sinh của tác tử.
* **`Shift + Tab`**: Đổi nhanh chế độ thực thi (`plan` $\leftrightarrow$ `accept-edits` $\leftrightarrow$ `auto`).
* **`Phím Mũi tên Lên / Xuống (Up / Down)`**: Duyệt lại lịch sử các câu lệnh và prompt đã gửi.
* **Ký tự `@` (Context Mention):** Mở menu đính kèm ngữ cảnh nhanh (chọn tệp, thư mục, phiên cũ, terminal session).
* **Ký tự `/` (Slash Command Trigger):** Mở menu gợi ý các lệnh workflow gạch chéo.

---

## 3. Danh mục Toàn diện Các Lệnh Slash Command

Slash commands là các phím tắt điều khiển cấp cao trong khung chat Antigravity (cả CLI lẫn IDE / Desktop App), giúp kích hoạt các luồng công việc chuyên biệt hoặc điều phối tác tử phụ.

```
                           HỆ THỐNG SLASH COMMANDS
                                      │
  ┌───────────────────┬───────────────┴───────────────┬───────────────────┐
  ▼                   ▼                               ▼                   ▼
[LẬP KẾ HOẠCH &     [THỰC THI DÀI HẠN &             [QUẢN LÝ NGỮ CẢNH   [TỰ ĐỘNG HÓA &
 PHỎNG VẤN]          TẬP TRUNG CAO]                  & PHIÊN]            CẤU HÌNH]
 • /plan             • /goal                         • /compact          • /schedule
 • /grill-me         • /boost                        • /diff             • /permissions
 • /teamwork         • /browser                      • /context          • /model
 • /swarm                                            • /usage            • /learn
                                                     • /resume           • /config
```

### 3.1. Nhóm Lập kế hoạch & Phỏng vấn Căn chỉnh (Planning & Alignment)

#### `/plan` — Lập Kế hoạch Thực thi Chi tiết
* **Mục đích:** Hướng dẫn tác tử phân tích yêu cầu từng bước, chia nhỏ nhiệm vụ thành Directed Acyclic Graph (DAG), chỉ rõ các tệp cần tạo/sửa và tiêu chí nghiệm thu trước khi đụng vào code.
* **Cách dùng:**
  ```text
  /plan Dùng sdlc-plan để phân tích cấu trúc mô-đun khuyến nghị học tập thích ứng.
  ```
* **Khi nào nên dùng trong Plumora:** Đầu mỗi tính năng hoặc slice mới, trước khi phê duyệt Gate 1.

#### `/grill-me` — Phỏng vấn Làm rõ Quyết định Thiết kế
* **Mục đích:** Tác tử sẽ đóng vai trò chuyên gia phản biện, lần lượt đặt từng câu hỏi có trọng tâm kèm theo các phương án đề xuất và lý do kỹ thuật để người dùng chọn, giúp giải quyết triệt để các quyết định còn bỏ ngỏ (`open decisions`).
* **Cách dùng:**
  ```text
  /plan /grill-me Đọc docs/decisions.md và brief gốc; hỏi tôi về các quyết định O-01 đến O-08 còn tồn đọng.
  ```
* **Quy tắc Plumora:** Không hỏi lại những điều đã được chốt trong `intent.md` (như tên đồ án, domain Backend, thuật toán DQN, cấu trúc MCQ). Chỉ hỏi những hợp đồng kiến trúc chưa rõ ràng.

#### `/boost` — Kích hoạt Chế độ Suy nghĩ Sâu & Kiểm chứng Đa chiều
* **Mục đích:** Dành cho các bài toán phức tạp, đòi hỏi tư duy chiến lược sâu (Deep Thinking), phân tích nhiều góc nhìn và kiểm chứng nghiêm ngặt.
* **Cách dùng:**
  ```text
  /boost Thiết kế thuật toán ánh xạ không gian trạng thái người học 24 chiều sang Q-values đảm bảo không vi phạm tiên quyết DAG.
  ```
* **Khi nào nên dùng trong Plumora:** Xử lý logic RL simulator, thiết kế phần thưởng (reward function), thuật toán Unit of Work chống race condition khi nộp bài thi đồng thời.

---

### 3.2. Nhóm Thực thi Tự chủ & Hợp tác (Autonomous Execution & Multi-Agent)

#### `/goal` — Thực thi Tự chủ Bám sát Mục tiêu
* **Mục đích:** Kích hoạt cơ chế tự chủ dài hạn (Autonomous Loop). Khi tác tử có ý định dừng lại, Antigravity sẽ can thiệp, yêu cầu tác tử tự đối chiếu với lệnh kiểm thử và tiêu chí nghiệm thu (Acceptance Criteria), chạy kiểm tra thực tế và chỉ dừng khi mục tiêu đã đạt trọn vẹn hoặc bị chặn (BLOCKED).
* **Cách dùng:**
  ```text
  /goal Dùng sdlc-code thực hiện tính năng PL-AUTH-01: viết test đỏ, triển khai JWT xác thực và chạy ./scripts/ci_check.sh đạt 100%.
  ```
* **Lưu ý Plumora:** Không giao mục tiêu mơ hồ kiểu "hãy làm xong đồ án". Mỗi goal phải gắn với `<TASK-ID>`, `<AC-ID>` cụ thể và có lệnh kiểm chứng rõ ràng.

#### `/teamwork` — Hợp tác Nhóm Tác tử Tự chủ
* **Mục đích:** Phân bổ khối lượng công việc lớn cho một nhóm các tác tử tự chủ phối hợp thực hiện dưới sự điều phối của tác tử chính.
* **Cách dùng:**
  ```text
  /teamwork Phân bổ rà soát đồng thời tài liệu kỹ thuật giữa backend, frontend và nghiên cứu thực nghiệm RL.
  ```

#### `/swarm` — Điều phối Đàn Tác tử với Bảng Tin Chung
* **Mục đích:** Điều phối các worker và verifier hoạt động song song trên một bảng tin (message board) chung, có thể chia sẻ hoặc tách riêng workspace clone.
* **Quy ước Plumora:** Theo `AGENTS.md`, dự án ưu tiên làm việc tuần tự. Chỉ kích hoạt Swarm khi chủ dự án yêu cầu xử lý song song các tác vụ độc lập. Quá trình Review độc lập (Gate 3) nên dùng phiên cô lập riêng thay vì swarm cùng ngữ cảnh.

#### `/browser` — Tác tử Trình duyệt Tự động hóa
* **Mục đích:** Ủy quyền tác vụ duyệt web, thu thập dữ liệu tra cứu tài liệu thư viện bên ngoài, hoặc tương tác giao diện trực tiếp trên trình duyệt (E2E testing, chụp ảnh màn hình giao diện).
* **Cách dùng:**
  ```text
  /browser Mở http://localhost:5173 và kiểm tra giao diện bản đồ lộ trình SCR-02 xem có bị lỗi vỡ layout không.
  ```

---

### 3.3. Nhóm Quản lý Ngữ cảnh & Lịch sử Phiên (Context & Session Management)

#### `/compact` — Tóm tắt & Nén Cửa sổ Ngữ cảnh
* **Mục đích:** Khi cuộc hội thoại kéo dài (nhiều tệp được đọc, nhiều log test), context window bị đầy dẫn đến suy giảm trí nhớ hoặc tăng độ trễ. Lệnh `/compact` sẽ chắt lọc toàn bộ diễn biến thành bản tóm tắt súc tích, giữ lại các quyết định quan trọng và giải phóng token.
* **Cách dùng:**
  ```text
  /compact Hãy tóm tắt các mốc đã hoàn thành của SLICE-01 và giữ lại thông tin snapshot git hiện tại.
  ```

#### `/diff` — Xem Thay đổi Mã nguồn
* **Mục đích:** Hiển thị nhanh các tệp đã bị sửa đổi trong workspace so với commit Git gần nhất mà không cần mở terminal riêng.

#### `/context` và `/usage` — Kiểm tra Trạng thái Ngữ cảnh & Token
* **`/context`:** Hiển thị danh sách các tệp, rules, skills và tài nguyên đang được nạp trực tiếp trong ngữ cảnh hiện thời.
* **`/usage`:** Báo cáo chi tiết số lượng token đầu vào (prompt tokens), đầu ra (completion tokens) và chi phí ước tính của phiên.

#### `/resume` — Tiếp tục Hội thoại
* **Mục đích:** Mở lại danh sách các phiên làm việc trước đó để lựa chọn tiếp tục làm việc.

---

### 3.4. Nhóm Tự động hóa, Cấu hình & Trợ giúp (Automation, Config & Help)

#### `/schedule` và `/automation` — Lên Lịch Tác vụ & Tự động hóa Chạy ngầm
* **`/schedule`:** Đặt bộ hẹn giờ chạy 1 lần (Timer) hoặc tác vụ lặp lại định kỳ (Cron Expression) gửi thông báo về cho tác tử.
  * Ví dụ: `/schedule Cứ mỗi 30 phút kiểm tra xem container plumora-backend có còn healthy không.`
* **`/automation`:** Mở giao diện tương tác thiết kế kịch bản tự động hóa chạy nền phức tạp.

#### `/permissions` — Xem & Điều chỉnh Phân quyền Công cụ
* **Mục đích:** Hiển thị bảng điều khiển quyền truy cập: quyền đọc/ghi tệp ngoài workspace, quyền chạy lệnh bash, quyền truy cập mạng. Plumora tuân thủ nguyên tắc không tự ý nới quyền (allow-all) trái phép.

#### `/model` — Chuyển đổi Mô hình AI
* **Mục đích:** Chuyển đổi qua lại giữa các mô hình Gemini trong cùng phiên (ví dụ chuyển sang model tư duy mạnh hơn khi gặp bài toán hóc búa).

#### `/learn` — Ghi nhớ Bài học & Chuẩn hóa Hành vi
* **Mục đích:** Kêu gọi tác tử tự đúc kết kinh nghiệm sau khi người dùng sửa lỗi hoặc sau khi cấu hình thành công một quy trình phức tạp, từ đó lưu lại quy tắc hành vi cho các phiên làm việc tương lai.

#### `/antigravity-guide` và `/agy-customizations` — Tra cứu Tài liệu Chính thức
* **`/antigravity-guide <câu hỏi>`:** Tra cứu tài liệu chính thống của Google về Antigravity CLI, IDE, Desktop App, SDK.
* **`/agy-customizations <yêu cầu>`:** Hướng dẫn chuyên sâu về cách viết rules, skills, plugins, hooks và cấu hình máy chủ MCP.

---

## 4. Kịch bản Vận hành Thực tế trong Plumora

### 4.1. Kịch bản 1: Mở Phiên Mới & Kiểm tra Sẵn sàng Runtime
Trước khi bắt đầu làm việc trên một máy mới hoặc phiên mới, lập trình viên nên thực hiện quy trình 4 bước:

```bash
# Bước 1: Di chuyển vào thư mục gốc của dự án Plumora
cd /home/diepvanhieu/workspace/plumora

# Bước 2: Khởi động CLI ở chế độ lập kế hoạch (Plan Mode)
agy --mode=plan
```

Sau khi giao diện CLI xuất hiện, gửi prompt kiểm tra:
```text
/permissions
Chào bạn! Hãy kiểm tra trạng thái git status --short, đọc .direwolf_memory/ACTIVE_SESSION.md,
báo cáo 4 kỹ năng Direwolf (.agents/skills/) bạn tìm thấy và tóm tắt Gate hiện tại của dự án.
```

### 4.2. Kịch bản 2: Thực thi Tính năng Tự chủ Bằng Lệnh `/goal`
Khi một nhiệm vụ đã được phê duyệt Gate 1 (đã có tiêu chí nghiệm thu AC và thiết kế baseline):

```bash
agy --mode=accept-edits
```

Nhập lệnh:
```text
/goal
Dùng sdlc-code để thực hiện nhiệm vụ <TASK-ID> theo tiêu chí <AC-ID>.
Yêu cầu bắt buộc:
1. Xác minh branch hiện tại và trạng thái docker compose (PostgreSQL + Redis healthy).
2. Viết kiểm thử đỏ (RED behavioral tests) chứng minh chức năng chưa tồn tại.
3. Triển khai mã nguồn logic vừa đủ để đưa test về GREEN.
4. Chạy kiểm tra toàn diện ./scripts/ci_check.sh.
5. Lập hồ sơ bàn giao Gate 2 handoff với bảng mã băm SHA-256 các tệp đã sửa.
```

### 4.3. Kịch bản 3: Tích hợp CLI vào Script Tự động hóa CI (Print Mode)
Có thể sử dụng cờ `-p` để chạy các tác vụ thẩm định tự động trong kịch bản shell không cần người can thiệp:

```bash
# Kiểm tra nhanh tài liệu và tính toàn vẹn của dự án
agy -p "Đọc docs/decisions.md và kiểm tra xem có quyết định nào bị xung đột với docs/intent.md không. Báo cáo ngắn gọn."

# Xuất kết quả kiểm tra định dạng JSON cho tool khác đọc
agy -p "Kiểm tra sự tồn tại của checkpoint rl/artifacts/checkpoint.zip và tính mã băm SHA-256." \
    --output-format=json \
    --print-timeout=2m
```

---

## 5. Bảng Tra cứu Nhanh (Cheat Sheet)

| Nhu cầu thao tác | Lệnh khuyến nghị | Chế độ `--mode` |
| :--- | :--- | :--- |
| Làm rõ quyết định chưa chốt từ tài liệu brief | `/plan /grill-me` | `plan` |
| Lập kế hoạch chi tiết cho một User Story / Slice | `/plan` | `plan` |
| Triển khai code tính năng bám sát Acceptance Criteria | `/goal` | `accept-edits` |
| Giải quyết bài toán thuật toán khó / RL phức tạp | `/boost` | `accept-edits` |
| Kiểm tra giao diện người dùng trên trình duyệt | `/browser` | `auto` |
| Tóm tắt giải phóng bộ nhớ khi phiên chat quá dài | `/compact` | Bất kỳ |
| Xem nhanh thay đổi mã nguồn trước khi commit | `/diff` | Bất kỳ |
| Đánh giá độc lập 4 trục (Gate 3 Review) | Mở phiên mới riêng | `plan` |
| Đóng gói release và chạy thử demo bảo vệ (Gate 4) | `/goal` | `accept-edits` |
| Kiểm tra hạn mức token đã tiêu tốn | `/usage` | Bất kỳ |
| Đổi mô hình Gemini trong phiên | `/model` | Bất kỳ |
| Thoát CLI an toàn | `Ctrl+D Ctrl+D` hoặc `/quit` | Bất kỳ |

---

## 6. Nguyên tắc An ninh & Bất biến Vận hành

1. **Tuyệt đối không vượt rào bảo mật:** Không sử dụng cờ `--dangerously-skip-permissions` trên môi trường máy phát triển chính thức; không sửa đổi cấu hình sandbox của Antigravity để vượt quyền truy cập file hệ thống ngoài workspace.
2. **Không giả lập SUT (System Under Test):** Mọi bằng chứng kiểm thử phải đến từ việc chạy thực tế lệnh `./scripts/ci_check.sh` hoặc pytest/vitest với các container Docker thật (`PostgreSQL 16` và `Redis 7` healthy).
3. **Không tự động chuyển model:** Tác tử luôn tuân thủ và kế thừa thiết lập model của lập trình viên, không tự ý can thiệp vào `settings.json` trừ khi có chỉ thị trực tiếp.
4. **Tôn trọng Gate 1:** Khi các tài liệu `spec.md`, `design.md` chưa được chủ dự án phê duyệt (vẫn ở trạng thái DRAFT), tác tử bị chặn (BLOCKED) không được tự ý viết mã nguồn ứng dụng nghiệp vụ.
