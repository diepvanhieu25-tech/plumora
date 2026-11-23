"""Fitness Function 4: Seed Pedagogical Invariants, Dual Sandbox Verification & Adversarial Grader."""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

from app.modules.assessment.rubric_grader import DeterministicRubricGrader, RubricCriterion
from app.modules.assessment.sandbox_worker import IsolatedSandboxWorkerAdapter

SEED_DIR = Path(__file__).resolve().parents[2] / "app" / "seed"
RAW_LATEX_RE = re.compile(r"\$[^$\n]*(\\[a-zA-Z]+|[_^]\{)[^$\n]*\$")


def test_arch_seed_playbooks_rich_and_clean_markdown() -> None:
    """All 10 frontend and 9 devops concepts must have >= 1,600 chars Playbook markdown and 0 raw LaTeX."""
    for fname, expected_count in (
        ("frontend_10_concepts.json", 10),
        ("devops_9_concepts.json", 9),
    ):
        data = json.loads((SEED_DIR / fname).read_text(encoding="utf-8"))
        concepts = data["concepts"]
        assert len(concepts) == expected_count, f"{fname}: expected {expected_count}, got {len(concepts)}"
        for c in concepts:
            md = str(c.get("lesson_markdown", ""))
            assert len(md) >= 1600, f"{fname}:{c['slug']} lesson_markdown too short ({len(md)} < 1600)"
            assert not RAW_LATEX_RE.search(md), f"{fname}:{c['slug']} contains raw LaTeX"


def test_arch_seed_questions_balanced_mcq_and_distinct_rubrics() -> None:
    """110 questions valid, balanced A/B/C/D <= 35% in Tiers 1-2, >= 6 code_review, distinct Tier 3-5 rubrics."""
    raw = json.loads((SEED_DIR / "depth_questions_and_rubrics.json").read_text(encoding="utf-8"))
    items = raw["questions"] if isinstance(raw, dict) else raw
    assert len(items) == 110, f"Expected 110 seeded questions, got {len(items)}"

    tier1_keys: Counter[str] = Counter()
    tier2_keys: Counter[str] = Counter()
    code_review_count = 0
    rubrics_by_concept: dict[str, dict[int, frozenset[str]]] = {}

    for item in items:
        tier = int(item["depth_tier"])
        task_type = str(item["task_type"])
        cslug = str(item["concept_slug"])

        if tier == 1:
            tier1_keys[str(item["correct_option_key"])] += 1
        elif tier == 2:
            tier2_keys[str(item["correct_option_key"])] += 1

        if task_type == "code_review":
            code_review_count += 1

        if tier >= 3:
            rubric = item.get("rubric")
            assert isinstance(rubric, dict), f"Missing rubric on {cslug} tier {tier}"
            criteria = rubric.get("criteria", [])
            assert len(criteria) >= 2
            weight_sum = sum(float(c["weight"]) for c in criteria)
            assert abs(weight_sum - 1.0) < 1e-4, f"{cslug} T{tier} rubric weights sum={weight_sum}"
            kw_set = frozenset(k.lower() for c in criteria for k in c["required_keywords"])
            rubrics_by_concept.setdefault(cslug, {})[tier] = kw_set

    for tier_num, counts in ((1, tier1_keys), (2, tier2_keys)):
        total = sum(counts.values())
        assert total == 22
        for opt, cnt in counts.items():
            assert cnt / total <= 0.35, f"Tier {tier_num} option '{opt}' overrepresented: {cnt}/{total}"

    assert code_review_count >= 6, f"Expected >= 6 code_review questions, got {code_review_count}"

    for cslug, tier_map in rubrics_by_concept.items():
        assert {3, 4, 5}.issubset(tier_map.keys()), f"{cslug} missing tier 3/4/5 rubrics"
        assert tier_map[3] != tier_map[4] or tier_map[4] != tier_map[5], (
            f"{cslug} has identical rubrics across Tiers 3, 4, 5"
        )


def test_arch_all_22_code_challenges_pass_dual_sandbox_verification() -> None:
    """All 22/22 code challenges: solution_code MUST pass 100%, buggy_starter_code MUST fail >= 1 test."""
    raw = json.loads((SEED_DIR / "code_challenges.json").read_text(encoding="utf-8"))
    challenges = raw["challenges"] if isinstance(raw, dict) else raw
    assert len(challenges) == 22, f"Expected 22 code challenges, got {len(challenges)}"
    worker = IsolatedSandboxWorkerAdapter()

    for ch in challenges:
        slug = ch["concept_slug"]
        lang = ch["language"]
        tcs = ch["test_cases"]
        assert len(tcs) >= 2, f"{slug} has fewer than 2 test cases"

        sol_res = worker.execute(
            language=lang,
            source_code=ch["solution_code"],
            test_cases=tcs,
            timeout_ms=int(ch.get("timeout_ms", 3000)),
            memory_limit_mb=int(ch.get("memory_limit_mb", 128)),
        )
        assert sol_res.passed_tests == sol_res.total_tests, (
            f"Solution FAILED for {slug} ({lang}): {sol_res.passed_tests}/{sol_res.total_tests} -> {sol_res.test_results}"
        )

        starter_failed = False
        try:
            bug_res = worker.execute(
                language=lang,
                source_code=ch["buggy_starter_code"],
                test_cases=tcs,
                timeout_ms=int(ch.get("timeout_ms", 3000)),
                memory_limit_mb=int(ch.get("memory_limit_mb", 128)),
            )
            starter_failed = bug_res.passed_tests < bug_res.total_tests
        except Exception:  # noqa: BLE001
            starter_failed = True
        assert starter_failed, f"buggy_starter_code unexpectedly passed 100% for {slug}"


def test_arch_adversarial_grader_blocks_keyword_stuffing_and_negations() -> None:
    """Adversarial test: 4-keyword stuffing & negated wrong answers MUST score < 0.75."""
    grader = DeterministicRubricGrader()
    criteria = [
        RubricCriterion(
            name="Index & Query Plan",
            weight=0.5,
            required_keywords=["index", "b-tree", "seq scan"],
            socratic_hint="Hãy giải thích vì sao truy vấn quét toàn bảng và chỉ mục giúp giảm I/O ra sao.",
        ),
        RubricCriterion(
            name="Transaction Safety",
            weight=0.5,
            required_keywords=["transaction", "lock", "rollback"],
            socratic_hint="Khi có lỗi giữa chừng, cơ chế nào đảm bảo dữ liệu không bị ghi dở dang?",
        ),
    ]

    # 1. Raw 4-keyword stuffing without sentence structure (< 6 words / < 28 chars)
    stuffed_score, _, _, _ = grader.grade(
        prompt="Explain indexing and transactions",
        written_explanation="index lock rollback",
        criteria=criteria,
        reference_explanation="Use B-Tree index and ACID transactions.",
        hide_missing_keywords=True,
    )
    assert stuffed_score < 0.75, f"Keyword stuffing bypassed grader: score={stuffed_score}"

    # 2. Negated wrong answer containing the exact keywords
    negated_score, _, _, _ = grader.grade(
        prompt="Explain indexing and transactions",
        written_explanation="Hệ thống này không cần index và nên bỏ qua transaction, tắt lock hoàn toàn.",
        criteria=criteria,
        reference_explanation="Use B-Tree index and ACID transactions.",
        hide_missing_keywords=True,
    )
    assert negated_score < 0.75, f"Negated wrong answer bypassed grader: score={negated_score}"

    # 3. Genuine Vietnamese explanation using bilingual synonyms passes >= 0.75
    genuine_score, _, _, _ = grader.grade(
        prompt="Explain indexing and transactions",
        written_explanation=(
            "Ta cần tạo chỉ mục b-tree trên cột lọc để tránh quét toàn bảng, đồng thời bọc các lệnh ghi "
            "trong một giao dịch có khóa phù hợp để tự động khôi phục khi xảy ra lỗi."
        ),
        criteria=criteria,
        reference_explanation="Use B-Tree index and ACID transactions.",
        hide_missing_keywords=False,
    )
    assert genuine_score >= 0.75, f"Genuine Vietnamese explanation failed: score={genuine_score}"
