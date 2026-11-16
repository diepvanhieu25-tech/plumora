# Prompt làm việc cho Plumora

Đây là mẫu giao việc của dự án. Chạy từ gốc repo; nếu đã ở plan mode, có thể bỏ prefix `/plan` lặp. Các file trong mẫu đều đã tồn tại; `<TASK-ID>` và `<AC-ID>` phải thay bằng nhiệm vụ thực đã duyệt.

## 1. Phiên đầu: kiểm tra ngữ cảnh rồi phân tích

```text
/plan /grill-me
Dùng sdlc-plan. Đọc AGENTS.md, .direwolf_memory/ACTIVE_SESSION.md,
docs/intent.md và docs/decisions.md; mở brief gốc khi cần đối chiếu.

Trước tiên báo tên/đường dẫn bốn skills Direwolf bạn thực sự thấy,
đọc entrypoint sdlc-plan và một reference của skill; phân biệt đọc file
với việc runtime đã cung cấp discovery index.

Plumora là đồ án quản lý và khuyến nghị lộ trình học dùng RL.
Brief đã giới hạn Backend, MCQ và DQN; không mở rộng Giai đoạn 2–3.
Hỏi từng câu về các quyết định O-01–08 chưa rõ, kèm đề xuất và lý do.
Từ câu trả lời, cập nhật bản nháp intent/spec/design/plan.

Chỉ phân tích và soạn tài liệu; chưa scaffold hoặc viết mã ứng dụng.
Trình rõ những quyết định cần tôi duyệt và phần việc còn bị chặn.
Không tự đổi model, permissions, hooks hoặc plugin.
```

## 2. Chuyển một phần phân tích thành baseline

```text
Dùng sdlc-plan. Đối chiếu câu trả lời đã xác nhận với brief và sổ quyết định.
Chuẩn bị baseline cho lát cắt đầu tiên: AC, hợp đồng, phạm vi,
thiết kế và kiểm chứng tương ứng; giữ phần chưa có quyết định blocked.
Báo phiên bản/hash tài liệu cần tôi duyệt và tác động tiến độ.
Chưa triển khai source behavior khi baseline chưa được tôi chấp thuận.
```

## 3. Thực hiện sau G1

```text
/goal
Dùng sdlc-code để thực hiện <TASK-ID> theo <AC-ID> và baseline đã duyệt.
Đọc hồ sơ nhiệm vụ để xác minh nguồn, quyền và phạm vi trước khi sửa.
Ghi readiness: branch, Day-0 CI, dịch vụ healthy khi áp dụng và RED tests.
Sau đó triển khai, chạy các kiểm tra đã chốt và ghi handoff đúng snapshot.
Không giảm assertion, giả lập SUT hoặc đổi luật nghiệp vụ để đạt pass.
Nếu thiếu quyết định hoặc bị chặn quyền, bàn giao BLOCKED và câu hỏi cụ thể.
Không tự nhận G3 hoặc commit/push/merge/deploy.
```

## 4. Review trong phiên độc lập

```text
Dùng sdlc-review. Đây là review độc lập, không sửa implementation.
Đọc yêu cầu/thiết kế gốc, phê duyệt và snapshot trong handoff;
không kế thừa kết luận của implementer hoặc transcript triển khai.
Kiểm tra bốn trục UI/UX, chất lượng mã, bảo mật và database;
ghi lý do N/A. Với RL, đối chiếu training/checkpoint/evaluation/serving.
Chạy kiểm tra áp dụng, ghi command/exit code và finding theo mức độ.
Verdict chỉ áp dụng đúng snapshot; không cấp quyền merge hoặc deploy.
```

## 5. Bàn giao Codex ↔ Antigravity

```text
Đọc AGENTS.md và .direwolf_memory/ACTIVE_SESSION.md, kiểm tra Git.
Đối chiếu phiên bản thực tế với handoff; báo drift nếu có.
Tiếp tục nhiệm vụ đang được phép từ bước tiếp theo đã ghi.
Không kế thừa nhãn pass cho phiên bản khác, không tự mở rộng phạm vi.
```

## 6. Khi đổi model (giữa phiên hoặc sang phiên mới)

### 6.1. Đổi model ngay trong cùng phiên hội thoại (qua `/model` hoặc Model Selector)

```text
Tôi vừa chuyển sang model mới trong phiên này.
Giữ nguyên model tôi vừa chọn; không tự đổi lại model, permissions, hooks hoặc plugin.
Kiểm tra lại `git status --short`, đọc `.direwolf_memory/ACTIVE_SESSION.md` và `docs/decisions.md`
để đồng bộ trạng thái file thực tế trên đĩa (phòng trường hợp lượt trước bị ngắt giữa chừng).
Tóm tắt ngắn gọn: (1) Gate và nhiệm vụ `<TASK-ID>` đang chạy, (2) file nào đang sửa dở,
rồi tiếp tục đúng bước đang thực hiện theo skill Direwolf hiện hành mà không làm lệch baseline đã duyệt.
```

### 6.2. Đổi model khi mở phiên mới hoặc sau khi `/compact`

```text
Đọc AGENTS.md, .direwolf_memory/ACTIVE_SESSION.md, docs/decisions.md và docs/plan.md.
Chạy `git status --short` và đối chiếu trạng thái working tree với manifest/handoff gần nhất.
Kế thừa đúng model và cài đặt hiện tại của tôi; không hardcode hay tự chuyển model khác.
Nạp đúng skill Direwolf của pha hiện tại (`sdlc-plan`, `sdlc-code`, `sdlc-review` hoặc `sdlc-release`).
Báo rõ trạng thái Gate (G1–G4), các phần đã duyệt, các phần còn BLOCKED,
và tiếp tục thực hiện `<TASK-ID>` từ đúng bước tiếp theo trong ACTIVE_SESSION.md.
```

Khi kết thúc mỗi mốc, ghi kết quả quan sát, file thay đổi, điều chưa chạy và bước tiếp theo. Prompt là chỉ dẫn thực hiện; không thay quyền công cụ hoặc quyết định phê duyệt.
