"""user-auth-service (Port 8001, schema: auth_svc)."""

from fastapi import FastAPI

from app.modules.auth.router import router as auth_router
from services._runtime import register_common_middleware_and_handlers, register_health_routes

app = FastAPI(title="Plumora user-auth-service", version="2.0.0")
register_common_middleware_and_handlers(app, service_name="user-auth-service")
register_health_routes(app, service_name="user-auth-service", schema_name="auth_svc")
app.include_router(auth_router)
