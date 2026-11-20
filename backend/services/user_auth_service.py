"""user-auth-service (Port 8001, schema: auth_svc)."""

from fastapi import FastAPI

from app.modules.auth import router as auth_router

app = FastAPI(title="Plumora user-auth-service", version="2.0.0")
app.include_router(auth_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "user-auth-service", "schema": "auth_svc", "status": "up"}
