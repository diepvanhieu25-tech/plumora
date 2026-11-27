"""Data access repository for the Auth bounded context (schema: auth_svc)."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.auth.models import UserModel


class UserRepository:
    """SQLAlchemy repository for auth_svc.users."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, user_id: uuid.UUID) -> UserModel | None:
        return self.db.get(UserModel, user_id)

    def get_by_username(self, username: str) -> UserModel | None:
        return self.db.scalar(select(UserModel).where(UserModel.username == username))

    def create(
        self,
        *,
        username: str,
        display_name: str,
        password_hash: str,
        role: str = "learner",
    ) -> UserModel:
        user = UserModel(
            id=uuid.uuid4(),
            username=username,
            display_name=display_name,
            password_hash=password_hash,
            role=role,
            state_version=1,
        )
        self.db.add(user)
        return user
