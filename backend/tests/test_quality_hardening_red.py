"""RED Behavioral Suite for Quality Hardening (F2, F4)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest


def test_f2_quiz_answer_distribution_balanced() -> None:
    """F2: All 88 Tier 1-2 MCQ questions in depth_questions_and_rubrics.json must be balanced across A, B, C, D."""
    seed_path = Path(__file__).resolve().parents[1] / "app" / "seed" / "depth_questions_and_rubrics.json"
    with open(seed_path, encoding="utf-8") as f:
        data = json.load(f)

    mcqs = [q for q in data["questions"] if q["depth_tier"] in (1, 2)]
    keys = [q["correct_option_key"] for q in mcqs]
    assert len(keys) == 88

    # Must NOT be 100% 'A'
    assert keys.count("A") < 88

    # Distribution must be balanced across all 4 keys (<= 35% each)
    for k in ("A", "B", "C", "D"):
        assert 14 <= keys.count(k) <= 30, f"Key {k} has count {keys.count(k)}, not balanced!"

    # In each concept, the 4 MCQ questions (2x Tier 1 + 2x Tier 2) must have >= 2 distinct keys
    by_concept: dict[str, list[str]] = {}
    for q in mcqs:
        by_concept.setdefault(q["concept_slug"], []).append(q["correct_option_key"])
    for slug, concept_keys in by_concept.items():
        assert len(set(concept_keys)) >= 2, (
            f"Concept {slug} does not have at least 2 distinct keys: {concept_keys}"
        )


def test_f3_production_refuses_to_start_without_valid_secret(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """F3/H3: In production, resolve_jwt_secret must refuse to start without a valid secret >= 32 chars."""
    from app.config import resolve_jwt_secret

    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)

    with pytest.raises(RuntimeError, match="JWT_SECRET_KEY must be set in production environment"):
        resolve_jwt_secret()

    # Too short secret in production
    monkeypatch.setenv("JWT_SECRET_KEY", "too_short")
    with pytest.raises(RuntimeError, match="must be at least 32 characters long"):
        resolve_jwt_secret()

    # Valid secret >= 32 chars
    monkeypatch.setenv("JWT_SECRET_KEY", "a" * 32)
    assert resolve_jwt_secret() == "a" * 32


def test_h3_settings_receives_production_from_dotenv_without_os_getenv_app_env(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """H3: When APP_ENV=production is loaded via dotenv file while os.getenv('APP_ENV') is unset,
    resolve_jwt_secret must still strictly enforce production requirements and refuse to start
    without a valid secret >= 32 chars (never silently generate ephemeral dev secret).
    """
    from app.config import Settings, resolve_jwt_secret

    # Clear process env vars
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)

    # Create temporary .env file with APP_ENV=production but NO JWT_SECRET_KEY
    env_file = tmp_path / ".env"
    env_file.write_text("APP_ENV=production\n", encoding="utf-8")

    class DotenvSettings(Settings):
        model_config = Settings.model_config.copy()
        model_config["env_file"] = str(env_file)

    dotenv_settings = DotenvSettings()
    assert dotenv_settings.app_env == "production"

    # Must raise RuntimeError because secret is missing
    with pytest.raises(RuntimeError, match="JWT_SECRET_KEY must be set in production environment"):
        resolve_jwt_secret(dotenv_settings)

    # Now provide too short secret in dotenv
    env_file.write_text("APP_ENV=production\nJWT_SECRET_KEY=too_short\n", encoding="utf-8")
    dotenv_settings_short = DotenvSettings()
    with pytest.raises(RuntimeError, match="must be at least 32 characters long"):
        resolve_jwt_secret(dotenv_settings_short)

    # Valid secret >= 32 chars in dotenv
    valid_secret = "x" * 32
    env_file.write_text(f"APP_ENV=production\nJWT_SECRET_KEY={valid_secret}\n", encoding="utf-8")
    dotenv_settings_valid = DotenvSettings()
    assert resolve_jwt_secret(dotenv_settings_valid) == valid_secret


def test_h3_env_local_overrides_env_base_and_process_env_overrides_all(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """H3: Precedence must strictly be: process environment > .env.local > .env."""
    from pydantic_settings import SettingsConfigDict

    from app.config import Settings

    env_base = tmp_path / ".env"
    env_local = tmp_path / ".env.local"

    env_base.write_text("JWT_SECRET_KEY=from_base_env_file\nAPP_ENV=development\n", encoding="utf-8")
    env_local.write_text("JWT_SECRET_KEY=from_local_env_override\n", encoding="utf-8")

    class PrecedenceSettings(Settings):
        model_config = SettingsConfigDict(
            env_file=(str(env_base), str(env_local)),
            env_file_encoding="utf-8",
            extra="ignore",
        )

    # 1. Without process env: .env.local overrides .env
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    monkeypatch.delenv("APP_ENV", raising=False)
    s1 = PrecedenceSettings()
    assert s1.jwt_secret_key == "from_local_env_override"
    assert s1.app_env == "development"

    # 2. With process env: process env overrides both .env and .env.local
    monkeypatch.setenv("JWT_SECRET_KEY", "from_process_environment")
    s2 = PrecedenceSettings()
    assert s2.jwt_secret_key == "from_process_environment"


def test_h2_schema_migration_upgrade_from_pre_hardening_schema() -> None:
    """H2: Verify versioned schema migrations upgrade an existing pre-hardening schema cleanly.
    Creates pre-hardening tables without columns, applies migrations, and verifies existing
    records retain NULL without fake 1 or fake [] backfills.
    """
    from sqlalchemy import create_engine, text

    from app.db.migrations import run_database_migrations

    # Use an in-memory SQLite engine for fast schema upgrade verification
    test_engine = create_engine("sqlite:///:memory:")
    with test_engine.begin() as conn:
        # Create pre-hardening quiz_attempts table without state_version or newly_unlocked_json
        conn.execute(
            text(
                """
                CREATE TABLE quiz_attempts (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    submission_id TEXT NOT NULL,
                    concept_action_id INTEGER NOT NULL,
                    correct_count INTEGER NOT NULL,
                    attempt_score REAL NOT NULL,
                    passed INTEGER NOT NULL,
                    mastery_before REAL NOT NULL,
                    mastery_after REAL NOT NULL,
                    answers_json TEXT NOT NULL
                );
                """
            )
        )
        # Insert a pre-hardening attempt
        conn.execute(
            text(
                """
                INSERT INTO quiz_attempts (
                    id, user_id, submission_id, concept_action_id,
                    correct_count, attempt_score, passed,
                    mastery_before, mastery_after, answers_json
                ) VALUES (
                    'att-01', 'user-01', 'sub-01', 0,
                    3, 0.75, 1,
                    0.0, 0.75, '[]'
                );
                """
            )
        )

    # Apply migrations
    applied = run_database_migrations(test_engine)
    assert len(applied) >= 2
    assert "0002_add_quiz_attempt_state_version_and_unlocked" in applied

    # Verify legacy quiz_attempts was upgraded through 0002 then cleanly retired by 0011 (D-31)
    from sqlalchemy import inspect

    assert not inspect(test_engine).has_table("quiz_attempts")
    with test_engine.begin() as conn:
        # Verify schema_migrations tracking
        migrations = conn.execute(text("SELECT version FROM schema_migrations ORDER BY version")).fetchall()
        mig_versions = [m[0] for m in migrations]
        assert "0001_initial_schema" in mig_versions
        assert "0002_add_quiz_attempt_state_version_and_unlocked" in mig_versions
        assert any(v.startswith("0011_") for v in mig_versions)


def test_h2_migration_error_raises_and_does_not_swallow() -> None:
    """H2: Migration errors must raise RuntimeError and never be swallowed silently."""
    from unittest.mock import MagicMock

    from sqlalchemy.exc import OperationalError

    from app.db.migrations import run_database_migrations

    bad_engine = MagicMock()
    conn_mock = MagicMock()
    bad_engine.begin.return_value.__enter__.return_value = conn_mock
    # Simulate SQL execution failure during migration
    conn_mock.execute.side_effect = OperationalError(
        "SYNTAX ERROR", params=None, orig=Exception("disk full")
    )

    with pytest.raises(RuntimeError, match="Database migration failed"):
        run_database_migrations(bad_engine)
