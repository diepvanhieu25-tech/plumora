"""Unit of Work Pattern: Atomic ACID Quiz grading, Idempotency, and Redis Sync (D-06, D-10)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    ConceptModel,
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
from app.modules.assessment.schemas import AnswerItemRequest


@dataclass
class AttemptResultPayload:
    attempt_id: str
    submission_id: str
    idempotent_replay: bool
    correct_count: int
    attempt_score: float
    passed: bool
    mastery_before: float
    mastery_after: float
    state_version: int | None
    newly_unlocked_slugs: list[str] | None


def execute_quiz_attempt_uow(
    db: Session,
    user: UserModel,
    concept: ConceptModel,
    sub_uuid: uuid.UUID,
    answers: list[AnswerItemRequest],
) -> tuple[int, dict[str, Any]]:
    """Execute ACID Unit of Work for Quiz attempt grading and state update."""
    # Lock the user row for ACID serialization (SELECT ... FOR UPDATE) and refresh identity map
    locked_user = db.scalar(select(UserModel).where(UserModel.id == user.id).with_for_update())
    assert locked_user is not None
    db.refresh(locked_user)

    # 1. Idempotency check (INV-IDEMP-01)
    existing_attempt = db.scalar(
        select(QuizAttemptModel).where(
            QuizAttemptModel.user_id == locked_user.id,
            QuizAttemptModel.submission_id == sub_uuid,
        )
    )
    if existing_attempt is not None:
        if existing_attempt.concept_action_id != concept.action_id:
            db.rollback()
            return 409, {
                "error_code": "SUBMISSION_ID_REUSED_DIFFERENT_CONCEPT",
                "message": (
                    f"submission_id '{sub_uuid}' đã được sử dụng cho khái niệm khác "
                    f"(action_id={existing_attempt.concept_action_id}). Vui lòng tạo submission_id mới."
                ),
                "details": {
                    "submission_id": str(sub_uuid),
                    "original_concept_action_id": existing_attempt.concept_action_id,
                    "attempted_concept_action_id": concept.action_id,
                },
            }
        return 200, {
            "attempt_id": str(existing_attempt.id),
            "submission_id": str(existing_attempt.submission_id),
            "idempotent_replay": True,
            "correct_count": existing_attempt.correct_count,
            "attempt_score": existing_attempt.attempt_score,
            "passed": existing_attempt.passed,
            "mastery_before": existing_attempt.mastery_before,
            "mastery_after": existing_attempt.mastery_after,
            "state_version": existing_attempt.state_version,
            "newly_unlocked_slugs": existing_attempt.newly_unlocked_json,
        }

    # 2. Prerequisite lock check (INV-DAG-01)
    missing_prereqs = get_missing_prerequisite_slugs(db, locked_user.id, concept.action_id)
    if missing_prereqs:
        db.rollback()
        return 403, {
            "error_code": "CONCEPT_LOCKED",
            "message": "Khái niệm này chưa mở khóa. Bạn cần đạt tối thiểu 75% ở các bài tiên quyết.",
            "details": {
                "concept_slug": concept.slug,
                "missing_prerequisites": missing_prereqs,
            },
        }

    # 3. Validate 4 answers match the 4 concept questions
    questions = db.scalars(
        select(QuizQuestionModel)
        .where(QuizQuestionModel.concept_action_id == concept.action_id)
        .order_by(QuizQuestionModel.display_order)
        .limit(4)
    ).all()
    question_map = {str(q.id): q for q in questions}

    if len(answers) != 4:
        db.rollback()
        return 422, {
            "error_code": "QUIZ_VALIDATION_ERROR",
            "message": "Bạn bắt buộc phải trả lời đầy đủ 4/4 câu hỏi trước khi nộp bài.",
            "details": {"answered_count": len(answers), "required_count": 4},
        }

    submitted_q_ids = [a.question_id for a in answers]
    if set(submitted_q_ids) != set(question_map.keys()) or len(set(submitted_q_ids)) != 4:
        db.rollback()
        return 422, {
            "error_code": "QUIZ_VALIDATION_ERROR",
            "message": "Danh sách mã câu hỏi nộp lên không khớp với đề kiểm tra của bài học này.",
            "details": {},
        }

    for a in answers:
        if a.selected_option not in {"A", "B", "C", "D"}:
            db.rollback()
            return 422, {
                "error_code": "QUIZ_VALIDATION_ERROR",
                "message": "Phương án lựa chọn chỉ được phép là A, B, C hoặc D.",
                "details": {"invalid_option": a.selected_option},
            }

    # Compute eligible concepts BEFORE mastery update
    _, _, eligible_before = compute_state_from_postgres(db, locked_user.id)

    correct_count = sum(
        1 for a in answers if question_map[a.question_id].correct_option_key == a.selected_option
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
            {"question_id": a.question_id, "selected_option": a.selected_option} for a in answers
        ],
        state_version=locked_user.state_version,
        newly_unlocked_json=newly_unlocked_slugs,
        created_at=now,
    )
    db.add(attempt_record)
    db.commit()
    write_through_state_cache(db, locked_user.id)

    return 200, {
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
    }
