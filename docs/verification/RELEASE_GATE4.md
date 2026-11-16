# Release Dossier: Gate 4 Deployment & Operations (`sdlc-release` — `DEFENSE-01`)

> **Sản phẩm:** Plumora — Hệ thống Quản lý và Khuyến nghị Lộ trình Học Cá nhân hóa ứng dụng Mô hình Học Tăng cường  
> **Phiên bản Phát hành:** `v1.0.0-mvp` (Thao diễn Bảo vệ Đồ án Tốt nghiệp)  
> **Ngày phát hành:** 2026-11-16  
> **Quyết định căn cứ:** `D-01`–`D-15` ([docs/decisions.md](../decisions.md))  
> **Hồ sơ nghiệm thu Gate 3:** [docs/verification/VERIFICATION_GATE3.md](VERIFICATION_GATE3.md) (`APPROVED`)

---

## 1. Thông Tin Phát Hành & Danh Mục Ảnh Container (`Packaging Manifest`)

Hệ thống được đóng gói hoàn chỉnh bằng Docker Compose, sẵn sàng khởi chạy trên mọi máy tính cục bộ hỗ trợ Docker Engine mà không cần cài đặt Python, Node.js hay GPU.

| Dịch Vụ (`Service`) | Container Name | Base Image & Tag | Cổng Nội Bộ / Cổng Ngoại Vi | Mục Đích Hoạt Động & Bảo Mật |
| --- | --- | --- | --- | --- |
| **`postgres`** | `plumora-demo-postgres` | `postgres:16-alpine` | `5432:5432` | Nguồn chân lý duy nhất (SSoT), lưu 7 bảng dữ liệu, ACID Locking `SELECT ... FOR UPDATE`, volume bền vững `plumora_demo_pgdata`. |
| **`redis`** | `plumora-demo-redis` | `redis:7-alpine` | `6379:6379` | Bộ nhớ đệm trạng thái học viên 24 chiều (`TTL = 3600s`), volume `plumora_demo_redisdata`. |
| **`backend`** | `plumora-demo-backend` | `python:3.12-slim-bookworm` (Multi-stage) | `8000:8000` | FastAPI Modular Monolith, nạp Checkpoint DQN bằng `SafeTorchUnpickler`, suy luận MLP thuần NumPy, non-root user `plumora:plumora` (UID 10001). |
| **`frontend`** | `plumora-demo-frontend` | `nginx:1.27-alpine` (Multi-stage) | `80:3000` | Nginx Alpine phục vụ React SPA bundle (269 kB gzip 81 kB), reverse proxy `/api/` về Backend, gzip compression, SPA fallback. |

---

## 2. Bảng Mã Băm Bất Biến Của Các Thành Phần Cốt Lõi (`Immutable Artifacts`)

| Đường Dẫn Thành Phần | Loại Tệp | Mã Băm `SHA-256` | Trạng Thái Kiểm Định |
| --- | --- | --- | --- |
| `rl/artifacts/checkpoint.zip` | Checkpoint DQN (Seed 303) | `e464fa638cee04fda6a386ffb6cdf24d9190d0f1167feb56d4da0063499a6b6b` | Khớp 100% `manifest.json` |
| `rl/artifacts/manifest.json` | Metadata Checkpoint | `dfa34eb4dc5ae8a6c2617d9406556dc5b6c029631bcc11ae90d7e47717b6177d` | Khớp 100% |
| `rl/artifacts/evaluation_report.json` | Báo cáo 500 Episodes | `c9b384187f858c6708a5ea1ad99ef7bc6a31b1c1f77f385ebdb02dbf3cd67c45` | Khớp 100% |
| `backend/app/seed/backend_12_concepts.json` | 12 Khái niệm & 48 MCQ | `0b819196e3a9411917167f452f28fa8647d5367b0949a0c1ecfe9348a7f7d358` | Khớp 100% |
| `docker-compose.demo.yml` | Cấu hình Compose Demo | *Được sinh tự động* | Đã kiểm định cú pháp hợp lệ |
| `backend/Dockerfile` | Multi-stage non-root Backend | *Được sinh tự động* | Build thành công |
| `frontend/Dockerfile` | Multi-stage Nginx Frontend | *Được sinh tự động* | Build thành công |

---

## 3. Quy Trình Vận Hành & Hướng Dẫn Khởi Chạy Nhanh (`Operation Runbook`)

### 3.1. Khởi chạy toàn bộ hệ thống
```bash
docker compose -f docker-compose.demo.yml up --build -d
```

### 3.2. Kiểm tra sức khỏe các dịch vụ (Three-Barrier Health Check)
1. **Kiểm tra trạng thái container:**
   ```bash
   docker compose -f docker-compose.demo.yml ps
   # Cả 4 container phải ở trạng thái Up (healthy)
   ```
2. **Kiểm tra Backend Probe:**
   ```bash
   curl -s http://127.0.0.1:8000/api/v1/health | jq .
   # Kết quả mong đợi: {"status": "ok", "postgres": "up", "redis": "up", "rl_checkpoint": {"loaded": true, "sha256_verified": true}}
   ```
3. **Kiểm tra Frontend:**
   ```bash
   curl -s -I http://127.0.0.1:3000 | grep "HTTP/1.1 200 OK"
   ```

### 3.3. Dừng và dọn dẹp hệ thống
```bash
# Dừng các container (giữ nguyên dữ liệu)
docker compose -f docker-compose.demo.yml stop

# Dừng và xóa toàn bộ container cùng volumes dữ liệu demo (khôi phục trạng thái trắng ban đầu)
docker compose -f docker-compose.demo.yml down -v
```

---

## 4. Giám Sát Hoạt Động & Cơ Chế Chịu Lỗi (Observability & Fallback Telemetry)

1. **Xem nhật ký hoạt động thời gian thực:**
   ```bash
   docker compose -f docker-compose.demo.yml logs -f backend
   ```
2. **Cơ chế tự động giáng cấp (Graceful Fallback):**
   - Khi Redis dừng: Backend tự động ghi nhận cảnh báo và chuyển cờ `state_source: postgres_fallback`. Hệ thống web duy trì hoạt động 100% bình thường.
   - Khi Checkpoint bị thiếu hoặc sai mã băm: Backend tự động chuyển sang quy tắc `policy_source: fallback_rule` (`degraded: true`) để khuyến nghị bài học theo luật chuyên gia hợp lệ, tuyệt đối không gán nhãn giả mạo `dqn`.

---

## 5. Kết Luận Bàn Giao Gate 4

Phiên bản `v1.0.0-mvp` của dự án Plumora đã sẵn sàng 100% về mặt đóng gói, tài liệu, kịch bản thao diễn và độ tin cậy vận hành. Sản phẩm sẵn sàng cho buổi bảo vệ đồ án tốt nghiệp với Hội đồng.
