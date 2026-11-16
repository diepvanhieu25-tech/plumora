# Antigravity CLI cho Plumora

Ngày đối chiếu: 2026-11-16. CLI trên máy: `1.5.9` (`agy --version`, exit 0). Hướng dẫn này phân biệt **cơ chế Google công bố**, **cấu hình dự án** và **khuyến nghị vận hành của Plumora**. Chỉ version/help được chạy; discovery và thực thi agent chưa được chứng nhận runtime.

## 1. Instructions, rules và skills hoạt động ra sao?

**Google công bố:** rules là chỉ dẫn được nạp vào ngữ cảnh. `AGENTS.md` áp dụng thường trực; file trong `.agents/rules/` cần frontmatter `trigger`. Các trigger gồm `always_on`, `model_decision`, `glob`, `manual`; CLI chưa hỗ trợ rule mentions. [Rules](https://antigravity.google/docs/rules/).

**Plumora:** `AGENTS.md` chứa quy tắc chung. `.agents/rules/rl-evidence.md` dùng `model_decision`, đưa mô tả vào chỉ mục để agent đọc khi phù hợp. Đây là hướng dẫn bằng ngôn ngữ, không phải bộ chặn lệnh.

**Google công bố:** CLI tìm customization từ thư mục chạy lên gốc Git; không quét xuống mọi thư mục con. `.agents/skills/` chứa trực tiếp từng thư mục skill. Có thể dùng discovery manifests cho vị trí khác. [Discovery](https://antigravity.google/docs/customization-discovery/).

**Plumora:** mở CLI tại gốc repo. Bốn skill đặt trực tiếp trong `.agents/skills/`; không cần manifest trỏ ra ngoài máy hoặc bản sao riêng theo công cụ.

**Google công bố:** agent nhìn tên/mô tả skill rồi đọc `SKILL.md` khi nhiệm vụ phù hợp; có thể nhắc tên skill trong prompt. [Agent Skills](https://antigravity.google/docs/skills/).

**Plumora:** dùng `sdlc-plan` cho phân tích/thiết kế, `sdlc-code` cho môi trường/triển khai, `sdlc-review` cho kiểm chứng độc lập, `sdlc-release` cho chuẩn bị bàn giao/phát hành. Bản cài là snapshot Direwolf `40742d2`; không tự cập nhật.

## 2. Chọn chế độ làm việc

```bash
cd /home/diepvanhieu/workspace/plumora
agy --mode=plan
```

**Google công bố:** `plan` thêm chỉ dẫn lập kế hoạch; `accept-edits` tự chấp nhận sửa file workspace; `auto` mở rộng tự động xử lý lệnh theo permissions/sandbox. Dùng `Shift+Tab` hoặc `/config` để xem/chọn chế độ. [Execution modes](https://antigravity.google/docs/cli/modes/).

**Plumora khuyến nghị:** bắt đầu ở plan cho phân tích; chuyển sang thực hiện sau khi phạm vi được duyệt. Chế độ plan không phải sandbox chỉ đọc. Không tự thay model hoặc cấu hình quyền toàn cục.

Google ghi trong [changelog](https://antigravity.google/docs/changelog?tab=cli) rằng từ `1.5.7`, phiên không lưu chế độ bắt đầu bằng Auto khi khả dụng. Trang modes vẫn còn mô tả mặc định cũ. Khi tra cứu, changelog công khai mới nhất là `1.5.8` ngày 2026-11-13; máy trả `1.5.9`, chưa đối chiếu release notes riêng phiên bản này.

## 3. Hỏi rõ trước khi làm

**Google công bố:** `/grill-me` hỏi từng câu và đề xuất đáp án; dùng cùng `/plan` để có kế hoạch chờ xem xét trước khi thay code. [Grill me](https://antigravity.google/docs/commands/grill-me).

**Plumora khuyến nghị:** dùng mẫu đầu tiên trong [prompt](prompts.md). Đọc brief và câu hỏi đã ghi trước; không hỏi lại tên, domain Backend hay DQN vì brief đã có. Chỉ hỏi các quyết định thực sự chưa rõ trong `docs/decisions.md`.

## 4. Làm việc tự chủ có mục tiêu

**Google công bố:** `/goal` can thiệp lúc agent định dừng, nhắc đối chiếu đầu ra/bằng chứng rồi tiếp tục. Không có iteration cap mặc định; permissions và review policy vẫn áp dụng. [Goal](https://antigravity.google/docs/commands/goal).

**Plumora khuyến nghị:** mỗi goal gắn một nhiệm vụ đã duyệt, AC và lệnh kiểm chứng; ghi điều kiện bàn giao BLOCKED khi cần quyết định. Không giao toàn bộ đồ án thành một goal mơ hồ. Báo dừng/hủy goal bằng thông điệp tiếp theo khi cần.

## 5. Prompt và vòng kiểm chứng

**Google công bố:** chia khảo sát → kế hoạch → thực hiện; cung cấp kiểm thử để agent kiểm chứng, và dùng `@` chọn file để làm rõ ngữ cảnh. [Best practices](https://antigravity.google/docs/cli/best-practices/).

**Quy ước Plumora:** prompt nêu mục tiêu, nguồn/phiên bản, phạm vi, AC, quyền thực hiện và bằng chứng bàn giao. Nhắc skill theo nhiệm vụ. Tiêu chí kỹ thuật phải truy về đề tài; báo cáo exit code và kết quả quan sát, không dùng câu “đã xong” thay chứng cứ.

## 6. Lệnh hỗ trợ cần biết

| Lệnh | Tác dụng Google mô tả |
| --- | --- |
| `/help` | Xem lệnh và phím tắt |
| `/diff` | Xem thay đổi |
| `/context`, `/usage` | Xem ngữ cảnh và sử dụng |
| `/resume` | Tiếp tục hội thoại |
| `/permissions` | Xem/chỉnh quyền công cụ |
| `/browser <việc>` | Giao việc duyệt web/kiểm tra giao diện cho browser subagent |
| `agy -p "..."` | Chạy prompt không tương tác |
| `agy --continue` | Tiếp tục hội thoại gần nhất |

Nguồn: [CLI reference](https://antigravity.google/docs/cli/reference/). Các lệnh trong bảng là hướng dẫn tham chiếu; availability/quyền thực tế cần kiểm tra trong phiên hiện tại. `/browser` phục vụ runtime UI khi ứng dụng tồn tại; hiện chưa có app.

Quyền công cụ do hệ thống permissions/sandbox quyết định, độc lập với việc agent đọc bộ luật. [Permissions](https://antigravity.google/docs/permissions/?tab=cli). Repo này không cài allow-all, bypass hoặc thay cấu hình người dùng.

## 7. Khi cần tra cứu hoặc tùy biến

Google cung cấp `/antigravity-guide <câu hỏi>` để đọc hướng dẫn chính thức; `/agy-customizations <yêu cầu>` hỗ trợ rules/skills/hooks/plugins/MCP. [Antigravity Guide](https://antigravity.google/docs/commands/antigravity-guide/).

Ví dụ dùng sau khi mở CLI:

```text
/antigravity-guide Giải thích cách kiểm tra bốn project skills đã được nạp trong phiên này; dẫn nguồn tài liệu hiện tại.
```

## 8. Tính năng nâng cao và phạm vi sử dụng

Google mô tả `/swarm` điều phối worker và verifier qua bảng chung; worker dùng chung workspace mặc định, có tùy chọn working copy riêng. [Swarm](https://antigravity.google/docs/swarm/).

**Quy ước Plumora:** làm tuần tự; chỉ dùng swarm khi chủ dự án giao việc song song. Review độc lập bắt buộc vẫn có thể dùng phiên riêng. Một worker có ngữ cảnh mới chưa bảo đảm cách ly file/dữ liệu hoặc quyền.

Hooks, MCP, plugin, ACP và remote agents là khả năng mở rộng, chưa cài trong bootstrap. Sự xuất hiện trong tài liệu Google không chứng minh tương thích với cấu hình/máy/tài khoản dự án. Không cần chúng để bắt đầu phân tích MVP.

## 9. Kiểm tra sau khi mở phiên mới

1. Xem `/permissions`, chế độ hiện tại và `/help`.
2. Yêu cầu agent báo tên và đường dẫn bốn skills, đọc `sdlc-plan/SKILL.md` cùng một reference của nó.
3. Yêu cầu tóm tắt MVP, các phần ngoài phạm vi và quyết định đang mở từ tài liệu dự án.
4. Đối chiếu output thật, denied actions và thay đổi Git; ghi kết quả vào hồ sơ verification. Nếu bị chặn, ghi BLOCKED; không nới quyền để tạo nhãn pass.

Bước này là kiểm chứng runtime cần làm trong phiên mới; kiểm tra sự tồn tại của file chỉ xác minh bộ khung tĩnh.
