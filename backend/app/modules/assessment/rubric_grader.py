"""LLM Rubric Grader Adapter + Upgraded Deterministic Fallback + Circuit Breaker (PL3-TUTOR-01)."""

from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

_NEGATION_PREFIXES: tuple[str, ...] = (
    "không cần",
    "khong can",
    "bỏ qua",
    "bo qua",
    "tắt",
    "tat ",
    "vô dụng",
    "vo dung",
    "không dùng",
    "khong dung",
    "don't need",
    "do not need",
    "skip ",
    "disable ",
    "ignore ",
)

_BILINGUAL_SYNONYMS: dict[str, tuple[str, ...]] = {
    "index": ("chỉ mục", "chi muc", "b-tree", "btree"),
    "cache": ("bộ nhớ đệm", "bo nho dem", "caching", "redis"),
    "transaction": ("giao dịch", "giao dich", "acid", "rollback", "commit"),
    "idempotent": ("lũy đẳng", "luy dang", "idempotency", "chống lặp"),
    "timeout": ("hết thời gian", "quá thời gian", "ngắt kết nối"),
    "retry": ("thử lại", "thu lai", "backoff"),
    "lock": ("khóa", "khoa", "deadlock", "mutex", "for update"),
    "latency": ("độ trễ", "do tre", "p95", "chậm"),
    "throughput": ("thông lượng", "thong luong", "rps", "qps"),
    "stateless": ("không trạng thái", "khong trang thai", "jwt"),
    "stateful": ("có trạng thái", "co trang thai", "session"),
    "security": ("bảo mật", "bao mat", "xss", "csrf", "sqli"),
    "memory": ("bộ nhớ", "bo nho", "ram", "oom"),
    "container": ("docker", "cô lập", "co lap", "namespace", "cgroup"),
}


@dataclass(frozen=True)
class RubricCriterion:
    """Single weighted criterion in a GradingRubric."""

    name: str
    weight: float
    required_keywords: list[str]
    socratic_hint: str | None = None


@dataclass(frozen=True)
class RubricGradeResult:
    """Result of grading an open-ended Tier 3-5 answer."""

    rubric_score: float
    grader_source: str  # "llm_rubric" | "deterministic_fallback"
    tutor_summary: str
    criteria_results: list[dict[str, Any]]


class RubricGraderPort(ABC):
    """Port interface for Rubric-based open-ended grading + AI Tutor feedback."""

    @abstractmethod
    def grade(
        self,
        prompt: str,
        written_explanation: str,
        criteria: list[RubricCriterion],
        reference_explanation: str,
    ) -> tuple[float, str, list[dict[str, Any]], str]:
        """Return (rubric_score, tutor_summary, criteria_results, grader_source)."""


def _keyword_matches_without_negation(normalized_text: str, kw: str) -> bool:
    """Check if kw (or a bilingual synonym) appears in normalized_text without immediate negation."""
    candidates = [kw.lower()]
    for base, syns in _BILINGUAL_SYNONYMS.items():
        if base in kw.lower():
            candidates.extend(syns)

    for term in candidates:
        escaped = re.escape(term)
        pattern = re.compile(rf"(?<!\w){escaped}(?!\w)" if term.isalnum() else escaped)
        for match in pattern.finditer(normalized_text):
            window_start = max(0, match.start() - 24)
            preceding = normalized_text[window_start : match.start()].strip()
            if any(preceding.endswith(neg.strip()) or neg in preceding for neg in _NEGATION_PREFIXES):
                continue
            return True
    return False


class DeterministicRubricGrader(RubricGraderPort):
    """Offline-safe deterministic Rubric grader with bilingual synonyms, negation check & Socratic hints."""

    def grade(
        self,
        prompt: str,
        written_explanation: str,
        criteria: list[RubricCriterion],
        reference_explanation: str,
        *,
        hide_missing_keywords: bool = False,
    ) -> tuple[float, str, list[dict[str, Any]], str]:
        _ = prompt
        normalized = written_explanation.lower().strip()
        words = [w for w in re.split(r"\s+", normalized) if w]
        has_explanation_structure = len(words) >= 6 and len(normalized) >= 28

        total_score = 0.0
        criteria_results: list[dict[str, Any]] = []
        missing_names: list[str] = []
        socratic_hints: list[str] = []

        for c in criteria:
            kws = [k.lower() for k in c.required_keywords]
            matched = [k for k in kws if _keyword_matches_without_negation(normalized, k)]
            missing = [k for k in kws if k not in matched]
            ratio = len(matched) / max(1, len(kws))

            if ratio >= 0.5:
                s_j = 1.0 if has_explanation_structure else 0.5
            elif ratio > 0.0:
                s_j = 0.5
            else:
                s_j = 0.0

            if s_j < 1.0:
                missing_names.append(c.name)
                if c.socratic_hint:
                    socratic_hints.append(c.socratic_hint)

            total_score += c.weight * s_j
            item: dict[str, Any] = {
                "name": c.name,
                "weight": c.weight,
                "score": s_j,
                "matched_keywords": matched,
            }
            if hide_missing_keywords and s_j < 1.0:
                item["socratic_hint"] = (
                    c.socratic_hint
                    or f"Hãy phân tích sâu hơn về khía cạnh '{c.name}' bằng câu giải thích hoàn chỉnh."
                )
            else:
                item["missing_keywords"] = missing
                if c.socratic_hint:
                    item["socratic_hint"] = c.socratic_hint
            criteria_results.append(item)

        rubric_score = round(min(1.0, max(0.0, total_score)), 4)
        if rubric_score >= 0.75:
            tutor_summary = (
                f"Bài giải thích đạt {int(rubric_score * 100)}% theo biểu điểm Rubric. "
                f"Gợi ý chuẩn: {reference_explanation}"
            )
        elif hide_missing_keywords:
            hint_text = (
                " ".join(socratic_hints[:2])
                if socratic_hints
                else f"Hãy xem lại các khía cạnh: {', '.join(missing_names) or 'cơ chế cốt lõi'} và giải thích rõ nguyên nhân – hệ quả."
            )
            tutor_summary = (
                f"Bài giải thích mới đạt {int(rubric_score * 100)}%. "
                f"Gợi mở Socratic cho lượt thử lại: {hint_text}"
            )
        else:
            missing_str = ", ".join(missing_names) if missing_names else "chi tiết kỹ thuật cốt lõi"
            tutor_summary = (
                f"Bài giải thích mới đạt {int(rubric_score * 100)}%, còn thiếu ý ở: {missing_str}. "
                f"Hướng dẫn tham khảo: {reference_explanation}"
            )

        return rubric_score, tutor_summary, criteria_results, "deterministic_fallback"


class LlmRubricGraderAdapter(RubricGraderPort):
    """External LLM Rubric Adapter (default 8.0s timeout via PLUMORA_LLM_TIMEOUT_S); fails over via CircuitBreaker when offline."""

    def __init__(self, timeout_s: float | None = None) -> None:
        if timeout_s is not None:
            self.timeout_s = timeout_s
        else:
            self.timeout_s = float(os.environ.get("PLUMORA_LLM_TIMEOUT_S", "8.0"))

    def grade(
        self,
        prompt: str,
        written_explanation: str,
        criteria: list[RubricCriterion],
        reference_explanation: str,
        *,
        hide_missing_keywords: bool = False,
    ) -> tuple[float, str, list[dict[str, Any]], str]:
        _ = hide_missing_keywords
        api_url = os.environ.get("PLUMORA_LLM_API_URL", "").strip()
        api_key = os.environ.get("PLUMORA_LLM_API_KEY", "").strip()
        if not api_url or not api_key:
            raise ConnectionError("External LLM API is not configured in local/offline mode.")
        if not api_url.startswith(("http://", "https://")):
            raise ValueError("PLUMORA_LLM_API_URL must use http:// or https:// scheme.")

        request_payload = {
            "model": os.environ.get("PLUMORA_LLM_MODEL", "gpt-4o-mini"),
            "response_format": {"type": "json_object"},
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are an educational rubric grader. Evaluate the student's explanation "
                        "against the weighted criteria and return JSON with keys: "
                        "rubric_score (float 0..1), tutor_summary (string), criteria_results (list)."
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "prompt": prompt,
                            "written_explanation": written_explanation,
                            "criteria": [
                                {
                                    "name": c.name,
                                    "weight": c.weight,
                                    "required_keywords": c.required_keywords,
                                }
                                for c in criteria
                            ],
                            "reference_explanation": reference_explanation,
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
        }
        req = urllib.request.Request(  # noqa: S310
            api_url,
            method="POST",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            data=json.dumps(request_payload).encode("utf-8"),
        )
        with urllib.request.urlopen(req, timeout=self.timeout_s) as resp:  # noqa: S310
            if resp.status >= 400:
                raise RuntimeError(f"LLM API returned HTTP {resp.status}")
            raw_bytes = resp.read()

        parsed = json.loads(raw_bytes.decode("utf-8"))
        if "choices" in parsed and isinstance(parsed["choices"], list) and parsed["choices"]:
            content_str = parsed["choices"][0]["message"]["content"]
            graded = json.loads(content_str) if isinstance(content_str, str) else content_str
        else:
            graded = parsed

        raw_score = float(graded["rubric_score"])
        if not (0.0 <= raw_score <= 1.0):
            raise ValueError(f"LLM rubric_score out of bounds: {raw_score}")
        tutor_summary = str(graded.get("tutor_summary", "")).strip()
        if not tutor_summary:
            raise ValueError("LLM response missing tutor_summary")
        crit_results = graded.get("criteria_results")
        if not isinstance(crit_results, list):
            crit_results = [
                {"name": c.name, "weight": c.weight, "score": raw_score}
                for c in criteria
            ]
        return round(raw_score, 4), tutor_summary, crit_results, "llm_rubric"


class CircuitBreakerRubricService:
    """Wraps primary LLM Rubric Adapter with Circuit Breaker -> DeterministicRubricGrader fallback."""

    def __init__(
        self,
        primary: RubricGraderPort,
        fallback: RubricGraderPort,
        failure_threshold: int = 2,
        reset_timeout_s: float = 30.0,
    ) -> None:
        self.primary = primary
        self.fallback = fallback
        self.failure_threshold = failure_threshold
        self.reset_timeout_s = reset_timeout_s
        self._failures = 0
        self._opened_at: float | None = None

    def grade_with_fallback(
        self,
        prompt: str,
        written_explanation: str,
        criteria: list[RubricCriterion],
        reference_explanation: str,
        *,
        hide_missing_keywords: bool = False,
    ) -> RubricGradeResult:
        now = time.monotonic()
        circuit_open = (
            self._opened_at is not None and (now - self._opened_at) < self.reset_timeout_s
        )
        if not circuit_open:
            try:
                score, summary, crit_res, source = self.primary.grade(
                    prompt,
                    written_explanation,
                    criteria,
                    reference_explanation,
                )
                self._failures = 0
                self._opened_at = None
                return RubricGradeResult(
                    rubric_score=score,
                    grader_source=source,
                    tutor_summary=summary,
                    criteria_results=crit_res,
                )
            except Exception:  # noqa: BLE001
                self._failures += 1
                if self._failures >= self.failure_threshold:
                    self._opened_at = now

        if isinstance(self.fallback, DeterministicRubricGrader):
            score, summary, crit_res, source = self.fallback.grade(
                prompt,
                written_explanation,
                criteria,
                reference_explanation,
                hide_missing_keywords=hide_missing_keywords,
            )
        else:
            score, summary, crit_res, source = self.fallback.grade(
                prompt,
                written_explanation,
                criteria,
                reference_explanation,
            )
        return RubricGradeResult(
            rubric_score=score,
            grader_source=source,
            tutor_summary=summary,
            criteria_results=crit_res,
        )
