"""Behavioral RED tests for PL3-TUTOR-01: LLM Rubric Adapter & Circuit Breaker Fallback."""

from __future__ import annotations


def test_pl3_tutor_01_circuit_breaker_falls_back_to_deterministic_rubric_grader() -> None:
    """When LLM adapter raises timeout/network error, Circuit Breaker falls back cleanly without 500."""
    from app.modules.assessment.rubric_grader import (
        CircuitBreakerRubricService,
        DeterministicRubricGrader,
        RubricCriterion,
        RubricGraderPort,
    )

    class FailingLlmAdapter(RubricGraderPort):
        def grade(
            self,
            prompt: str,
            written_explanation: str,
            criteria: list[RubricCriterion],
            reference_explanation: str,
        ) -> tuple[float, str, list[dict[str, object]], str]:
            raise TimeoutError("Simulated LLM API timeout > 4000ms")

    service = CircuitBreakerRubricService(
        primary=FailingLlmAdapter(),
        fallback=DeterministicRubricGrader(),
        failure_threshold=1,
    )
    criteria = [
        RubricCriterion(
            name="DNS & IP resolution",
            weight=0.5,
            required_keywords=["dns", "ip"],
        ),
        RubricCriterion(
            name="TCP Handshake",
            weight=0.5,
            required_keywords=["tcp", "handshake", "syn"],
        ),
    ]
    result = service.grade_with_fallback(
        prompt="Giải thích quá trình trình duyệt phân giải tên miền và thiết lập kết nối.",
        written_explanation="Trình duyệt dùng DNS để phân giải tên miền thành địa chỉ IP, sau đó thực hiện TCP 3-way handshake với gói SYN.",
        criteria=criteria,
        reference_explanation="DNS phân giải domain thành IP và TCP handshake thiết lập kết nối.",
    )
    assert result.grader_source == "deterministic_fallback"
    assert result.rubric_score >= 0.75
    assert len(result.criteria_results) == 2
    assert len(result.tutor_summary) > 10
