# Plumora Backend (Clean Architecture — 4 Microservices + API Gateway)

## Cấu trúc thư mục chuẩn (Directory Map)

Mọi tệp trong `backend/` tuân thủ phân tầng cố định và **được kiểm tra tự động trong CI** bởi `tests/architecture/test_arch_clean_layers.py` và `test_arch_code_size_guard.py` (không cho phép đặt tệp rời ở `app/` hay gói tiện ích chung trong `app/modules/`):

```text
backend/
├── alembic.ini                       # Cấu hình Alembic Migrations
├── alembic/
│   ├── env.py                        # Kết nối Base.metadata + app.core.config.settings
│   └── versions/                     # Migration có phiên bản hỗ trợ upgrade() & downgrade()
├── app/
│   ├── main.py                       # In-process FastAPI harness cho pytest
│   ├── core/                         # Cấu hình và thành phần dùng chung toàn hệ thống (config.py, observability.py)
│   ├── shared/                       # Tiện ích & hợp đồng dùng chung giữa các domain (contracts/, events/, ebbinghaus.py)
│   ├── db/                           # Hạ tầng CSDL (base.py, session.py, models.py registry, migrations.py, redis_pool.py, uow.py)
│   ├── middleware/                   # HTTP middleware & global handlers (request_id.py, exception_handlers.py, security_headers.py)
│   ├── dependencies/                 # FastAPI Depends dùng chung (auth.py: CurrentUser/require_roles/require_internal_service, db.py: DbSession)
│   ├── seed/                         # Bộ dữ liệu JSON học liệu đa ngành
│   └── modules/                      # CHỈ chứa 4 Bounded Contexts nghiệp vụ:
│       ├── auth/                     # models.py, repository.py, schemas.py, security.py, service.py, router.py
│       ├── content/                  # models.py, repository.py, schemas_v2.py, expert_schemas.py, kg_service.py, router_v2.py, router_expert.py, services/{domain_graph,question_studio,challenge_and_cohort}.py
│       ├── assessment/               # models.py, repository.py, schemas_v2.py, router_v2.py, services/{competency_helpers,placement,depth_probe,code_sandbox}.py
│       └── recommendation/           # models.py, repository.py, admin_schemas.py, router_v2.py, router_admin.py, services/{feature_store,model_registry,online_rl,online_rl_eval,online_rl_inspect,system_health}.py
└── services/                         # 4 microservice entrypoints + api_gateway.py + _runtime.py
```

## Lệnh thường dùng

```bash
# Chạy kiểm tra Lint + SAST (Ruff), Type Check (Mypy strict) và toàn bộ Tests
uv run ruff check .
uv run mypy app services tests
uv run pytest

# Quản lý DB Migration bằng Alembic
uv run alembic upgrade head
uv run alembic downgrade base
```
