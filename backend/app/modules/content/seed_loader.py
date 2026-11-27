"""Idempotent database schema initializer and seed loader for Plumora v4.0."""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.migrations import run_database_migrations
from app.db.models import Base, UserModel, engine
from app.modules.auth import DEMO_PASSWORD, hash_password
from app.modules.content.seed_v2_loader import seed_phase3_v2_data

logger = logging.getLogger(__name__)

SEED_USERS: tuple[tuple[str, str, str], ...] = (
    ("learner_new", "Học viên Mới (0/12 Node)", "new_learner"),
    ("learner_foundation", "Học viên Nền tảng (4/12 Node)", "foundation_ready"),
    ("learner_api_stage", "Học viên Tầng API (7/12 Node)", "api_stage_ready"),
)


def init_db_and_seed() -> None:
    """Create PostgreSQL schemas/tables, run migrations 0001..0011, and seed multi-domain curriculum & accounts."""
    Base.metadata.create_all(bind=engine)
    run_database_migrations(engine)

    with Session(engine) as db:
        demo_hash = hash_password(DEMO_PASSWORD)
        for username, display_name, _preset_key in SEED_USERS:
            user = db.scalar(select(UserModel).where(UserModel.username == username))
            if user is None:
                db.add(
                    UserModel(
                        id=uuid.uuid4(),
                        username=username,
                        display_name=display_name,
                        password_hash=demo_hash,
                        role="learner",
                        state_version=1,
                    )
                )
                db.flush()

        for staff_username, staff_display, staff_role in (
            ("expert_demo", "Chuyên gia Nội dung & KG", "expert"),
            ("admin_demo", "Quản trị Hệ thống & Online RL", "admin"),
        ):
            staff = db.scalar(select(UserModel).where(UserModel.username == staff_username))
            if staff is None:
                db.add(
                    UserModel(
                        id=uuid.uuid4(),
                        username=staff_username,
                        display_name=staff_display,
                        password_hash=demo_hash,
                        role=staff_role,
                        state_version=1,
                    )
                )

        db.commit()
        seed_phase3_v2_data(db)
