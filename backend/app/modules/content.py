"""Idempotent seeding and Content/Roadmap DAG API endpoints (D-05, D-11, PL-CONTENT-01)."""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.models import (
    Base,
    ConceptModel,
    ConceptPrerequisiteModel,
    DbSession,
    QuizAttemptModel,
    QuizQuestionModel,
    RecommendationLogModel,
    UserConceptMasteryModel,
    UserModel,
    engine,
)
from app.db.redis_store import PASS_THRESHOLD, get_missing_prerequisite_slugs
from app.modules.auth import (
    DEMO_PASSWORD,
    apply_preset_to_user_in_tx,
    extract_current_user,
    hash_password,
)

router = APIRouter(prefix="/api/v1", tags=["content"])

SEED_FILE_PATH = Path(__file__).resolve().parents[1] / "seed" / "backend_12_concepts.json"

SEED_USERS: tuple[tuple[str, str, str], ...] = (
    ("learner_new", "Học viên Mới (0/12 Node)", "new_learner"),
    ("learner_foundation", "Học viên Nền tảng (4/12 Node)", "foundation_ready"),
    ("learner_api_stage", "Học viên Tầng API (7/12 Node)", "api_stage_ready"),
)


def init_db_and_seed() -> None:
    """Create PostgreSQL schema if not exists and idempotently seed 12 concepts & 3 demo users."""
    Base.metadata.create_all(bind=engine)
    raw_seed = json.loads(SEED_FILE_PATH.read_text(encoding="utf-8"))
    content_version = str(raw_seed.get("content_version", "1.0.0"))
    concepts_data: list[dict[str, Any]] = raw_seed["concepts"]

    with Session(engine) as db:
        for c_item in concepts_data:
            action_id = int(c_item["action_id"])
            concept = db.get(ConceptModel, action_id)
            if concept is None:
                concept = ConceptModel(
                    action_id=action_id,
                    slug=str(c_item["slug"]),
                    title=str(c_item["title"]),
                    tier=int(c_item["tier"]),
                    lesson_markdown=str(c_item["lesson_markdown"]),
                    content_version=content_version,
                )
                db.add(concept)
            else:
                concept.slug = str(c_item["slug"])
                concept.title = str(c_item["title"])
                concept.tier = int(c_item["tier"])
                concept.lesson_markdown = str(c_item["lesson_markdown"])
                concept.content_version = content_version

        db.flush()

        for c_item in concepts_data:
            action_id = int(c_item["action_id"])
            db.execute(
                delete(ConceptPrerequisiteModel).where(
                    ConceptPrerequisiteModel.concept_action_id == action_id
                )
            )
            for prereq_id in c_item["prerequisites"]:
                db.add(
                    ConceptPrerequisiteModel(
                        concept_action_id=action_id,
                        prereq_action_id=int(prereq_id),
                    )
                )

            for q_item in c_item["questions"]:
                q_id = uuid.UUID(str(q_item["id"]))
                question = db.get(QuizQuestionModel, q_id)
                if question is None:
                    question = QuizQuestionModel(
                        id=q_id,
                        concept_action_id=action_id,
                        display_order=int(q_item["display_order"]),
                        prompt=str(q_item["prompt"]),
                        options_json=dict(q_item["options"]),
                        correct_option_key=str(q_item["correct_option_key"]),
                    )
                    db.add(question)
                else:
                    question.concept_action_id = action_id
                    question.display_order = int(q_item["display_order"])
                    question.prompt = str(q_item["prompt"])
                    question.options_json = dict(q_item["options"])
                    question.correct_option_key = str(q_item["correct_option_key"])

        db.flush()

        demo_hash = hash_password(DEMO_PASSWORD)
        for username, display_name, preset_key in SEED_USERS:
            user = db.scalar(select(UserModel).where(UserModel.username == username))
            if user is None:
                user = UserModel(
                    id=uuid.uuid4(),
                    username=username,
                    display_name=display_name,
                    password_hash=demo_hash,
                    state_version=1,
                )
                db.add(user)
                db.flush()
                apply_preset_to_user_in_tx(db, user, preset_key)

        db.commit()


def build_roadmap_payload(db: Session, user: UserModel) -> dict[str, Any]:
    """Build the 12-node Roadmap DAG payload for the authenticated learner."""
    concepts = db.scalars(select(ConceptModel).order_by(ConceptModel.action_id)).all()
    prereqs = db.scalars(select(ConceptPrerequisiteModel)).all()
    mastery_rows = db.scalars(
        select(UserConceptMasteryModel).where(UserConceptMasteryModel.user_id == user.id)
    ).all()

    slug_by_id = {c.action_id: c.slug for c in concepts}
    prereq_ids_by_id: dict[int, list[int]] = {c.action_id: [] for c in concepts}
    for pr in prereqs:
        prereq_ids_by_id.setdefault(pr.concept_action_id, []).append(pr.prereq_action_id)

    mastery_by_id = {r.concept_action_id: float(r.mastery_score) for r in mastery_rows}

    nodes: list[dict[str, Any]] = []
    mastered_count = 0
    for c in concepts:
        score = round(mastery_by_id.get(c.action_id, 0.0), 4)
        p_ids = sorted(prereq_ids_by_id.get(c.action_id, []))
        p_slugs = [slug_by_id[pid] for pid in p_ids]
        unlocked = all(mastery_by_id.get(pid, 0.0) >= PASS_THRESHOLD for pid in p_ids)
        if score >= PASS_THRESHOLD:
            status = "mastered"
            mastered_count += 1
        elif unlocked:
            status = "unlocked"
        else:
            status = "locked"

        nodes.append(
            {
                "action_id": c.action_id,
                "slug": c.slug,
                "title": c.title,
                "tier": c.tier,
                "prerequisites": p_slugs,
                "mastery_score": score,
                "status": status,
            }
        )

    attempts = db.scalars(
        select(QuizAttemptModel)
        .where(QuizAttemptModel.user_id == user.id)
        .order_by(QuizAttemptModel.created_at.desc())
        .limit(10)
    ).all()
    recent_attempts = [
        {
            "attempt_id": str(a.id),
            "submission_id": str(a.submission_id),
            "concept_action_id": a.concept_action_id,
            "concept_slug": slug_by_id.get(a.concept_action_id, ""),
            "correct_count": a.correct_count,
            "attempt_score": a.attempt_score,
            "passed": a.passed,
            "mastery_before": a.mastery_before,
            "mastery_after": a.mastery_after,
            "created_at": a.created_at.isoformat(),
        }
        for a in attempts
    ]

    rec_logs = db.scalars(
        select(RecommendationLogModel)
        .where(RecommendationLogModel.user_id == user.id)
        .order_by(RecommendationLogModel.created_at.desc())
        .limit(5)
    ).all()
    recent_recommendations = [
        {
            "id": str(r.id),
            "state_version": r.state_version,
            "recommended_action_id": r.recommended_action_id,
            "recommended_slug": (
                slug_by_id.get(r.recommended_action_id, "")
                if r.recommended_action_id is not None
                else None
            ),
            "policy_source": r.policy_source,
            "state_source": r.state_source,
            "guardrail_applied": r.guardrail_applied,
            "checkpoint_sha256": r.checkpoint_sha256,
            "created_at": r.created_at.isoformat(),
        }
        for r in rec_logs
    ]

    return {
        "state_version": user.state_version,
        "mastered_count": mastered_count,
        "total_concepts": len(concepts),
        "nodes": nodes,
        "recent_attempts": recent_attempts,
        "recent_recommendations": recent_recommendations,
    }


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
