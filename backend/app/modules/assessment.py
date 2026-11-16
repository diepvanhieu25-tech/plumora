"""Quiz grading, ACID mastery update, Idempotency, and Demo Preset reset (D-06, D-10, D-11)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select

from app.db.models import (
    ConceptModel,
    DbSession,
    QuizAttemptModel,
    QuizQuestionModel,
    UserConceptMasteryModel,
    UserModel,
)
from app.db.redis_store import (
    PASS_THRESHOLD,
    compute_state_from_postgres,
    get_missing_prerequisite_slugs,
    write_through_state_cache,
)
from app.modules.auth import (
    PRESET_MASTERY_MAPS,
    apply_preset_to_user_in_tx,
    extract_current_user,
)
from app.modules.content import build_roadmap_payload

router = APIRouter(prefix="/api/v1", tags=["assessment"])


class AnswerItemRequest(BaseModel):
    """Single question answer choice."""

    question_id: str
    selected_option: str


class SubmitAttemptRequest(BaseModel):
    """Quiz attempt submission payload with mandatory submission_id (D-06, D-10)."""

    submission_id: str
    answers: list[AnswerItemRequest]


class ApplyPresetRequest(BaseModel):
    """Demo preset reset payload (D-05, D-11)."""

    preset_key: str


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

    # Lock the user row for ACID serialization (SELECT ... FOR UPDATE)
    locked_user = db.scalar(
        select(UserModel).where(UserModel.id == user.id).with_for_update()
    )
    assert locked_user is not None

    # 1. Idempotency check (INV-IDEMP-01)
    existing_attempt = db.scalar(
        select(QuizAttemptModel).where(
            QuizAttemptModel.user_id == locked_user.id,
            QuizAttemptModel.submission_id == sub_uuid,
        )
    )
    if existing_attempt is not None:
        return JSONResponse(
            status_code=200,
            content={
                "attempt_id": str(existing_attempt.id),
                "submission_id": str(existing_attempt.submission_id),
                "idempotent_replay": True,
                "correct_count": existing_attempt.correct_count,
                "attempt_score": existing_attempt.attempt_score,
                "passed": existing_attempt.passed,
                "mastery_before": existing_attempt.mastery_before,
                "mastery_after": existing_attempt.mastery_after,
                "state_version": locked_user.state_version,
                "newly_unlocked_slugs": [],
            },
        )

    # 2. Prerequisite lock check (INV-DAG-01)
    missing_prereqs = get_missing_prerequisite_slugs(db, locked_user.id, concept.action_id)
    if missing_prereqs:
        db.rollback()
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

    # 3. Validate 4 answers match the 4 concept questions
    questions = db.scalars(
        select(QuizQuestionModel)
        .where(QuizQuestionModel.concept_action_id == concept.action_id)
        .order_by(QuizQuestionModel.display_order)
        .limit(4)
    ).all()
    question_map = {str(q.id): q for q in questions}

    if len(payload.answers) != 4:
        db.rollback()
        return JSONResponse(
            status_code=422,
            content={
                "error_code": "QUIZ_VALIDATION_ERROR",
                "message": "Bạn bắt buộc phải trả lời đầy đủ 4/4 câu hỏi trước khi nộp bài.",
                "details": {"answered_count": len(payload.answers), "required_count": 4},
            },
        )

    submitted_q_ids = [a.question_id for a in payload.answers]
    if set(submitted_q_ids) != set(question_map.keys()) or len(set(submitted_q_ids)) != 4:
        db.rollback()
        return JSONResponse(
            status_code=422,
            content={
                "error_code": "QUIZ_VALIDATION_ERROR",
                "message": "Danh sách mã câu hỏi nộp lên không khớp với đề kiểm tra của bài học này.",
                "details": {},
            },
        )

    for a in payload.answers:
        if a.selected_option not in {"A", "B", "C", "D"}:
            db.rollback()
            return JSONResponse(
                status_code=422,
                content={
                    "error_code": "QUIZ_VALIDATION_ERROR",
                    "message": "Phương án lựa chọn chỉ được phép là A, B, C hoặc D.",
                    "details": {"invalid_option": a.selected_option},
                },
            )

    # Compute eligible concepts BEFORE mastery update
    _, _, eligible_before = compute_state_from_postgres(db, locked_user.id)

    correct_count = sum(
        1
        for a in payload.answers
        if question_map[a.question_id].correct_option_key == a.selected_option
    )
    attempt_score = round(float(correct_count) / 4.0, 4)
    passed = attempt_score >= PASS_THRESHOLD

    mastery_row = db.scalar(
        select(UserConceptMasteryModel)
        .where(
            UserConceptMasteryModel.user_id == locked_user.id,
            UserConceptMasteryModel.concept_action_id == concept.action_id,
        )
        .with_for_update()
    )
    mastery_before = round(float(mastery_row.mastery_score) if mastery_row else 0.0, 4)
    mastery_after = max(mastery_before, attempt_score)

    now = datetime.now(UTC)
    if mastery_row is None:
        mastery_row = UserConceptMasteryModel(
            user_id=locked_user.id,
            concept_action_id=concept.action_id,
            mastery_score=mastery_after,
            is_mastered=(mastery_after >= PASS_THRESHOLD),
            updated_at=now,
        )
        db.add(mastery_row)
    else:
        mastery_row.mastery_score = mastery_after
        mastery_row.is_mastered = mastery_after >= PASS_THRESHOLD
        mastery_row.updated_at = now

    attempt_record = QuizAttemptModel(
        id=uuid.uuid4(),
        user_id=locked_user.id,
        submission_id=sub_uuid,
        concept_action_id=concept.action_id,
        correct_count=correct_count,
        attempt_score=attempt_score,
        passed=passed,
        mastery_before=mastery_before,
        mastery_after=mastery_after,
        answers_json=[
            {"question_id": a.question_id, "selected_option": a.selected_option}
            for a in payload.answers
        ],
        created_at=now,
    )
    db.add(attempt_record)
    locked_user.state_version += 1
    db.flush()

    _, _, eligible_after = compute_state_from_postgres(db, locked_user.id)
    newly_unlocked_ids = [
        i for i in range(12) if eligible_after[i] > 0.5 and eligible_before[i] < 0.5
    ]
    newly_unlocked_slugs: list[str] = []
    if newly_unlocked_ids:
        unlocked_concepts = db.scalars(
            select(ConceptModel)
            .where(ConceptModel.action_id.in_(newly_unlocked_ids))
            .order_by(ConceptModel.action_id)
        ).all()
        newly_unlocked_slugs = [c.slug for c in unlocked_concepts]

    db.commit()
    write_through_state_cache(db, locked_user.id)

    return JSONResponse(
        status_code=200,
        content={
            "attempt_id": str(attempt_record.id),
            "submission_id": str(attempt_record.submission_id),
            "idempotent_replay": False,
            "correct_count": correct_count,
            "attempt_score": attempt_score,
            "passed": passed,
            "mastery_before": mastery_before,
            "mastery_after": mastery_after,
            "state_version": locked_user.state_version,
            "newly_unlocked_slugs": newly_unlocked_slugs,
        },
    )


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

    if payload.preset_key not in PRESET_MASTERY_MAPS:
        return JSONResponse(
            status_code=422,
            content={
                "error_code": "PRESET_INVALID",
                "message": f"Mã preset '{payload.preset_key}' không hợp lệ.",
                "details": {"valid_presets": list(PRESET_MASTERY_MAPS.keys())},
            },
        )

    locked_user = db.scalar(
        select(UserModel).where(UserModel.id == user.id).with_for_update()
    )
    assert locked_user is not None

    apply_preset_to_user_in_tx(db, locked_user, payload.preset_key)
    locked_user.state_version += 1
    db.commit()
    db.refresh(locked_user)
    write_through_state_cache(db, locked_user.id)

    roadmap_data: dict[str, Any] = build_roadmap_payload(db, locked_user)
    roadmap_data["preset_key"] = payload.preset_key
    return JSONResponse(status_code=200, content=roadmap_data)
