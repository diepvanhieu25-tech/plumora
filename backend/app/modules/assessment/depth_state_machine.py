"""5-Depth Probing State Machine & deterministic 3D competency mapper (PL3-ASSESS-01, INV-DEPTH-01)."""

from __future__ import annotations

from dataclasses import dataclass

PASS_THRESHOLD: float = 0.75
MAX_DEPTH_TIER: int = 5
MAX_CONSECUTIVE_FAILS_AT_TIER: int = 2


@dataclass(frozen=True)
class CompetencyMappingResult:
    """Deterministic 3D mapping output (depth_level_norm, depth_label, confidence, is_mastered_for_dag)."""

    depth_level_norm: float
    depth_label: str
    confidence: float
    is_mastered_for_dag: bool


def depth_label_for_norm(depth_norm: float) -> str:
    """Return canonical depth label for a normalized depth score."""
    if depth_norm >= 1.0:
        return "Mastery"
    if depth_norm >= 0.75:
        return "Deep Understanding"
    if depth_norm >= 0.50:
        return "Applied"
    if depth_norm >= 0.25:
        return "Surface"
    return "Untested / Below Surface"


def map_depth_to_competency(
    highest_passed_tier: int,
    passed_code_sandbox: bool,
    rubric_score: float | None,
    abandoned: bool = False,
    steps_completed: int = 0,
    existing_depth: float = 0.0,
) -> CompetencyMappingResult:
    """Map 3D evidence (highest passed tier x task type x rubric/sandbox score) deterministically."""
    if abandoned and steps_completed < 2:
        return CompetencyMappingResult(
            depth_level_norm=existing_depth,
            depth_label="insufficient_evidence",
            confidence=0.40,
            is_mastered_for_dag=existing_depth >= 0.75,
        )

    if highest_passed_tier <= 0:
        return CompetencyMappingResult(
            depth_level_norm=0.00,
            depth_label="Untested / Below Surface",
            confidence=0.50,
            is_mastered_for_dag=False,
        )
    if highest_passed_tier == 1:
        return CompetencyMappingResult(
            depth_level_norm=0.25,
            depth_label="Surface",
            confidence=0.65,
            is_mastered_for_dag=False,
        )
    if highest_passed_tier == 2:
        return CompetencyMappingResult(
            depth_level_norm=0.50,
            depth_label="Applied",
            confidence=0.75,
            is_mastered_for_dag=False,
        )
    if highest_passed_tier in (3, 4):
        return CompetencyMappingResult(
            depth_level_norm=0.75,
            depth_label="Deep Understanding",
            confidence=0.85,
            is_mastered_for_dag=True,
        )

    # Tier 5 passed: require Code Sandbox 100% or Rubric >= 0.85 for Mastery = 1.00
    if passed_code_sandbox or (rubric_score is not None and rubric_score >= 0.85):
        return CompetencyMappingResult(
            depth_level_norm=1.00,
            depth_label="Mastery",
            confidence=0.95,
            is_mastered_for_dag=True,
        )
    return CompetencyMappingResult(
        depth_level_norm=0.75,
        depth_label="Deep Understanding",
        confidence=0.85,
        is_mastered_for_dag=True,
    )


@dataclass
class DepthTransitionResult:
    """State transition output after evaluating one depth step."""

    next_status: str  # "active" | "ceiling_reached" | "completed"
    next_depth_tier: int | None
    consecutive_fails_at_tier: int
    highest_passed_tier: int


def advance_depth_state(
    current_tier: int,
    consecutive_fails: int,
    highest_passed_tier: int,
    step_score: float,
) -> DepthTransitionResult:
    """Deterministic transition for 5-Depth Probing State Machine."""
    passed = step_score >= PASS_THRESHOLD
    if passed:
        new_highest = max(highest_passed_tier, current_tier)
        if current_tier >= MAX_DEPTH_TIER:
            return DepthTransitionResult(
                next_status="completed",
                next_depth_tier=None,
                consecutive_fails_at_tier=0,
                highest_passed_tier=new_highest,
            )
        return DepthTransitionResult(
            next_status="active",
            next_depth_tier=current_tier + 1,
            consecutive_fails_at_tier=0,
            highest_passed_tier=new_highest,
        )

    new_fails = consecutive_fails + 1
    if new_fails >= MAX_CONSECUTIVE_FAILS_AT_TIER:
        return DepthTransitionResult(
            next_status="ceiling_reached",
            next_depth_tier=None,
            consecutive_fails_at_tier=new_fails,
            highest_passed_tier=highest_passed_tier,
        )
    return DepthTransitionResult(
        next_status="active",
        next_depth_tier=current_tier,
        consecutive_fails_at_tier=new_fails,
        highest_passed_tier=highest_passed_tier,
    )
