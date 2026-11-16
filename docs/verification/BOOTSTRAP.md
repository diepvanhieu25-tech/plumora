# Kiểm chứng bộ khung Plumora

Ngày: 2026-11-16. Phạm vi BOOT-01: tài liệu, bộ luật và cài skills cục bộ. Chưa có ứng dụng hoặc logic mới; không cần DB/backing service, RED behavioral tests hoặc app build cho chính thay đổi tài liệu này. Day-0 CI và môi trường ứng dụng vẫn là prerequisite trước logic.

## Nguồn và quyền

- Chủ dự án yêu cầu thiết lập bộ khung dựa trên brief trong lượt hiện tại; không cấp quyền commit/push/merge/deploy hay thay đổi global config.
- Tên đề tài/brand đã chốt. Brief là đầu vào phân tích, không thay phê duyệt AC và contracts.
- Direwolf `40742d279ee2c11c1d2d4a586bc84f322e03c83f`; 53 files skills được xuất từ commit, không lấy thay đổi chưa commit. Hash theo file trong `.agents/direwolf-source.json`.
- Brief sao nguyên byte, SHA-256 `08b1b8498fcbc0182b29188abdb03c78f43ec1ebc75089ed644d56d528b5f5d1`.
- Snapshot nguồn phục vụ review: `source-manifest.json`; không chứa chính hồ sơ kiểm chứng, manifest và verdict quản trị. Mọi thay đổi nguồn sau review phải kiểm tra lại.

## Kết quả hiện tại

- `agy --version` và `agy --help`: exit 0, CLI 1.5.9.
- Kiểm tra tĩnh: exit 0; JSON/frontmatter, UTF-8/whitespace của file tự soạn, liên kết nội bộ, đủ bốn skills, hashes và brief nguyên byte đều đạt. Brief và packages gốc giữ nguyên whitespace để bảo toàn nguồn.
- Review độc lập fresh-context: PASS cho BOOT-01 tĩnh trên manifest `67aa48e38b134142769f125a19c2ad664cc88c6920d22ea17ebb3f0fd8276c3d` (71 file nguồn). [Verdict](review-bootstrap.md). Không cấp phê duyệt business baseline hoặc native runtime.
- Direwolf host: `python3 scripts/validate_repo.py` exit 0 và `git diff --check` exit 0; kết quả này không thay kiểm chứng Plumora.
- Kết quả cài đặt/live hash được ghi sau thao tác thực tế bên dưới.
- Native discovery/skills loading của Antigravity và Codex: NOT RUN. Agent turn, UI/browser, training, database, CI từ xa và ứng dụng: NOT RUN hoặc chưa tồn tại.
- Cấu hình không có hooks, bypass, model override, credentials hoặc permission allow-all.

## Bàn giao

Recipient: chủ dự án và phiên phân tích Plumora tiếp theo. Mở repo, đọc `AGENTS.md`/memory rồi dùng `docs/prompts.md`. Tiếp tục phân tích thay vì tự triển khai từ các bản DRAFT.

## Terminal độc lập lưu kèm

Bản sao nguyên văn JSON terminal reviewer, SHA-256 `7ba00d8d4498a2d593c696dbfe9659b43ac3badbeb7cdc413476fe0248c86ad1`; giữ cả exit code ban đầu và phần hiệu chỉnh harness, không sửa nguồn.

```json
[
  {
    "command": "Initial independent artifact-recording wrapper",
    "exit_code": 1,
    "stdout": "AssertionError on git diff --no-index --check exit 1, empty stdout/stderr for a new file; reviewer wrapper incorrectly assumed all new-file diffs return 0. No source change. Wrapper corrected to accept difference exit 1 only with no whitespace diagnostic."
  },
  {
    "command": [
      "python3",
      "/tmp/plumora-workframe-v1/check.py",
      "/tmp/plumora-workframe-v1/tree"
    ],
    "exit_code": 0,
    "stdout": "{\n  \"root\": \"/tmp/plumora-workframe-v1/tree\",\n  \"files\": 73,\n  \"owned_text_checked\": 18,\n  \"imported_files\": 53,\n  \"skills\": [\n    \"sdlc-code\",\n    \"sdlc-plan\",\n    \"sdlc-release\",\n    \"sdlc-review\"\n  ],\n  \"errors\": []\n}\n",
    "stderr": ""
  },
  {
    "command": "Independent Python assertions: exact manifest coverage/hash, no symlinks, complete imported inventory and all bytes against git show accepted commit, license and original brief byte equality",
    "exit_code": 0,
    "stdout": "71 manifest files, 53 imported skill files, license and original brief unchanged"
  },
  {
    "command": [
      "git",
      "diff",
      "--no-index",
      "--check",
      "/dev/null",
      "/tmp/plumora-workframe-v1/tree/.agents/direwolf-source.json"
    ],
    "exit_code": 1,
    "stdout": "",
    "stderr": ""
  },
  {
    "command": [
      "git",
      "diff",
      "--no-index",
      "--check",
      "/dev/null",
      "/tmp/plumora-workframe-v1/tree/.agents/rules/rl-evidence.md"
    ],
    "exit_code": 1,
    "stdout": "",
    "stderr": ""
  },
  {
    "command": [
      "git",
      "diff",
      "--no-index",
      "--check",
      "/dev/null",
      "/tmp/plumora-workframe-v1/tree/.direwolf_memory/ACTIVE_SESSION.md"
    ],
    "exit_code": 1,
    "stdout": "",
    "stderr": ""
  },
  {
    "command": [
      "git",
      "diff",
      "--no-index",
      "--check",
      "/dev/null",
      "/tmp/plumora-workframe-v1/tree/.gitignore"
    ],
    "exit_code": 1,
    "stdout": "",
    "stderr": ""
  },
  {
    "command": [
      "git",
      "diff",
      "--no-index",
      "--check",
      "/dev/null",
      "/tmp/plumora-workframe-v1/tree/AGENTS.md"
    ],
    "exit_code": 1,
    "stdout": "",
    "stderr": ""
  },
  {
    "command": [
      "git",
      "diff",
      "--no-index",
      "--check",
      "/dev/null",
      "/tmp/plumora-workframe-v1/tree/README.md"
    ],
    "exit_code": 1,
    "stdout": "",
    "stderr": ""
  },
  {
    "command": [
      "git",
      "diff",
      "--no-index",
      "--check",
      "/dev/null",
      "/tmp/plumora-workframe-v1/tree/docs/ANTIGRAVITY_GUIDE.md"
    ],
    "exit_code": 1,
    "stdout": "",
    "stderr": ""
  },
  {
    "command": [
      "git",
      "diff",
      "--no-index",
      "--check",
      "/dev/null",
      "/tmp/plumora-workframe-v1/tree/docs/README.md"
    ],
    "exit_code": 1,
    "stdout": "",
    "stderr": ""
  },
  {
    "command": [
      "git",
      "diff",
      "--no-index",
      "--check",
      "/dev/null",
      "/tmp/plumora-workframe-v1/tree/docs/decisions.md"
    ],
    "exit_code": 1,
    "stdout": "",
    "stderr": ""
  },
  {
    "command": [
      "git",
      "diff",
      "--no-index",
      "--check",
      "/dev/null",
      "/tmp/plumora-workframe-v1/tree/docs/design.md"
    ],
    "exit_code": 1,
    "stdout": "",
    "stderr": ""
  },
  {
    "command": [
      "git",
      "diff",
      "--no-index",
      "--check",
      "/dev/null",
      "/tmp/plumora-workframe-v1/tree/docs/engineering/WORKFLOW.md"
    ],
    "exit_code": 1,
    "stdout": "",
    "stderr": ""
  },
  {
    "command": [
      "git",
      "diff",
      "--no-index",
      "--check",
      "/dev/null",
      "/tmp/plumora-workframe-v1/tree/docs/intent.md"
    ],
    "exit_code": 1,
    "stdout": "",
    "stderr": ""
  },
  {
    "command": [
      "git",
      "diff",
      "--no-index",
      "--check",
      "/dev/null",
      "/tmp/plumora-workframe-v1/tree/docs/plan.md"
    ],
    "exit_code": 1,
    "stdout": "",
    "stderr": ""
  },
  {
    "command": [
      "git",
      "diff",
      "--no-index",
      "--check",
      "/dev/null",
      "/tmp/plumora-workframe-v1/tree/docs/prompts.md"
    ],
    "exit_code": 1,
    "stdout": "",
    "stderr": ""
  },
  {
    "command": [
      "git",
      "diff",
      "--no-index",
      "--check",
      "/dev/null",
      "/tmp/plumora-workframe-v1/tree/docs/research/RL_PLAN.md"
    ],
    "exit_code": 1,
    "stdout": "",
    "stderr": ""
  },
  {
    "command": [
      "git",
      "diff",
      "--no-index",
      "--check",
      "/dev/null",
      "/tmp/plumora-workframe-v1/tree/docs/spec.md"
    ],
    "exit_code": 1,
    "stdout": "",
    "stderr": ""
  },
  {
    "command": "Independent whitespace assertions across newly authored source text; git new-file difference exit 1 retained above",
    "exit_code": 0,
    "stdout": "No whitespace diagnostics"
  }
]
```

## Cài đặt và kiểm tra tại repo thật

Đã cài 74 file, giữ nguyên 71 hash nguồn được review. README cũ sao lưu tại `/tmp/plumora-workframe-v1/README.before.md`. Không commit/push/merge, không sửa `.git` hoặc cấu hình toàn cục. Tất cả checks sau đây exit 0; `git diff --check` không bao phủ untracked files nên có kiểm tra tĩnh riêng.

```json
[
  {
    "command": [
      "python3",
      "/tmp/plumora-workframe-v1/check.py",
      "/home/diepvanhieu/workspace/plumora"
    ],
    "exit_code": 0,
    "stdout": "{\n  \"root\": \"/home/diepvanhieu/workspace/plumora\",\n  \"files\": 74,\n  \"owned_text_checked\": 19,\n  \"imported_files\": 53,\n  \"skills\": [\n    \"sdlc-code\",\n    \"sdlc-plan\",\n    \"sdlc-release\",\n    \"sdlc-review\"\n  ],\n  \"errors\": []\n}\n",
    "stderr": ""
  },
  {
    "command": [
      "git",
      "-C",
      "/home/diepvanhieu/workspace/plumora",
      "diff",
      "--check"
    ],
    "exit_code": 0,
    "stdout": "",
    "stderr": ""
  },
  {
    "command": [
      "git",
      "-C",
      "/home/diepvanhieu/workspace/plumora",
      "status",
      "--short"
    ],
    "exit_code": 0,
    "stdout": "?? .agents/\n?? .direwolf_memory/\n?? .gitignore\n?? AGENTS.md\n?? README.md\n?? docs/\n",
    "stderr": ""
  }
]
```
