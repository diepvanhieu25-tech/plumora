"""assessment-grader-service (Port 8003, schema: assess_svc)."""

from fastapi import FastAPI

from app.modules.assessment.router_v2 import router as assessment_v2_router

app = FastAPI(title="Plumora assessment-grader-service", version="2.0.0")
app.include_router(assessment_v2_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "assessment-grader-service", "schema": "assess_svc", "status": "up"}
