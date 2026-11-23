"""Idempotent seed loader for Phase 3 multi-domain KG, 5-depth questions, rubrics, and code challenges."""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    CodeChallengeModel,
    DepthQuestionModel,
    DomainConceptMapModel,
    DomainModel,
    GradingRubricModel,
)
from app.modules.content.dag_validator import validate_dag_acyclic

SEED_DIR = Path(__file__).resolve().parents[2] / "seed"


def _upsert_domain_and_nodes(
    db: Session,
    slug: str,
    title: str,
    description: str,
    nodes_data: list[dict[str, Any]],
) -> None:
    node_slugs = [str(n["slug"]) for n in nodes_data]
    edges = [
        (str(n["slug"]), str(p))
        for n in nodes_data
        for p in n.get("prerequisites", [])
    ]
    validate_dag_acyclic(node_slugs, edges)

    domain = db.get(DomainModel, slug)
    if domain is None:
        domain = DomainModel(
            slug=slug,
            title=title,
            description=description,
            is_published=True,
            graph_version=1,
        )
        db.add(domain)
    else:
        domain.title = title
        domain.description = description
    db.flush()

    for n in nodes_data:
        c_slug = str(n["slug"])
        row = db.get(DomainConceptMapModel, (slug, c_slug))
        if row is None:
            row = DomainConceptMapModel(
                domain_slug=slug,
                concept_slug=c_slug,
                node_idx=int(n["node_idx"]),
                title=str(n["title"]),
                tier=int(n["tier"]),
                is_shared=bool(n["is_shared"]),
                prerequisites_json=[str(p) for p in n.get("prerequisites", [])],
                lesson_markdown=str(n.get("lesson_markdown", "")),
            )
            db.add(row)
        else:
            row.node_idx = int(n["node_idx"])
            row.title = str(n["title"])
            row.tier = int(n["tier"])
            row.is_shared = bool(n["is_shared"])
            row.prerequisites_json = [str(p) for p in n.get("prerequisites", [])]
            row.lesson_markdown = str(n.get("lesson_markdown", ""))


def seed_phase3_v2_data(db: Session) -> None:
    """Idempotently seed Backend/Frontend/DevOps domains, 5-depth questions, rubrics, and code challenges."""
    be_raw = json.loads((SEED_DIR / "backend_12_concepts.json").read_text(encoding="utf-8"))
    fe_raw = json.loads((SEED_DIR / "frontend_10_concepts.json").read_text(encoding="utf-8"))
    do_raw = json.loads((SEED_DIR / "devops_9_concepts.json").read_text(encoding="utf-8"))

    # Map backend 12 concepts using shared flags per D-18
    shared_slugs = {
        "net-internet",
        "os-basics",
        "web-http",
        "api-rest",
        "cache-redis",
        "sec-authn",
        "sec-api",
    }
    id_to_slug = {int(c["action_id"]): str(c["slug"]) for c in be_raw["concepts"]}
    be_nodes: list[dict[str, Any]] = []
    for c in be_raw["concepts"]:
        c_slug = str(c["slug"])
        be_nodes.append(
            {
                "node_idx": int(c["action_id"]),
                "slug": c_slug,
                "title": str(c["title"]),
                "tier": int(c["tier"]),
                "is_shared": c_slug in shared_slugs,
                "prerequisites": [id_to_slug[int(pid)] for pid in c["prerequisites"]],
                "lesson_markdown": str(c["lesson_markdown"]),
            }
        )

    _upsert_domain_and_nodes(
        db,
        slug="backend",
        title="Kỹ thuật Backend & Hệ thống Phân tán",
        description="Lộ trình 12 khái niệm Backend 4 tầng DAG (nền tảng từ MVP v1.0.0).",
        nodes_data=be_nodes,
    )
    _upsert_domain_and_nodes(
        db,
        slug=str(fe_raw["domain"]["slug"]),
        title=str(fe_raw["domain"]["title"]),
        description=str(fe_raw["domain"]["description"]),
        nodes_data=fe_raw["concepts"],
    )
    _upsert_domain_and_nodes(
        db,
        slug=str(do_raw["domain"]["slug"]),
        title=str(do_raw["domain"]["title"]),
        description=str(do_raw["domain"]["description"]),
        nodes_data=do_raw["concepts"],
    )
    db.flush()

    # Seed depth questions and rubrics
    dq_raw = json.loads(
        (SEED_DIR / "depth_questions_and_rubrics.json").read_text(encoding="utf-8")
    )
    for idx, q in enumerate(dq_raw["questions"]):
        q_id = uuid.UUID(str(q["id"]))
        existing_q = db.get(DepthQuestionModel, q_id)
        if existing_q is None:
            existing_q = DepthQuestionModel(
                id=q_id,
                concept_slug=str(q["concept_slug"]),
                depth_tier=int(q["depth_tier"]),
                task_type=str(q["task_type"]),
                prompt=str(q["prompt"]),
                options_json=q.get("options"),
                correct_option_key=q.get("correct_option_key"),
                is_placement_eligible=bool(q.get("is_placement_eligible", False)),
                is_active=bool(q.get("is_active", True)),
                version=int(q.get("version", 1)),
                display_order=int(q.get("display_order", idx)),
            )
            db.add(existing_q)
        else:
            existing_q.task_type = str(q["task_type"])
            existing_q.prompt = str(q["prompt"])
            existing_q.options_json = q.get("options")
            existing_q.correct_option_key = q.get("correct_option_key")
            existing_q.is_placement_eligible = bool(q.get("is_placement_eligible", False))
            existing_q.is_active = bool(q.get("is_active", True))
            existing_q.version = int(q.get("version", existing_q.version))
            existing_q.display_order = int(q.get("display_order", idx))
        db.flush()

        rubric_data = q.get("rubric")
        if rubric_data is not None:
            existing_r = db.scalars(
                select(GradingRubricModel).where(GradingRubricModel.question_id == q_id)
            ).first()
            if existing_r is None:
                db.add(
                    GradingRubricModel(
                        question_id=q_id,
                        criteria_json=list(rubric_data["criteria"]),
                        reference_explanation=str(rubric_data["reference_explanation"]),
                    )
                )
            else:
                existing_r.criteria_json = list(rubric_data["criteria"])
                existing_r.reference_explanation = str(rubric_data["reference_explanation"])

    # Seed code challenges
    cc_raw = json.loads((SEED_DIR / "code_challenges.json").read_text(encoding="utf-8"))
    for idx, ch in enumerate(cc_raw["challenges"]):
        ch_id = uuid.UUID(str(ch["id"]))
        existing_ch = db.get(CodeChallengeModel, ch_id)
        if existing_ch is None:
            db.add(
                CodeChallengeModel(
                    id=ch_id,
                    concept_slug=str(ch["concept_slug"]),
                    title=str(ch["title"]),
                    language=str(ch["language"]),
                    prompt=str(ch["prompt"]),
                    buggy_starter_code=str(ch["buggy_starter_code"]),
                    solution_code=str(ch["solution_code"]),
                    test_cases_json=list(ch["test_cases"]),
                    timeout_ms=int(ch.get("timeout_ms", 3000)),
                    memory_limit_mb=int(ch.get("memory_limit_mb", 128)),
                    setup_sql=ch.get("setup_sql"),
                    is_active=bool(ch.get("is_active", True)),
                    version=int(ch.get("version", 1)),
                    display_order=int(ch.get("display_order", idx)),
                )
            )
        else:
            existing_ch.title = str(ch["title"])
            existing_ch.language = str(ch["language"])
            existing_ch.prompt = str(ch["prompt"])
            existing_ch.buggy_starter_code = str(ch["buggy_starter_code"])
            existing_ch.solution_code = str(ch["solution_code"])
            existing_ch.test_cases_json = list(ch["test_cases"])
            existing_ch.setup_sql = ch.get("setup_sql")
            existing_ch.is_active = bool(ch.get("is_active", True))
            existing_ch.version = int(ch.get("version", existing_ch.version))
            existing_ch.display_order = int(ch.get("display_order", idx))

    db.commit()
