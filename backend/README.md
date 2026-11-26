# Plumora Backend (`v3.1` — 4 Microservices + API Gateway)

Hệ thống Backend của **Plumora** được thiết kế theo kiến trúc **Hexagonal Ports & Adapters** (`ContentCatalogPort`, `CompetencyReaderPort`), **3-Phase `SqlAlchemyUnitOfWork`** và triển khai thống nhất trên **4 Microservices cô lập Schema PostgreSQL** đặt sau **API Gateway**.

---

## 1. Kiến trúc Dịch vụ & Quyền Sở hữu Schema (`docker-compose.yml`)

Khi chạy `docker compose up -d --build` ở thư mục gốc, hệ thống tự động chạy `db-migrate-seed` (migrations `0001`..`0010` + idempotent seed) rồi dựng 5 dịch vụ Python chạy dưới quyền non-root (`uid=10001`, cài sẵn Python 3.12 + SQLite3 + Node.js cho Code Sandbox):

| Dịch vụ | Entrypoint | Cổng nội bộ | DB Role & Schema Sở hữu | Trách nhiệm chính |
| :--- | :--- | :---: | :--- | :--- |
| **`api-gateway`** | `services/api_gateway.py` | `:8000` (Host `:8000`) | *(Không kết nối DB)* | Reverse-proxy `/api/v1/auth/*`, `/api/v1/health`, `/api/v2/*`; chặn cứng `/api/v2/internal/*` (`403`); trả `404` cho các route v1 đã gỡ bỏ; giữ nguyên đa header `Set-Cookie`; gắn CORS & Security Headers (CSP nới riêng cho `/docs`). |
| **`user-auth-service`** | `services/user_auth_service.py` | `:8001` | `auth_svc_user` $\rightarrow$ `auth_svc` | Đăng ký, đăng nhập (`Argon2id` + `HttpOnly` Cookie / `HS256 JWT`), thu hồi `jti` trên Redis, phân quyền RBAC 3 vai trò (`learner`, `expert`, `admin`). |
| **`content-kg-service`** | `services/content_kg_service.py` | `:8002` | `content_svc_user` $\rightarrow$ `content_svc` | Đồ thị tri thức đa lĩnh vực (`backend` 12, `frontend` 10, `devops` 9), kiểm tra chu trình DAG (Kahn), Full CRUD Studio (`Playbook`, 110 câu 5 tầng + Rubric, 22 bài Code Sandbox + Dual Sandbox Verification), Cohort Analytics (qua Internal API sang `assessment-grader-service`), phát `DomainGraphUpdatedEvent` (`content_svc.outbox_events`) & đồng bộ epoch `plumora:kg:epoch`. |
| **`assessment-grader-service`** | `services/assessment_grader_service.py` | `:8003` | `assess_svc_user` $\rightarrow$ `assess_svc` | `Adaptive Placement` (trần `0.75`), `Playbook` (`INV-SEQ-01`), `5-Depth Probing State Machine`, `IsolatedSandboxWorkerAdapter` (`Python`/`JS`/`SQL`, `<= 3000ms`, `<= 128MB`, khóa trần `INV-SEQ-02`), `CircuitBreakerRubricService` + Socratic AI Tutor, đường cong nhớ *Ebbinghaus*, xóa cache năng lực tức thời và phát `CompetencyUpdatedEvent` (`assess_svc.outbox_events`). |
| **`recommendation-ai-service`** | `services/recommendation_ai_service.py` | `:8004` | `rec_ai_svc_user` $\rightarrow$ `rec_ai_svc` | Suy luận `NumpyGnnPredictor` (Zero-Torch) + `PolicyGuardrailStrategy` từ Time-Aware Redis Feature Store (`plumora:raw_comp_state:*`), tiêu thụ `Redis Streams` với `consumer_name = {hostname}-{pid}` lũy đẳng (`rec_ai_svc.consumed_events`), `Safe Micro-batch Online RL` (`KL <= 0.02`, `200-ep Safety Gate`), `Policy Inspector`, `1-Click Rollback` (lưu ứng viên trên volume bền vững `plumora_rl_candidates`) & giám sát `System Health` (`pg_catalog`). |

> **Lưu ý về `app/main.py` & Bảng ORM v1 (`Quyết định A, A1`):**
> - `app/main.py` được giữ lại làm **in-process test harness nội bộ** cho bộ kiểm thử đơn vị/hành vi nhanh (`pytest` dùng `TestClient(app)`). Mọi triển khai chạy thật trên Docker sử dụng duy nhất cụm **4 Microservices + API Gateway**.
> - Các code ghi đồng bộ mồ côi của MVP v1 (`redis_store.py`, `_sync_v2_to_mvp_if_backend`, ghi `UserConceptMasteryModel` lúc đăng ký) và các route v1 cũ đã được dọn sạch; chỉ giữ `/api/v1/auth/*` và `/api/v1/health`, đồng thời giữ nguyên định nghĩa bảng ORM cũ trong DB (không chạy `DROP TABLE`) để bảo toàn lịch sử migration.
> - Thư mục `../k8s/` ở gốc repo được duy trì ở mức **Experimental Production Blueprint** (ngoài phạm vi nghiệm thu hiện tại).

---

## 2. Phát triển & Kiểm thử Cục bộ

```bash
cd backend

# Cài đặt môi trường ảo khóa phiên bản bằng uv
uv sync --frozen

# Kiểm tra chất lượng mã nguồn (Ruff) & kiểu tĩnh (Mypy)
uv run ruff check .
uv run mypy app services tests

# Chạy toàn bộ bộ kiểm thử đơn vị, hành vi & 5 Architectural Fitness Functions
uv run pytest
```

---

## 3. Cấu hình Chấm Tự luận LLM Ngoài (Tùy chọn)

`LlmRubricGraderAdapter` và `CircuitBreakerRubricService` trong `app/modules/assessment/rubric_grader.py` hỗ trợ bất kỳ endpoint OpenAI-compatible nào thông qua tệp `.env` ở gốc repo:

- `PLUMORA_LLM_API_URL`: Endpoint Chat Completions (ví dụ `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`).
- `PLUMORA_LLM_API_KEY`: API key cá nhân (nếu để trống, hệ thống tự động chạy `DeterministicRubricGrader` offline không tốn phí).
- `PLUMORA_LLM_MODEL`: Tên model (mặc định Docker Compose là `gemini-3.8-flash`).
- `PLUMORA_LLM_TIMEOUT_S`: Timeout gọi LLM trước khi `CircuitBreaker` chuyển về fallback (mặc định `8.0` giây).
