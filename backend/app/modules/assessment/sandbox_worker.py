"""Isolated Code Sandbox Worker for Python, SQL, and JavaScript (PL3-GRADER-01, INV-SANDBOX-01)."""

from __future__ import annotations

import ast
import json
import re
import resource
import shutil
import subprocess
import sys
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

MAX_SANDBOX_TIMEOUT_MS: int = 3000
MAX_SANDBOX_MEMORY_MB: int = 128

FORBIDDEN_MODULES = {
    "socket",
    "urllib",
    "requests",
    "httpx",
    "http",
    "subprocess",
    "os",
    "sys",
    "ctypes",
    "importlib",
    "pathlib",
    "shutil",
    "multiprocessing",
    "threading",
    "pty",
    "fcntl",
    "builtins",
    "inspect",
    "gc",
    "signal",
    "resource",
}

FORBIDDEN_BUILTINS = {
    "open",
    "eval",
    "exec",
    "__import__",
    "compile",
    "breakpoint",
    "getattr",
    "setattr",
    "delattr",
    "globals",
    "locals",
    "vars",
    "dir",
    "type",
    "object",
    "input",
    "memoryview",
}

SAFE_PYTHON_BUILTIN_NAMES: tuple[str, ...] = (
    "abs",
    "all",
    "any",
    "bool",
    "dict",
    "enumerate",
    "filter",
    "float",
    "int",
    "len",
    "list",
    "map",
    "max",
    "min",
    "range",
    "reversed",
    "round",
    "set",
    "sorted",
    "str",
    "sum",
    "tuple",
    "zip",
    "ValueError",
    "TypeError",
    "KeyError",
    "IndexError",
    "ZeroDivisionError",
    "Exception",
)

_FORBIDDEN_JS_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("require", re.compile(r"\brequire\b")),
    ("import", re.compile(r"\bimport\b")),
    ("process", re.compile(r"\bprocess\b")),
    ("fs", re.compile(r"\bfs\b")),
    ("fetch", re.compile(r"\bfetch\s*\(")),
    ("child_process", re.compile(r"child_process")),
    ("globalThis", re.compile(r"\bglobalThis\b")),
    ("global", re.compile(r"\bglobal\b")),
    ("constructor", re.compile(r"\bconstructor\b")),
    ("__proto__", re.compile(r"__proto__")),
    ("prototype", re.compile(r"\bprototype\b")),
    ("Reflect", re.compile(r"\bReflect\b")),
    ("Proxy", re.compile(r"\bProxy\b")),
    ("Function", re.compile(r"\bFunction\s*\(")),
    ("eval", re.compile(r"\beval\s*\(")),
)


class SandboxTimeoutError(TimeoutError):
    """Raised when user code exceeds 3000ms timeout (408 SANDBOX_TIMEOUT)."""

    def __init__(self, timeout_ms: int) -> None:
        self.error_code = "SANDBOX_TIMEOUT"
        super().__init__(f"Code execution exceeded {timeout_ms}ms limit.")


class SandboxSecurityError(ValueError):
    """Raised when user code attempts forbidden network/filesystem/process access (422)."""

    def __init__(self, reason: str) -> None:
        self.error_code = "SANDBOX_SECURITY_VIOLATION"
        super().__init__(reason)


@dataclass(frozen=True)
class SandboxExecutionResult:
    """Result of executing user code against test cases in an isolated worker."""

    passed_tests: int
    total_tests: int
    code_score: float
    runtime_ms: int
    memory_kb: int
    test_results: list[dict[str, Any]]


class CodeSandboxPort(ABC):
    """Abstract port for isolated code execution."""

    @abstractmethod
    def execute(
        self,
        language: str,
        source_code: str,
        test_cases: list[dict[str, Any]],
        timeout_ms: int = MAX_SANDBOX_TIMEOUT_MS,
        memory_limit_mb: int = MAX_SANDBOX_MEMORY_MB,
    ) -> SandboxExecutionResult:
        """Execute source_code against test_cases safely."""


def _validate_python_ast(source_code: str) -> None:
    try:
        tree = ast.parse(source_code)
    except SyntaxError as exc:
        raise SandboxSecurityError(f"Syntax error in Python code: {exc}") from exc

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                root_mod = alias.name.split(".")[0]
                raise SandboxSecurityError(
                    f"Forbidden module import blocked by Sandbox: '{root_mod}'"
                )
        elif isinstance(node, ast.ImportFrom):
            root_mod = (node.module or "").split(".")[0] or "relative"
            raise SandboxSecurityError(
                f"Forbidden module import blocked by Sandbox: '{root_mod}'"
            )
        elif isinstance(node, ast.Attribute):
            if node.attr.startswith("__"):
                raise SandboxSecurityError(
                    f"Forbidden dunder attribute access blocked by Sandbox: '{node.attr}'"
                )
            if node.attr in ("format", "format_map"):
                raise SandboxSecurityError(
                    f"Forbidden string format attribute blocked by Sandbox: '{node.attr}'"
                )
        elif isinstance(node, ast.Name):
            if node.id.startswith("__"):
                raise SandboxSecurityError(
                    f"Forbidden dunder name access blocked by Sandbox: '{node.id}'"
                )
            if node.id in FORBIDDEN_BUILTINS:
                raise SandboxSecurityError(
                    f"Forbidden builtin access blocked by Sandbox: '{node.id}'"
                )


def _apply_posix_rlimits(memory_limit_mb: int, *, apply_as_limit: bool = True) -> None:
    """Apply strict CPU, memory (<= 128MB), and file descriptor limits in child process."""
    mem_bytes = min(memory_limit_mb, MAX_SANDBOX_MEMORY_MB) * 1024 * 1024
    if apply_as_limit:
        try:
            resource.setrlimit(resource.RLIMIT_AS, (mem_bytes, mem_bytes))
        except (OSError, ValueError):
            pass
    try:
        resource.setrlimit(resource.RLIMIT_CPU, (4, 4))
    except (OSError, ValueError):
        pass
    try:
        resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))
    except (OSError, ValueError):
        pass


class IsolatedSandboxWorkerAdapter(CodeSandboxPort):
    """Subprocess-isolated sandbox worker with strict timeout <= 3000ms and no network."""

    def execute(
        self,
        language: str,
        source_code: str,
        test_cases: list[dict[str, Any]],
        timeout_ms: int = MAX_SANDBOX_TIMEOUT_MS,
        memory_limit_mb: int = MAX_SANDBOX_MEMORY_MB,
    ) -> SandboxExecutionResult:
        lang = language.lower().strip()
        effective_timeout_ms = min(max(100, timeout_ms), MAX_SANDBOX_TIMEOUT_MS)

        if lang == "python":
            return self._run_python(source_code, test_cases, effective_timeout_ms, memory_limit_mb)
        if lang == "sql":
            return self._run_sql(source_code, test_cases, effective_timeout_ms, memory_limit_mb)
        if lang == "javascript":
            return self._run_javascript(
                source_code, test_cases, effective_timeout_ms, memory_limit_mb
            )
        raise SandboxSecurityError(f"Unsupported sandbox language: {language}")

    def _run_python(
        self,
        source_code: str,
        test_cases: list[dict[str, Any]],
        timeout_ms: int,
        memory_limit_mb: int,
    ) -> SandboxExecutionResult:
        _validate_python_ast(source_code)

        allowed_names_json = json.dumps(list(SAFE_PYTHON_BUILTIN_NAMES))
        harness = (
            "import builtins as _b, json as _j\n"
            f"_allowed = _j.loads({allowed_names_json!r})\n"
            "safe_builtins = {name: getattr(_b, name) for name in _allowed if hasattr(_b, name)}\n"
            "user_ns = {'__builtins__': safe_builtins}\n"
            f"exec({source_code!r}, user_ns)\n"
            f"cases_list = _j.loads({json.dumps(test_cases)!r})\n"
            "results = []\n"
            "for tc in cases_list:\n"
            "    try:\n"
            "        actual = eval(tc['call'], user_ns)\n"
            "        if isinstance(actual, tuple):\n"
            "            actual = list(actual)\n"
            "        passed = (actual == tc['expected'])\n"
            "        if tc.get('is_hidden', False):\n"
            "            results.append({'name': tc['name'], 'passed': passed, 'is_hidden': True})\n"
            "        else:\n"
            "            results.append({'name': tc['name'], 'passed': passed, 'actual': actual, 'expected': tc['expected']})\n"
            "    except MemoryError:\n"
            "        raise\n"
            "    except Exception as e:\n"
            "        if tc.get('is_hidden', False):\n"
            "            results.append({'name': tc['name'], 'passed': False, 'error': 'Hidden test execution failed', 'is_hidden': True})\n"
            "        else:\n"
            "            results.append({'name': tc['name'], 'passed': False, 'error': str(e)})\n"
            "print(_j.dumps(results))\n"
        )

        t0 = time.monotonic()
        try:
            proc = subprocess.run(
                [sys.executable, "-I", "-c", harness],
                capture_output=True,
                text=True,
                timeout=timeout_ms / 1000.0,
                env={},
                preexec_fn=lambda: _apply_posix_rlimits(memory_limit_mb, apply_as_limit=True),
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise SandboxTimeoutError(timeout_ms) from exc

        elapsed_ms = max(1, int((time.monotonic() - t0) * 1000))
        if proc.returncode != 0:
            stderr_msg = proc.stderr.strip() or "Sandbox execution failed"
            if "MemoryError" in stderr_msg or proc.returncode == -9:
                raise SandboxSecurityError("Memory limit exceeded (128MB).")
            return SandboxExecutionResult(
                passed_tests=0,
                total_tests=len(test_cases),
                code_score=0.0,
                runtime_ms=elapsed_ms,
                memory_kb=16384,
                test_results=[
                    {"name": tc["name"], "passed": False, "error": stderr_msg}
                    for tc in test_cases
                ],
            )

        parsed = json.loads(proc.stdout.strip() or "[]")
        passed_count = sum(1 for r in parsed if r.get("passed"))
        total_count = max(1, len(test_cases))
        return SandboxExecutionResult(
            passed_tests=passed_count,
            total_tests=len(test_cases),
            code_score=round(passed_count / total_count, 4),
            runtime_ms=min(elapsed_ms, timeout_ms),
            memory_kb=18432,
            test_results=parsed,
        )

    def _run_sql(
        self,
        source_code: str,
        test_cases: list[dict[str, Any]],
        timeout_ms: int,
        memory_limit_mb: int = MAX_SANDBOX_MEMORY_MB,
    ) -> SandboxExecutionResult:
        lowered = source_code.lower()
        for forbidden in ("attach", "pragma", "load_extension", "drop ", "delete "):
            if forbidden in lowered:
                raise SandboxSecurityError(f"Forbidden SQL keyword blocked: '{forbidden.strip()}'")

        max_sql_rows = 1000
        harness = (
            "import json as _j, sqlite3 as _s, time as _t\n"
            f"source_code = {source_code!r}\n"
            f"cases_list = _j.loads({json.dumps(test_cases)!r})\n"
            f"deadline_s = {timeout_ms / 1000.0!r}\n"
            f"max_rows = {max_sql_rows}\n"
            "t0 = _t.monotonic()\n"
            "conn = _s.connect(':memory:')\n"
            "conn.set_progress_handler(lambda: 1 if (_t.monotonic() - t0) > deadline_s else 0, 5000)\n"
            "try:\n"
            "    conn.execute('CREATE TABLE competencies (concept_slug TEXT, depth_level_norm REAL, stability_s REAL);')\n"
            "    conn.executemany(\n"
            "        'INSERT INTO competencies VALUES (?, ?, ?);',\n"
            "        [('net-internet', 0.75, 3.0), ('web-http', 0.50, 1.8), ('os-basics', 0.25, 3.0)],\n"
            "    )\n"
            "    cur = conn.execute(source_code)\n"
            "    fetched = cur.fetchmany(max_rows + 1)\n"
            "    if len(fetched) > max_rows:\n"
            "        raise RuntimeError(f'SQL result exceeded {max_rows} rows limit')\n"
            "    rows = [list(r) for r in fetched]\n"
            "finally:\n"
            "    conn.close()\n"
            "results = []\n"
            "for tc in cases_list:\n"
            "    passed = (rows == tc['expected'])\n"
            "    if tc.get('is_hidden', False):\n"
            "        results.append({'name': tc['name'], 'passed': passed, 'is_hidden': True})\n"
            "    else:\n"
            "        results.append({'name': tc['name'], 'passed': passed, 'actual': rows, 'expected': tc['expected']})\n"
            "print(_j.dumps(results))\n"
        )

        t0 = time.monotonic()
        try:
            proc = subprocess.run(
                [sys.executable, "-I", "-c", harness],
                capture_output=True,
                text=True,
                timeout=timeout_ms / 1000.0,
                env={},
                preexec_fn=lambda: _apply_posix_rlimits(memory_limit_mb, apply_as_limit=True),
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise SandboxTimeoutError(timeout_ms) from exc

        elapsed_ms = max(1, int((time.monotonic() - t0) * 1000))
        if proc.returncode != 0:
            stderr_msg = proc.stderr.strip() or "SQL sandbox execution failed"
            if "interrupted" in stderr_msg.lower():
                raise SandboxTimeoutError(timeout_ms)
            if "MemoryError" in stderr_msg or proc.returncode == -9:
                raise SandboxSecurityError("Memory limit exceeded (128MB).")
            return SandboxExecutionResult(
                passed_tests=0,
                total_tests=len(test_cases),
                code_score=0.0,
                runtime_ms=elapsed_ms,
                memory_kb=8192,
                test_results=[
                    (
                        {
                            "name": tc["name"],
                            "passed": False,
                            "error": "Hidden test execution failed",
                            "is_hidden": True,
                        }
                        if tc.get("is_hidden", False)
                        else {"name": tc["name"], "passed": False, "error": stderr_msg}
                    )
                    for tc in test_cases
                ],
            )

        results = json.loads(proc.stdout.strip() or "[]")
        passed_count = sum(1 for r in results if r.get("passed"))
        return SandboxExecutionResult(
            passed_tests=passed_count,
            total_tests=len(test_cases),
            code_score=round(passed_count / max(1, len(test_cases)), 4),
            runtime_ms=min(elapsed_ms, timeout_ms),
            memory_kb=8192,
            test_results=results,
        )

    def _run_javascript(
        self,
        source_code: str,
        test_cases: list[dict[str, Any]],
        timeout_ms: int,
        memory_limit_mb: int = MAX_SANDBOX_MEMORY_MB,
    ) -> SandboxExecutionResult:
        for label, pattern in _FORBIDDEN_JS_PATTERNS:
            if pattern.search(source_code):
                raise SandboxSecurityError(f"Forbidden JS API blocked by Sandbox: '{label}'")

        node_bin = shutil.which("node")
        if node_bin is None:
            raise SandboxSecurityError("JavaScript sandbox runtime (node) is unavailable.")

        effective_mem_mb = min(memory_limit_mb, MAX_SANDBOX_MEMORY_MB)
        harness = (
            "const vm = require('node:vm');\n"
            f"const userCode = {json.dumps(source_code)};\n"
            f"const cases = {json.dumps(test_cases)};\n"
            f"const timeoutMs = {int(timeout_ms)};\n"
            "const ctx = vm.createContext(Object.create(null));\n"
            "vm.runInContext(userCode, ctx, { timeout: timeoutMs });\n"
            "const out = cases.map((tc) => {\n"
            "  try {\n"
            "    const actual = vm.runInContext(tc.call, ctx, { timeout: timeoutMs });\n"
            "    const passed = JSON.stringify(actual) === JSON.stringify(tc.expected);\n"
            "    if (tc.is_hidden) {\n"
            "      return { name: tc.name, passed, is_hidden: true };\n"
            "    }\n"
            "    return { name: tc.name, passed, actual, expected: tc.expected };\n"
            "  } catch (e) {\n"
            "    if (tc.is_hidden) {\n"
            "      return { name: tc.name, passed: false, error: 'Hidden test execution failed', is_hidden: true };\n"
            "    }\n"
            "    return { name: tc.name, passed: false, error: String(e) };\n"
            "  }\n"
            "});\n"
            "process.stdout.write(JSON.stringify(out));\n"
        )
        t0 = time.monotonic()
        try:
            proc = subprocess.run(
                [node_bin, f"--max-old-space-size={effective_mem_mb}", "-e", harness],
                capture_output=True,
                text=True,
                timeout=timeout_ms / 1000.0,
                env={},
                preexec_fn=lambda: _apply_posix_rlimits(effective_mem_mb, apply_as_limit=False),
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise SandboxTimeoutError(timeout_ms) from exc

        elapsed_ms = max(1, int((time.monotonic() - t0) * 1000))
        if proc.returncode != 0:
            stderr_msg = proc.stderr.strip() or "JS Sandbox execution failed"
            if "heap out of memory" in stderr_msg.lower() or proc.returncode == -9:
                raise SandboxSecurityError("Memory limit exceeded (128MB).")
            return SandboxExecutionResult(
                passed_tests=0,
                total_tests=len(test_cases),
                code_score=0.0,
                runtime_ms=elapsed_ms,
                memory_kb=16384,
                test_results=[
                    {"name": tc["name"], "passed": False, "error": stderr_msg}
                    for tc in test_cases
                ],
            )
        parsed = json.loads(proc.stdout.strip() or "[]")
        passed_count = sum(1 for r in parsed if r.get("passed"))
        return SandboxExecutionResult(
            passed_tests=passed_count,
            total_tests=len(test_cases),
            code_score=round(passed_count / max(1, len(test_cases)), 4),
            runtime_ms=min(elapsed_ms, timeout_ms),
            memory_kb=16384,
            test_results=parsed,
        )
