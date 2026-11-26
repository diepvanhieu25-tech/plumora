# Plumora Frontend (`v3.1` — Dual-Portal React 19 SPA)

Giao diện người dùng của **Plumora** được xây dựng bằng **React 19 + TypeScript + Vite 6 + Tailwind CSS v4 (`@theme`) + `lucide-react`**, tuân thủ hệ thống thiết kế **Chồi Cây Non (*Botanical Sprout & Sunlit Canopy*)**:
- Bảng màu chuẩn `WCAG 2.1 AA`: Xanh Chồi Rừng `#15803D`, Vàng Nắng Sớm `#D97706`, Xanh Ngọc Lá Mạ `#0D9488`, Xám Đá Ấm `#57534E` trên nền `#F6F8F5`.
- **100% Vector SVG Icons (`lucide-react`)** — không sử dụng ký tự Unicode emoji trên toàn bộ giao diện (`INV-UI-01`).
- Khôi phục phiên mượt mà khi tải lại trang (`F5`) qua trạng thái `isBootstrappingAuth` chống nháy màn hình đăng nhập (*Anti-FOUC*).

---

## 1. Kiến trúc Hai Cổng Độc lập (`Dual-Portal Separation`)

1. **Web Client — Cổng Học viên (`LearnerAppShell`):**
   - `/login`, `/register` (`LearnerAuthPage` — sạch hoàn toàn, không chứa nút điền nhanh hay mật khẩu demo).
   - `/domains` (`MultiDomainHubPage` — `SCR-09`).
   - `/domains/:domain/placement` (`AdaptivePlacementPage` — `SCR-10`).
   - `/domains/:domain/roadmap` (`MultiDomainRoadmapPage` — `SCR-11` kèm Banner khuyến nghị `GNN-PPO` và lịch ôn tập *Ebbinghaus* thực tế `next_review_due_at`).
   - `/domains/:domain/concepts/:slug/playbook` (`LessonPlaybookPage` — hoàn thành lý thuyết 5 phần mở khóa `INV-SEQ-01`).
   - `/domains/:domain/concepts/:slug/depth-probe` (`DepthProbePage` — `SCR-12` + `PlaybookQuickDrawer` + `AiTutorRubricDrawer` `SCR-14`).
   - `/domains/:domain/concepts/:slug/code-sandbox` (`CodeSandboxPage` — `SCR-13` hỗ trợ `Python`, `JavaScript`, `SQL`).
2. **Back-Office Console — Cổng Chuyên gia & Quản trị (`BackOfficeAppShell`):**
   - `/backoffice/login` (`BackOfficeLoginPage` — không có tab đăng ký công khai, từ chối tài khoản `learner` với `403`).
   - `/backoffice/studio/domains`, `/backoffice/studio/questions`, `/backoffice/studio/code-challenges` (`SCR-15`..`SCR-17`: Full CRUD đồ thị DAG, Playbook, câu hỏi 5 tầng + Live Rubric Dry-Run, Code Sandbox + Dual Sandbox Verification).
   - `/backoffice/cohort` (`CohortAnalyticsPage`: Bản đồ nhiệt năng lực 4 bậc, phát hiện tầng nghẽn *Bottleneck Tier* & số lượng suy giảm trí nhớ $R(t) < 60\%$).
   - `/backoffice/mlops/online-rl`, `/backoffice/mlops/model-registry`, `/backoffice/infra/system-health` (`SCR-18`..`SCR-20` dành riêng cho `admin`: Experience Buffer, Policy Inspector + What-If Time Clock, Safety Evaluation Gate, `1-Click Rollback`, giám sát 4 Microservices/4 Schema, Outbox Relay & DLQ).

---

## 2. Đóng gói Container Non-Root Nginx (`frontend/Dockerfile`)

- Container chạy dưới user không đặc quyền `nginx` trên cổng nội bộ `:8080` (ánh xạ ra host `:3000`).
- Cấu hình mẫu đặt tại `/etc/nginx/templates/default.conf.template` với `NGINX_ENVSUBST_FILTER=API_UPSTREAM_URL` (mặc định `API_UPSTREAM_URL=http://api-gateway:8000`), tự động sinh `/etc/nginx/conf.d/default.conf` an toàn ở mọi lần khởi động lại mà không ghi đè file mẫu gốc, đồng thời chặn cứng `/api/v2/internal/*` (`403`) ngay tại biên Nginx.

---

## 3. Lệnh Phát triển & Kiểm thử

```bash
cd frontend

npm ci
npm run lint          # ESLint
npm run typecheck     # TypeScript tsc --noEmit
npm run test:unit     # Vitest unit tests (bao gồm RBAC routing & F5 auth bootstrap)
npm run build         # Production bundle build
```
