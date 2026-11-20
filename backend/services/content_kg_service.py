"""content-kg-service (Port 8002, schema: content_svc)."""

from fastapi import FastAPI

from app.modules.content.router_expert import router as expert_v2_router
from app.modules.content.router_v2 import router as content_kg_router

app = FastAPI(title="Plumora content-kg-service", version="2.0.0")
app.include_router(content_kg_router)
app.include_router(expert_v2_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "content-kg-service", "schema": "content_svc", "status": "up"}
