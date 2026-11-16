"""Idempotent seed loader for 12 Backend concepts, DAG edges, questions, and 3 demo users."""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.models import (
    Base,
    ConceptModel,
    ConceptPrerequisiteModel,
    QuizQuestionModel,
    UserModel,
    engine,
)
from app.modules.auth import (
    DEMO_PASSWORD,
    apply_preset_to_user_in_tx,
    hash_password,
)

SEED_FILE_PATH = Path(__file__).resolve().parents[2] / "seed" / "backend_12_concepts.json"

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
