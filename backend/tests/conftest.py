"""Pytest isolation fixture: isolate PostgreSQL DB (plumora_test), Redis (/1), and artifacts dir from local demo data."""

from __future__ import annotations

import os
import shutil
from pathlib import Path

import psycopg

_TEST_DB_NAME = os.environ.get("PLUMORA_TEST_DB_NAME", "plumora_test")
_PG_HOST = os.environ.get("PLUMORA_TEST_PG_HOST", "127.0.0.1")
_PG_PORT = os.environ.get("PLUMORA_TEST_PG_PORT", "5432")
_PG_USER = os.environ.get("PLUMORA_TEST_PG_USER", "plumora_app")
_PG_PASS = os.environ.get("PLUMORA_TEST_PG_PASS", "plumora_dev_pass_local_only")

_TEST_DATABASE_URL = (
    f"postgresql+psycopg://{_PG_USER}:{_PG_PASS}@{_PG_HOST}:{_PG_PORT}/{_TEST_DB_NAME}"
)
_TEST_REDIS_URL = os.environ.get("PLUMORA_TEST_REDIS_URL", "redis://127.0.0.1:6379/1")
_TEST_ARTIFACTS_DIR = Path(__file__).resolve().parent / ".artifacts_tmp" / "candidates"


def _ensure_isolated_test_database() -> None:
    """Create isolated plumora_test database if missing; never touch plumora_dev."""
    try:
        with psycopg.connect(
            host=_PG_HOST,
            port=_PG_PORT,
            user=_PG_USER,
            password=_PG_PASS,
            dbname="postgres",
            autocommit=True,
            connect_timeout=2,
        ) as conn:
            cur = conn.execute(
                "SELECT 1 FROM pg_database WHERE datname = %s", (_TEST_DB_NAME,)
            )
            if cur.fetchone() is None:
                conn.execute(f'CREATE DATABASE "{_TEST_DB_NAME}" OWNER "{_PG_USER}"')
    except psycopg.Error:
        pass


_ensure_isolated_test_database()
os.environ["DATABASE_URL"] = _TEST_DATABASE_URL
os.environ["REDIS_URL"] = _TEST_REDIS_URL
os.environ["PLUMORA_CANDIDATES_DIR"] = str(_TEST_ARTIFACTS_DIR)
_TEST_ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)


def pytest_sessionfinish(session: object, exitstatus: int) -> None:
    """Clean temporary test candidate artifacts after test session."""
    shutil.rmtree(_TEST_ARTIFACTS_DIR.parent, ignore_errors=True)
