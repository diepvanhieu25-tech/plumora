"""Assessment, 5-Depth Probing, Code Sandbox, Rubric Grader & Ebbinghaus domain package."""

from __future__ import annotations

from importlib import import_module
from typing import Any


def __getattr__(name: str) -> Any:
    if name == "assessment_router":
        return import_module("app.modules.assessment.router_v2").router
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = ["assessment_router"]
