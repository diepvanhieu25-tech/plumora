"""Fitness Function 6: Prevent God-File Growth in Backend Modules & Services (M-01)."""

from __future__ import annotations

from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
SCAN_DIRS = (
    BACKEND_ROOT / "app" / "core",
    BACKEND_ROOT / "app" / "shared",
    BACKEND_ROOT / "app" / "middleware",
    BACKEND_ROOT / "app" / "dependencies",
    BACKEND_ROOT / "app" / "modules",
    BACKEND_ROOT / "services",
)
MAX_LINES_PER_FILE = 550


def test_arch_backend_modules_respect_size_budget() -> None:
    """Every backend module/service file must stay strictly <= MAX_LINES_PER_FILE (zero allowlist)."""
    violations: list[str] = []
    for base_dir in SCAN_DIRS:
        for py_file in sorted(base_dir.rglob("*.py")):
            rel = py_file.relative_to(BACKEND_ROOT).as_posix()
            line_count = len(py_file.read_text(encoding="utf-8").splitlines())
            if line_count > MAX_LINES_PER_FILE:
                violations.append(f"{rel}: {line_count} lines (limit {MAX_LINES_PER_FILE})")
    assert not violations, f"Backend file size budget exceeded: {violations}"
