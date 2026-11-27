"""5-Depth Probing & Ebbinghaus Spaced Review session orchestration."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from plumora_rl.domain import (
    LearningMode,
    MultiObjectiveRewardCalculator,
)
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import (
    AssessmentSessionModel,
    AttemptRecordModel,
    UserModel,
    UserNodeCompetencyModel,
)
from app.db.uow import SqlAlchemyUnitOfWork
from app.modules.assessment.depth_state_machine import (
    advance_depth_state,
    depth_label_for_norm,
    map_depth_to_competency,
)
from app.modules.assessment.schemas_v2 import (
    AssessmentAbandonResponse,
    AssessmentStartRequest,
    AssessmentStartResponse,
    AssessmentSubmitRequest,
    AssessmentSubmitResponse,
    DepthStepItem,
    TutorFeedbackOut,
)
from app.modules.assessment.services.competency_helpers import (
    _GRADER_REGISTRY,
    _build_competency_out,
    _build_domain_obs_snapshot,
    _build_step_item,
    _bump_user_state_version_if_accessible,
    _check_concept_eligible,
    _compute_real_retention,
    _get_or_create_competency,
    _invalidate_user_competency_cache,
    _select_question_for_tier,
)
from app.shared.contracts.adapters import get_content_catalog_port
from app.shared.contracts.ports import ContentCatalogPort
from app.shared.ebbinghaus import (
    INITIAL_STABILITY_DAYS,
    update_stability,
)
from app.shared.events.outbox import record_outbox_event_in_tx

logger = logging.getLogger(__name__)


def start_depth_or_review_session(
    db: Session,
    user: UserModel,
    payload: AssessmentStartRequest,
    catalog_port: ContentCatalogPort | None = None,
) -> AssessmentStartResponse:
    """Start a 5-Depth Probing or Spaced Review session enforcing INV-DAG-01 & INV-SEQ-01."""
    catalog = catalog_port or get_content_catalog_port(db)
    _check_concept_eligible(db, user.id, payload.domain_slug, payload.concept_slug, catalog)

    comp = db.get(UserNodeCompetencyModel, (user.id, payload.concept_slug))
    if payload.session_mode == "depth_probe":
        playbook_done = comp is not None and (
            comp.playbook_completed_at is not None or comp.depth_level_norm >= 0.25
        )
        if not playbook_done:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error_code": "PLAYBOOK_NOT_COMPLETED",
                    "message": "Complete the concept Playbook lesson before starting 5-Depth Probing.",
                },
            )

    start_tier = 1
    if (
        payload.session_mode == "depth_probe"
        and comp is not None
        and comp.depth_level_norm >= 0.50
    ) or payload.session_mode == "spaced_review":
        start_tier = 3

    bundle = catalog.get_concept_bundle(payload.concept_slug)
    concept_qs = bundle.questions if bundle is not None else ()

    # Rotate away from recently attempted questions for Spaced Review
    prev_q_ids = db.scalars(
        select(AttemptRecordModel.question_or_challenge_id)
        .where(
            AttemptRecordModel.user_id == user.id,
            AttemptRecordModel.concept_slug == payload.concept_slug,
        )
        .order_by(AttemptRecordModel.created_at.desc())
        .limit(10)
    ).all()
    seen_ids: set[str] = {str(qid) for qid in prev_q_ids}

    q = _select_question_for_tier(concept_qs, start_tier, seen_ids)
    if q is None and concept_qs:
        active_qs = [cand for cand in concept_qs if cand.is_active]
        q = active_qs[0] if active_qs else None
    if q is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "NO_QUESTIONS", "message": "No depth questions for concept."},
        )

    initial_highest = max(0, q.depth_tier - 1) if (comp is not None and comp.depth_level_norm >= 0.50) else 0
    session = AssessmentSessionModel(
        user_id=user.id,
        domain_slug=payload.domain_slug,
        concept_slug=payload.concept_slug,
        session_mode=payload.session_mode,
        status="active",
        current_depth_tier=q.depth_tier,
        consecutive_fails_at_tier=0,
        highest_passed_tier=initial_highest,
        steps_completed=0,
        state_json={
            "current_question_id": str(q.id),
            "seen_question_ids": [str(q.id)],
        },
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return AssessmentStartResponse(
        session_id=session.id,
        concept_slug=payload.concept_slug,
        session_mode=payload.session_mode,
        current_depth_tier=q.depth_tier,
        step_item=_build_step_item(q),
    )


def abandon_assessment_session(
    db: Session,
    user: UserModel,
    session_id: uuid.UUID,
) -> AssessmentAbandonResponse:
    """Explicitly abandon an active assessment session, triggering real insufficient_evidence if <2 steps."""
    uow = SqlAlchemyUnitOfWork(db)
    with uow.atomic_user_mutation(user.id):
        session = db.get(AssessmentSessionModel, session_id)
        if session is None or session.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "SESSION_NOT_FOUND", "message": "Assessment session not found."},
            )
        if session.status != "active":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error_code": "SESSION_CLOSED",
                    "message": f"Assessment session is already '{session.status}'.",
                },
            )
        concept_slug = session.concept_slug or ""
        comp = _get_or_create_competency(db, user.id, concept_slug)
        stab_before = float(comp.stability_s)

        bundle = get_content_catalog_port(db).get_concept_bundle(concept_slug)
        has_code = bundle is not None and bundle.code_challenge is not None
        mapped = map_depth_to_competency(
            highest_passed_tier=session.highest_passed_tier,
            passed_code_sandbox=comp.code_practice_score >= 1.0,
            rubric_score=None,
            abandoned=True,
            steps_completed=session.steps_completed,
            existing_depth=comp.depth_level_norm,
            has_code_challenge=has_code,
        )
        if mapped.depth_label == "insufficient_evidence":
            session.status = "insufficient_evidence"
        else:
            session.status = "ceiling_reached"
            new_depth = max(comp.peak_depth_level_norm, mapped.depth_level_norm)
            comp.depth_level_norm = new_depth
            comp.peak_depth_level_norm = new_depth
            comp.depth_label = depth_label_for_norm(new_depth)
            comp.confidence = max(comp.confidence, mapped.confidence)
            comp.updated_at = datetime.now(UTC)

        session.updated_at = datetime.now(UTC)
        db.flush()
        resp_abandon = AssessmentAbandonResponse(
            session_id=session.id,
            session_status=session.status,
            updated_competency=_build_competency_out(comp, stability_before=stab_before),
        )
    _invalidate_user_competency_cache(user.id)
    return resp_abandon


def submit_depth_or_review_step(
    db: Session,
    user: UserModel,
    session_id: uuid.UUID,
    payload: AssessmentSubmitRequest,
    catalog_port: ContentCatalogPort | None = None,
) -> AssessmentSubmitResponse:
    """3-Phase UoW submission: Read -> Grade outside DB lock -> Atomic commit & verified Outbox."""
    catalog = catalog_port or get_content_catalog_port(db)

    # Phase 1: Read & validate (no DB lock held during LLM/Rubric grading)
    def _try_idempotent_replay() -> AssessmentSubmitResponse | None:
        rec = db.scalars(
            select(AttemptRecordModel).where(
                AttemptRecordModel.user_id == user.id,
                AttemptRecordModel.submission_id == payload.submission_id,
            )
        ).first()
        if rec is None:
            return None
        if rec.session_id != session_id or rec.question_or_challenge_id != payload.question_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error_code": "SUBMISSION_ID_CONFLICT", "message": "submission_id already used."},
            )
        cached_resp = dict(rec.response_json)
        cached_resp["idempotent_replay"] = True
        return AssessmentSubmitResponse(**cached_resp)

    if (fast_replay := _try_idempotent_replay()) is not None:
        return fast_replay

    session_preview = db.get(AssessmentSessionModel, session_id)
    if session_preview is None or session_preview.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "SESSION_NOT_FOUND", "message": "Assessment session not found."},
        )
    if session_preview.session_mode not in ("depth_probe", "spaced_review"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "SESSION_MODE_MISMATCH", "message": "Invalid session mode for depth/review submit."},
        )
    if session_preview.status != "active":
        if (race_replay := _try_idempotent_replay()) is not None:
            return race_replay
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "SESSION_CLOSED",
                "message": f"Assessment session is already '{session_preview.status}'.",
            },
        )

    concept_slug_lookup = session_preview.concept_slug or ""
    bundle = catalog.get_concept_bundle(concept_slug_lookup)
    concept_qs = bundle.questions if bundle is not None else ()
    q = next((cand for cand in concept_qs if cand.id == payload.question_id), None)
    if q is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "QUESTION_NOT_FOUND", "message": "Question not found."},
        )
    if session_preview.concept_slug and q.concept_slug != session_preview.concept_slug:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "QUESTION_SESSION_MISMATCH",
                "message": f"Question does not belong to concept '{session_preview.concept_slug}'.",
            },
        )
    sess_state_preview = dict(session_preview.state_json or {})
    expected_q_id = sess_state_preview.get("current_question_id")
    if expected_q_id and str(payload.question_id) != str(expected_q_id):
        if (race_replay := _try_idempotent_replay()) is not None:
            return race_replay
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "QUESTION_STEP_MISMATCH",
                "message": "Submitted question_id does not match the current assessment step.",
            },
        )
    if session_preview.session_mode == "depth_probe" and q.depth_tier != session_preview.current_depth_tier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "QUESTION_TIER_MISMATCH",
                "message": f"Expected depth tier {session_preview.current_depth_tier}, got tier {q.depth_tier}.",
            },
        )

    # Phase 2: Execute Rubric/LLM grading OUTSIDE any DB transaction lock
    is_first_miss_hint_mode = (
        session_preview.session_mode == "depth_probe"
        and session_preview.consecutive_fails_at_tier == 0
    )
    grader = _GRADER_REGISTRY.get(q.task_type)
    grade_out = grader.grade_step(
        q,
        selected_option=payload.selected_option,
        written_explanation=payload.written_explanation,
        is_first_miss_hint_mode=is_first_miss_hint_mode,
    )
    tutor_feedback = (
        TutorFeedbackOut(
            summary=grade_out.tutor_summary,
            criteria_results=grade_out.criteria_results or [],
        )
        if grade_out.tutor_summary is not None
        else None
    )

    # Phase 3: Atomic commit under per-user advisory lock
    uow = SqlAlchemyUnitOfWork(db)
    try:
        with uow.atomic_user_mutation(user.id):
            existing = db.scalars(
                select(AttemptRecordModel).where(
                    AttemptRecordModel.user_id == user.id,
                    AttemptRecordModel.submission_id == payload.submission_id,
                )
            ).first()
            if existing is not None:
                if (
                    existing.session_id != session_id
                    or existing.question_or_challenge_id != payload.question_id
                ):
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail={"error_code": "SUBMISSION_ID_CONFLICT", "message": "submission_id already used."},
                    )
                cached = dict(existing.response_json)
                cached["idempotent_replay"] = True
                return AssessmentSubmitResponse(**cached)

            session = db.get(AssessmentSessionModel, session_id)
            if session is None or session.status != "active":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={"error_code": "SESSION_CLOSED", "message": "Assessment session is no longer active."},
                )

            concept_slug = session.concept_slug or q.concept_slug
            obs_before = _build_domain_obs_snapshot(
                db, user.id, session.domain_slug, catalog, target_concept_slug=concept_slug
            )
            comp = _get_or_create_competency(db, user.id, concept_slug)
            depth_before = float(comp.depth_level_norm)
            ret_before = _compute_real_retention(comp)
            code_before = float(comp.code_practice_score)
            stab_before = float(comp.stability_s)

            session.steps_completed += 1
            next_step_item: DepthStepItem | None = None
            sess_state = dict(session.state_json or {})
            seen_ids: set[str] = set(sess_state.get("seen_question_ids", []))
            seen_ids.add(str(q.id))
            now = datetime.now(UTC)

            if session.session_mode == "spaced_review":
                session.status = "completed"
                comp.stability_s = update_stability(comp.stability_s, grade_out.step_score, passed=grade_out.step_passed)
                if grade_out.step_passed:
                    comp.last_practiced_at = now
                comp.updated_at = now
                next_tier_val: int | None = None
            else:
                trans = advance_depth_state(
                    current_tier=session.current_depth_tier,
                    consecutive_fails=session.consecutive_fails_at_tier,
                    highest_passed_tier=session.highest_passed_tier,
                    step_score=grade_out.step_score,
                )
                session.status = trans.next_status
                session.consecutive_fails_at_tier = trans.consecutive_fails_at_tier
                session.highest_passed_tier = trans.highest_passed_tier
                next_tier_val = trans.next_depth_tier
                if trans.next_depth_tier is not None:
                    session.current_depth_tier = trans.next_depth_tier
                    nxt_q = _select_question_for_tier(concept_qs, trans.next_depth_tier, seen_ids)
                    if nxt_q is not None:
                        next_step_item = _build_step_item(nxt_q)
                        seen_ids.add(str(nxt_q.id))
                    else:
                        session.status = "completed"
                        next_tier_val = None
                session.state_json = {
                    **sess_state,
                    "current_question_id": str(next_step_item.question_id) if next_step_item else None,
                    "seen_question_ids": sorted(seen_ids),
                }

                passed_code = comp.code_practice_score >= 1.0
                has_code = bundle is not None and bundle.code_challenge is not None
                mapped = map_depth_to_competency(
                    highest_passed_tier=session.highest_passed_tier,
                    passed_code_sandbox=passed_code,
                    rubric_score=grade_out.rubric_score,
                    abandoned=False,
                    steps_completed=session.steps_completed,
                    existing_depth=comp.depth_level_norm,
                    has_code_challenge=has_code,
                )
                if session.status in ("ceiling_reached", "completed") or mapped.depth_level_norm > comp.depth_level_norm:
                    new_depth = max(comp.peak_depth_level_norm, mapped.depth_level_norm)
                    comp.depth_level_norm = new_depth
                    comp.peak_depth_level_norm = new_depth
                    comp.depth_label = depth_label_for_norm(new_depth)
                    comp.confidence = max(comp.confidence, mapped.confidence)
                    if new_depth >= 0.50 and grade_out.step_passed:
                        comp.stability_s = (
                            update_stability(comp.stability_s, grade_out.step_score, passed=True)
                            if comp.last_practiced_at
                            else INITIAL_STABILITY_DAYS
                        )
                        comp.last_practiced_at = now
                    comp.updated_at = now

            session.updated_at = now
            _bump_user_state_version_if_accessible(db, user.id)
            db.flush()

            attempt_id = uuid.uuid4()
            resp_obj = AssessmentSubmitResponse(
                attempt_id=attempt_id,
                idempotent_replay=False,
                step_score=grade_out.step_score,
                step_passed=grade_out.step_passed,
                grader_source=grade_out.grader_source,
                session_status=session.status,
                next_depth_tier=next_tier_val,
                next_step_item=next_step_item,
                updated_competency=_build_competency_out(comp, stability_before=stab_before),
                tutor_feedback=tutor_feedback,
            )

            # INV-DEPTH-01: Emit CompetencyUpdatedEvent ONLY on completed / ceiling transitions
            if session.status in ("completed", "ceiling_reached"):
                action_mode = "Spaced_Review" if session.session_mode == "spaced_review" else "Deep_Probe"
                rl_mode = LearningMode.SPACED_REVIEW if action_mode == "Spaced_Review" else LearningMode.DEEP_PROBE
                obs_after = _build_domain_obs_snapshot(
                    db, user.id, session.domain_slug, catalog, target_concept_slug=concept_slug
                )
                reward_bd = MultiObjectiveRewardCalculator.compute(
                    depth_before=depth_before,
                    depth_after=float(comp.depth_level_norm),
                    retention_before=ret_before,
                    retention_after=_compute_real_retention(comp),
                    code_before=code_before,
                    code_after=float(comp.code_practice_score),
                    mode=rl_mode,
                    step_passed=grade_out.step_passed,
                )
                record_outbox_event_in_tx(
                    db,
                    event_type="CompetencyUpdatedEvent",
                    stream_name="plumora:competency_events",
                    payload={
                        "user_id": str(user.id),
                        "domain_slug": session.domain_slug,
                        "concept_slug": concept_slug,
                        "action_mode": action_mode,
                        "action_node_idx": obs_before.get("action_node_idx"),
                        "reward": reward_bd.total_reward,
                        "depth_level_norm": round(comp.depth_level_norm, 4),
                        "stability_s": round(comp.stability_s, 4),
                        "obs_before": obs_before,
                        "obs_after": obs_after,
                    },
                )

            db.add(
                AttemptRecordModel(
                    id=attempt_id,
                    user_id=user.id,
                    submission_id=payload.submission_id,
                    session_id=session.id,
                    concept_slug=concept_slug,
                    attempt_type=session.session_mode,
                    question_or_challenge_id=q.id,
                    step_score=grade_out.step_score,
                    passed=grade_out.step_passed,
                    grader_source=grade_out.grader_source,
                    response_json=resp_obj.model_dump(mode="json"),
                )
            )
        _invalidate_user_competency_cache(user.id)
        return resp_obj
    except IntegrityError as exc:
        replayed = db.scalars(
            select(AttemptRecordModel).where(
                AttemptRecordModel.user_id == user.id,
                AttemptRecordModel.submission_id == payload.submission_id,
            )
        ).first()
        if replayed is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error_code": "SUBMISSION_CONFLICT", "message": "Concurrent submission conflict."},
            ) from exc
        if replayed.session_id != session_id or replayed.question_or_challenge_id != payload.question_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error_code": "SUBMISSION_ID_CONFLICT", "message": "submission_id already used."},
            ) from exc
        cached = dict(replayed.response_json)
        cached["idempotent_replay"] = True
        return AssessmentSubmitResponse(**cached)


