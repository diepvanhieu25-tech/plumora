"""FastAPI HTTP endpoints for Quiz Grading and Demo Preset reset (PL-QUIZ-01, PL-PROGRESS-01)."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select

from app.config import settings
from app.db.models import ConceptModel, DbSession, QuizAttemptModel, UserModel
from app.db.redis_store import write_through_state_cache
from app.modules.assessment.schemas import ApplyPresetRequest, SubmitAttemptRequest
from app.modules.assessment.unit_of_work import execute_quiz_attempt_uow
from app.modules.auth import (
    PRESET_MASTERY_MAPS,
    apply_preset_to_user_in_tx,
    extract_current_user,
)
from app.modules.content import build_roadmap_payload

router = APIRouter(prefix="/api/v1", tags=["assessment"])


@router.post("/concepts/{slug}/attempts")
def submit_quiz_attempt(
    slug: str,
    payload: SubmitAttemptRequest,
    request: Request,
    db: DbSession,
) -> JSONResponse:
    """Grade 4-question single-choice MCQ inside an ACID transaction with Idempotency & Redis sync."""
    user = extract_current_user(request, db)
    if user is None:
        return JSONResponse(
            status_code=401,
            content={
                "error_code": "AUTH_REQUIRED",
                "message": "Vui lòng đăng nhập để nộp bài kiểm tra.",
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

    try:
        sub_uuid = uuid.UUID(payload.submission_id)
    except ValueError:
        return JSONResponse(
            status_code=422,
            content={
                "error_code": "QUIZ_VALIDATION_ERROR",
                "message": "Mã lượt nộp (submission_id) phải là UUID hợp lệ.",
                "details": {"submission_id": payload.submission_id},
            },
        )

    status_code, result = execute_quiz_attempt_uow(
        db=db,
        user=user,
        concept=concept,
        sub_uuid=sub_uuid,
        answers=payload.answers,
    )
    return JSONResponse(status_code=status_code, content=result)


@router.post("/me/preset")
def apply_demo_preset(
    payload: ApplyPresetRequest,
    request: Request,
    db: DbSession,
) -> JSONResponse:
    """Reset the authenticated learner's 12-concept mastery to a Demo Preset inside an ACID tx."""
    user = extract_current_user(request, db)
    if user is None:
        return JSONResponse(
            status_code=401,
            content={
                "error_code": "AUTH_REQUIRED",
                "message": "Vui lòng đăng nhập để áp dụng Hồ sơ mẫu (Demo Preset).",
                "details": {},
            },
        )

    if not settings.enable_dev_presets:
        return JSONResponse(
            status_code=403,
            content={
                "error_code": "DEV_PRESETS_DISABLED",
                "message": "Tính năng Hồ sơ mẫu (Demo Preset) đã bị tắt trên máy chủ.",
                "details": {},
            },
        )

    if payload.preset_key not in PRESET_MASTERY_MAPS:
        return JSONResponse(
            status_code=422,
            content={
                "error_code": "PRESET_INVALID",
                "message": f"Mã preset '{payload.preset_key}' không hợp lệ.",
                "details": {"valid_presets": list(PRESET_MASTERY_MAPS.keys())},
            },
        )

    locked_user = db.scalar(select(UserModel).where(UserModel.id == user.id).with_for_update())
    assert locked_user is not None
    db.refresh(locked_user)

    apply_preset_to_user_in_tx(db, locked_user, payload.preset_key)
    locked_user.state_version += 1
    db.commit()
    db.refresh(locked_user)
    write_through_state_cache(db, locked_user.id)

    roadmap_data: dict[str, Any] = build_roadmap_payload(db, locked_user)
    roadmap_data["preset_key"] = payload.preset_key
    return JSONResponse(status_code=200, content=roadmap_data)


@router.get("/me/attempts")
@router.get("/assessment/history")
def get_learner_attempts_history(
    request: Request,
    db: DbSession,
    limit: int = 50,
) -> JSONResponse:
    """Return the authenticated learner's quiz attempt history (REAL-05)."""
    user = extract_current_user(request, db)
    if user is None:
        return JSONResponse(
            status_code=401,
            content={
                "error_code": "AUTH_REQUIRED",
                "message": "Vui lòng đăng nhập để xem lịch sử làm bài.",
                "details": {},
            },
        )

    stmt = (
        select(
            QuizAttemptModel,
            ConceptModel.slug,
            ConceptModel.title,
            ConceptModel.tier,
        )
        .join(ConceptModel, ConceptModel.action_id == QuizAttemptModel.concept_action_id)
        .where(QuizAttemptModel.user_id == user.id)
        .order_by(QuizAttemptModel.created_at.desc())
        .limit(min(max(limit, 1), 100))
    )
    rows = db.execute(stmt).all()

    history = [
        {
            "attempt_id": str(attempt.id),
            "submission_id": str(attempt.submission_id),
            "concept_slug": slug,
            "concept_title": title,
            "tier": tier,
            "correct_count": attempt.correct_count,
            "attempt_score": attempt.attempt_score,
            "passed": attempt.passed,
            "mastery_before": attempt.mastery_before,
            "mastery_after": attempt.mastery_after,
            "newly_unlocked_slugs": attempt.newly_unlocked_json or [],
            "state_version": attempt.state_version,
            "created_at": attempt.created_at.isoformat(),
        }
        for attempt, slug, title, tier in rows
    ]

    return JSONResponse(
        status_code=200,
        content={"attempts": history, "total_count": len(history)},
    )
