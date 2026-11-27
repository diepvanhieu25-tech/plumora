"""Fitness Function 7: Strict Clean Architecture Layer Placement & Alembic Roundtrip."""

from __future__ import annotations

from pathlib import Path

from alembic.config import Config
from sqlalchemy import create_engine, inspect

from alembic import command

BACKEND_ROOT = Path(__file__).resolve().parents[2]
APP_ROOT = BACKEND_ROOT / "app"
BOUNDED_CONTEXTS = {"auth", "content", "assessment", "recommendation"}
ALLOWED_APP_ROOT_FILES = {"__init__.py", "main.py"}
ALLOWED_APP_ROOT_DIRS = {"core", "shared", "db", "middleware", "dependencies", "modules", "seed"}


def test_arch_strict_top_level_and_module_layer_boundaries() -> None:
    """Enforce exact layer directories: core/, shared/, db/, middleware/, dependencies/, modules/."""
    actual_root_files = {p.name for p in APP_ROOT.iterdir() if p.is_file()}
    unexpected_files = actual_root_files - ALLOWED_APP_ROOT_FILES
    assert not unexpected_files, (
        f"Loose files placed directly under backend/app/: {sorted(unexpected_files)}. "
        "Move system-wide config/utilities to app/core/ or cross-domain utilities to app/shared/."
    )

    actual_root_dirs = {
        p.name for p in APP_ROOT.iterdir() if p.is_dir() and p.name != "__pycache__"
    }
    assert actual_root_dirs == ALLOWED_APP_ROOT_DIRS, (
        f"Unexpected backend/app/ top-level dirs: {sorted(actual_root_dirs)} "
        f"(expected {sorted(ALLOWED_APP_ROOT_DIRS)})"
    )

    actual_module_dirs = {
        p.name
        for p in (APP_ROOT / "modules").iterdir()
        if p.is_dir() and p.name != "__pycache__"
    }
    assert actual_module_dirs == BOUNDED_CONTEXTS, (
        f"backend/app/modules/ must contain ONLY bounded contexts {sorted(BOUNDED_CONTEXTS)}, "
        f"found {sorted(actual_module_dirs)}. Shared packages belong in app/shared/."
    )


def test_arch_clean_layers_exist_and_no_duplicated_require_user() -> None:
    """Backend must expose core/, shared/, middleware/, dependencies/, alembic/, and per-context models+repository."""
    for req_path in (
        BACKEND_ROOT / "alembic.ini",
        BACKEND_ROOT / "alembic" / "env.py",
        APP_ROOT / "core" / "config.py",
        APP_ROOT / "core" / "observability.py",
        APP_ROOT / "shared" / "ebbinghaus.py",
        APP_ROOT / "shared" / "contracts" / "ports.py",
        APP_ROOT / "shared" / "contracts" / "adapters.py",
        APP_ROOT / "shared" / "events" / "outbox.py",
        APP_ROOT / "shared" / "events" / "internal_client.py",
        APP_ROOT / "middleware" / "request_id.py",
        APP_ROOT / "middleware" / "exception_handlers.py",
        APP_ROOT / "middleware" / "security_headers.py",
        APP_ROOT / "dependencies" / "auth.py",
        APP_ROOT / "dependencies" / "db.py",
        APP_ROOT / "db" / "base.py",
        APP_ROOT / "db" / "session.py",
    ):
        assert req_path.is_file(), f"Missing required Clean Architecture file: {req_path}"

    for ctx in sorted(BOUNDED_CONTEXTS):
        ctx_dir = APP_ROOT / "modules" / ctx
        assert (ctx_dir / "models.py").is_file(), f"Missing models.py in {ctx}"
        assert (ctx_dir / "repository.py").is_file(), f"Missing repository.py in {ctx}"

    for router_file in (APP_ROOT / "modules").rglob("router*.py"):
        content = router_file.read_text(encoding="utf-8")
        assert "def _require_user(" not in content, (
            f"Duplicated _require_user found in {router_file.relative_to(BACKEND_ROOT)}; "
            "use app.dependencies.CurrentUser instead."
        )


def test_arch_alembic_upgrade_and_downgrade_roundtrip(tmp_path: Path) -> None:
    """Alembic baseline revision must cleanly upgrade to head and downgrade back to base."""
    db_file = tmp_path / "alembic_roundtrip.sqlite3"
    db_url = f"sqlite:///{db_file}"

    cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    cfg.set_main_option("sqlalchemy.url", db_url)

    command.upgrade(cfg, "head")
    eng = create_engine(db_url)
    tables_after_up = set(inspect(eng).get_table_names())
    assert "users" in tables_after_up
    assert "domains" in tables_after_up
    assert "user_node_competency" in tables_after_up
    assert "model_registry" in tables_after_up
    assert "alembic_version" in tables_after_up
    eng.dispose()

    command.downgrade(cfg, "base")
    eng2 = create_engine(db_url)
    tables_after_down = set(inspect(eng2).get_table_names())
    assert "users" not in tables_after_down
    assert "domains" not in tables_after_down
    assert "model_registry" not in tables_after_down
    eng2.dispose()
