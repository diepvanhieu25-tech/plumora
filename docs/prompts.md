# Các Mẫu Prompt Hay Dùng Cho Plumora

Tổng hợp các mẫu prompt cốt lõi, thường dùng nhất trong quá trình phát triển dự án Plumora. Chạy từ thư mục gốc `/home/diepvanhieu/workspace/plumora`. Thay thế các giá trị trong ngoặc nhọn `<...>` theo nhiệm vụ thực tế.

---

## 1. Khởi động phiên & Làm rõ quyết định (`/plan /grill-me`)

Dùng khi bắt đầu phân tích tính năng mới, kiểm tra ngữ cảnh và phỏng vấn giải quyết các quyết định còn bỏ ngỏ (Gate 1):

```text
/plan /grill-me
Dùng sdlc-plan. Đọc AGENTS.md, .direwolf_memory/ACTIVE_SESSION.md,
docs/intent.md và docs/decisions.md; mở brief gốc khi cần đối chiếu.

Trước tiên báo tên 4 skills Direwolf bạn thấy và tóm tắt ranh giới MVP Pha 1.
Sau đó hỏi từng câu về các quyết định còn mở trong docs/decisions.md, kèm đề xuất và lý do.
Chỉ phân tích và cập nhật tài liệu dự thảo; chưa viết mã ứng dụng khi chưa có phê duyệt.
```

---

## 2. Triển khai tính năng tự chủ theo TDD (`/goal`)

Dùng khi bắt đầu viết code cho một nhiệm vụ đã được phê duyệt tiêu chí nghiệm thu (Gate 2):

```text
/goal
Dùng sdlc-code để thực hiện <TASK-ID> theo tiêu chí <AC-ID> và baseline đã duyệt.
1. Xác minh branch và đảm bảo Docker (PostgreSQL 16 + Redis 7) đang healthy.
2. Viết kiểm thử đỏ (RED behavioral tests) chứng minh tính năng chưa có.
3. Triển khai mã nguồn vừa đủ để đưa test về GREEN; không fake SUT hay giảm assertion.
4. Chạy kiểm tra toàn diện ./scripts/ci_check.sh đạt 100%.
5. Lập hồ sơ bàn giao Gate 2 handoff với bảng mã băm SHA-256 các tệp đã sửa.
```

---

## 3. Đánh giá độc lập 4 trục Gate 3 (`sdlc-review`)

Dùng trong một phiên làm việc mới (cô lập ngữ cảnh) để thẩm định độc lập trước khi merge:

```text
Dùng sdlc-review. Đây là review độc lập trong phiên mới, tuyệt đối không sửa code.
Đọc yêu cầu gốc trong docs/spec.md, hồ sơ handoff gần nhất và git status --short.

Kiểm tra 4 trục:
1. UI/UX: Design System Botanical Sprout, cấm Emoji (INV-UI-01), Auth Route Guard.
2. Code Quality: Phân tầng module, Clean Code, chạy ./scripts/ci_check.sh.
3. Security: JWT, bcrypt, CORS, SQL injection, kiểm tra qua scan_dependencies.
4. Database: ACID Unit of Work, Redis 24 chiều, tính toàn vẹn dữ liệu.
(Nếu có RL: Thẩm tra checkpoint SHA-256, tỷ lệ vi phạm tiên quyết = 0.00% và so sánh Baselines).

Đưa ra kết luận chính thức: APPROVED hoặc REJECTED kèm danh sách findings cụ thể.
```

---

## 4. Đóng gói & Kịch bản chạy thử Demo Gate 4 (`sdlc-release`)

Dùng khi chuẩn bị bàn giao sản phẩm, kiểm tra môi trường production và kịch bản bảo vệ:

```text
/goal
Dùng sdlc-release. Đọc kết luận Gate 3 trong docs/verification/VERIFICATION_GATE3.md.
1. Kiểm tra cấu hình docker-compose.yml khởi chạy đủ 4 containers (postgres, redis, backend, frontend).
2. Soạn/cập nhật kịch bản chạy thử demo 5 phút trong docs/defense/DEMO_RUNBOOK.md.
3. Lập hồ sơ phát hành Gate 4 trong docs/verification/RELEASE_GATE4.md.
4. Chạy ./scripts/ci_check.sh xác nhận toàn bộ hệ thống sẵn sàng bàn giao.
```

---

## 5. Điều tra & Khắc phục lỗi CI nhanh (`/goal`)

Dùng khi `./scripts/ci_check.sh` báo lỗi (Lint, Typecheck, Test, Build):

```text
/goal
Dùng sdlc-code. Script ./scripts/ci_check.sh đang bị lỗi (exit code != 0).
1. Chạy ./scripts/ci_check.sh và phân tích chính xác bước bị gãy (ruff, mypy, pytest, eslint, tsc, vitest).
2. Tìm nguyên nhân gốc rễ (Root Cause) và sửa đổi tối thiểu mã nguồn để khắc phục.
3. Tuyệt đối không tắt test, không bỏ qua typecheck hoặc nới lỏng ràng buộc.
4. Chạy lại ./scripts/ci_check.sh xác nhận toàn bộ pipeline đạt 100% GREEN.
```

---

## 6. Nén ngữ cảnh & Đổi Model / Chuyển giao phiên

Dùng khi phiên chat quá dài (`/compact`) hoặc khi đổi model / chuyển giữa Codex và Antigravity:

```text
/compact
Đọc lại AGENTS.md, .direwolf_memory/ACTIVE_SESSION.md và chạy git status --short.
Tóm tắt ngắn gọn:
1. Gate hiện tại và nhiệm vụ <TASK-ID> đang làm dở.
2. Danh sách các file đang sửa và trạng thái kiểm thử gần nhất.
3. Bước tiếp theo cần làm ngay theo đúng baseline đã duyệt.
Giữ nguyên model và thiết lập hiện tại; không tự ý mở rộng phạm vi.
```
