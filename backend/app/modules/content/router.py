"""FastAPI HTTP endpoints for Content and Roadmap DAG (PL-CONTENT-01, D-05)."""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select

from app.db.models import (
    ConceptModel,
    ConceptPrerequisiteModel,
    DbSession,
    QuizQuestionModel,
    UserConceptMasteryModel,
)
from app.db.redis_store import PASS_THRESHOLD, get_missing_prerequisite_slugs
from app.modules.auth import extract_current_user
from app.modules.content.dag_engine import build_roadmap_payload

router = APIRouter(prefix="/api/v1", tags=["content"])


@router.get("/roadmap")
def get_roadmap(
    request: Request,
    db: DbSession,
) -> JSONResponse:
    """Return 12 Backend DAG nodes, mastery status, and recent history for current_user."""
    user = extract_current_user(request, db)
    if user is None:
        return JSONResponse(
            status_code=401,
            content={
                "error_code": "AUTH_REQUIRED",
                "message": "Vui lòng đăng nhập để xem bản đồ lộ trình học tập.",
                "details": {},
            },
        )
    return JSONResponse(status_code=200, content=build_roadmap_payload(db, user))


@router.get("/concepts/{slug}")
def get_concept_detail(
    slug: str,
    request: Request,
    db: DbSession,
) -> JSONResponse:
    """Return Markdown lesson and 4 MCQ questions (without correct_option_key) if unlocked."""
    user = extract_current_user(request, db)
    if user is None:
        return JSONResponse(
            status_code=401,
            content={
                "error_code": "AUTH_REQUIRED",
                "message": "Vui lòng đăng nhập để xem nội dung bài học.",
                "details": {},
            },
        )

    concept = db.scalar(select(ConceptModel).where(ConceptModel.slug == slug))
    if concept is None:
        return JSONResponse(
            status_code=404,
            content={
                "error_code": "CONCEPT_NOT_FOUND",
                "message": f"Không tìm thấy khái niệm '{slug}'.",
                "details": {"concept_slug": slug},
            },
        )

    missing_prereqs = get_missing_prerequisite_slugs(db, user.id, concept.action_id)
    if missing_prereqs:
        return JSONResponse(
            status_code=403,
            content={
                "error_code": "CONCEPT_LOCKED",
                "message": "Khái niệm này chưa mở khóa. Bạn cần đạt tối thiểu 75% ở các bài tiên quyết.",
                "details": {
                    "concept_slug": slug,
                    "missing_prerequisites": missing_prereqs,
                },
            },
        )

    mastery_row = db.scalar(
        select(UserConceptMasteryModel).where(
            UserConceptMasteryModel.user_id == user.id,
            UserConceptMasteryModel.concept_action_id == concept.action_id,
        )
    )
    score = round(float(mastery_row.mastery_score) if mastery_row else 0.0, 4)
    status = "mastered" if score >= PASS_THRESHOLD else "unlocked"

    prereq_ids = db.scalars(
        select(ConceptPrerequisiteModel.prereq_action_id)
        .where(ConceptPrerequisiteModel.concept_action_id == concept.action_id)
        .order_by(ConceptPrerequisiteModel.prereq_action_id)
    ).all()
    prereq_slugs: list[str] = []
    if prereq_ids:
        prereq_concepts = db.scalars(
            select(ConceptModel)
            .where(ConceptModel.action_id.in_(prereq_ids))
            .order_by(ConceptModel.action_id)
        ).all()
        prereq_slugs = [c.slug for c in prereq_concepts]

    questions = db.scalars(
        select(QuizQuestionModel)
        .where(QuizQuestionModel.concept_action_id == concept.action_id)
        .order_by(QuizQuestionModel.display_order)
        .limit(4)
    ).all()

    return JSONResponse(
        status_code=200,
        content={
            "action_id": concept.action_id,
            "slug": concept.slug,
            "title": concept.title,
            "tier": concept.tier,
            "lesson_markdown": concept.lesson_markdown,
            "mastery_score": score,
            "status": status,
            "prerequisites": prereq_slugs,
            "questions": [
                {
                    "id": str(q.id),
                    "display_order": q.display_order,
                    "prompt": q.prompt,
                    "options": q.options_json,
                }
                for q in questions
            ],
        },
    )
