"""Fitness Function 1: Bounded Context AST Import Boundaries & Zero Dual-Mode Spaghetti."""

from __future__ import annotations

import ast
from pathlib import Path

MODULES_ROOT = Path(__file__).resolve().parents[2] / "app" / "modules"
BOUNDED_CONTEXTS = ("auth", "content", "assessment", "recommendation")

# Explicit allowlist for narrow, approved cross-context utility/router delegation
# (e.g. auth/security.py authentication dependency, content/sandbox verification port,
#  and assessment/router_v2.py mounting the v2 recommendation endpoint in monolith mode).
ALLOWED_CROSS_IMPORTS: set[tuple[str, str]] = {
    ("content", "app.modules.auth"),
    ("content", "app.modules.auth.security"),
    ("content", "app.modules.auth.rbac"),
    ("assessment", "app.modules.auth"),
    ("assessment", "app.modules.auth.security"),
    ("recommendation", "app.modules.auth.security"),
    ("recommendation", "app.modules.auth.rbac"),
    ("content", "app.modules.assessment.sandbox_worker"),
    ("content", "app.modules.assessment.rubric_grader"),
    ("content", "app.modules.assessment.ebbinghaus"),
    ("content", "app.modules.assessment.depth_state_machine"),
    ("assessment", "app.modules.content.kg_service"),
    ("assessment", "app.modules.recommendation.service_v2"),
    ("recommendation", "app.modules.assessment.schemas_v2"),
    ("recommendation", "app.modules.content.schemas_v2"),
    ("recommendation", "app.modules.content.kg_service"),
}


def _collect_imported_modules(py_file: Path) -> list[str]:
    tree = ast.parse(py_file.read_text(encoding="utf-8"), filename=str(py_file))
    imported: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            imported.append(node.module)
        elif isinstance(node, ast.Import):
            for alias in node.names:
                imported.append(alias.name)
    return imported


def test_arch_no_forbidden_cross_context_service_or_model_imports() -> None:
    """Bounded contexts must not import sibling module models or business services outside allowlist."""
    violations: list[str] = []
    for ctx in BOUNDED_CONTEXTS:
        ctx_dir = MODULES_ROOT / ctx
        assert ctx_dir.is_dir(), f"Missing bounded context directory: {ctx_dir}"
        for py_file in sorted(ctx_dir.glob("*.py")):
            for mod in _collect_imported_modules(py_file):
                for other in BOUNDED_CONTEXTS:
                    if other == ctx:
                        continue
                    prefix = f"app.modules.{other}"
                    if (mod == prefix or mod.startswith(f"{prefix}.")) and (
                        ctx,
                        mod,
                    ) not in ALLOWED_CROSS_IMPORTS:
                        violations.append(f"{ctx}/{py_file.name} -> {mod}")
    assert not violations, f"Forbidden cross-context imports detected: {violations}"


def test_arch_zero_dual_mode_service_url_spaghetti_in_business_services() -> None:
    """Core business services must use Hexagonal Ports, never `if content_service_url()` / `assessment_service_url()`."""
    target_files = [
        MODULES_ROOT / "content" / "kg_service.py",
        MODULES_ROOT / "assessment" / "service_v2.py",
        MODULES_ROOT / "recommendation" / "service_v2.py",
    ]
    forbidden_calls = {"content_service_url", "assessment_service_url"}
    violations: list[str] = []

    for py_file in target_files:
        assert py_file.is_file(), f"Missing service file: {py_file}"
        tree = ast.parse(py_file.read_text(encoding="utf-8"), filename=str(py_file))
        for node in ast.walk(tree):
            if (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Name)
                and node.func.id in forbidden_calls
            ):
                violations.append(f"{py_file.name}:{node.lineno} calls {node.func.id}()")
    assert not violations, f"Dual-mode conditional spaghetti found: {violations}"
