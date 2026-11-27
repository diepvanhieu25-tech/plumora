"""Playbook Completion, 3-Phase UoW Isolated Code Sandbox & Rule-Guarded Fallback."""

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
    AttemptRecordModel,
    UserModel,
    UserNodeCompetencyModel,
)
from app.db.uow import SqlAlchemyUnitOfWork
from app.modules.assessment.depth_state_machine import (
    depth_label_for_norm,
)
from app.modules.assessment.sandbox_worker import (
    SandboxSecurityError,
    SandboxTimeoutError,
)
from app.modules.assessment.schemas_v2 import (
    CodeChallengeOut,
    CodeSandboxSubmitRequest,
    CodeSandboxSubmitResponse,
    PlaybookCompleteRequest,
    PlaybookCompleteResponse,
    V2RecommendationResponse,
    V2RecommendedAction,
)
from app.modules.assessment.services.competency_helpers import (
    _SANDBOX_WORKER,
    _build_competency_out,
    _build_domain_obs_snapshot,
    _bump_user_state_version_if_accessible,
    _check_concept_eligible,
    _compute_real_retention,
    _get_or_create_competency,
    _invalidate_user_competency_cache,
)
from app.shared.contracts.adapters import get_content_catalog_port
from app.shared.contracts.ports import ContentCatalogPort
from app.shared.ebbinghaus import (
    INITIAL_STABILITY_DAYS,
    update_stability,
)
from app.shared.events.outbox import record_outbox_event_in_tx

logger = logging.getLogger(__name__)


def complete_concept_playbook(
    db: Session,
    user: UserModel,
    domain_slug: str,
    concept_slug: str,
    payload: PlaybookCompleteRequest,
    catalog_port: ContentCatalogPort | None = None,
) -> PlaybookCompleteResponse:
    """Mark Playbook completed (INV-SEQ-01): elevates 0.0 -> 0.25 (Surface) or 0.50 with Quick Check."""
    catalog = catalog_port or get_content_catalog_port(db)
    _check_concept_eligible(db, user.id, domain_slug, concept_slug, catalog)

    sub_id = payload.submission_id
    uow = SqlAlchemyUnitOfWork(db)
    with uow.atomic_user_mutation(user.id):
        if sub_id is not None:
            existing = db.scalars(
                select(AttemptRecordModel).where(
                    AttemptRecordModel.user_id == user.id,
                    AttemptRecordModel.submission_id == sub_id,
                )
            ).first()
            if existing is not None:
                cached = dict(existing.response_json)
                cached["idempotent_replay"] = True
                return PlaybookCompleteResponse(**cached)

        obs_before = _build_domain_obs_snapshot(
            db, user.id, domain_slug, catalog, target_concept_slug=concept_slug
        )
        comp = _get_or_create_competency(db, user.id, concept_slug)
        depth_before = float(comp.depth_level_norm)
        ret_before = _compute_real_retention(comp)
        code_before = float(comp.code_practice_score)
        stab_before = float(comp.stability_s)

        # Evaluate optional Quick Concept Check answers against Tier 1-2 active MCQs
        target_depth = 0.25
        target_conf = 0.55
        if payload.quick_check_answers:
            bundle = catalog.get_concept_bundle(concept_slug)
            q_by_id = {str(q.id): q for q in (bundle.questions if bundle else ())}
            correct = 0
            evaluated = 0
            for ans in payload.quick_check_answers:
                q_obj = q_by_id.get(str(ans.get("question_id", "")))
                if q_obj is not None and q_obj.correct_option_key:
                    evaluated += 1
                    if str(ans.get("selected_option", "")).upper() == q_obj.correct_option_key.upper():
                        correct += 1
            if evaluated > 0 and (correct / evaluated) >= 0.75:
                target_depth = 0.50
                target_conf = 0.70

        now = datetime.now(UTC)
        comp.playbook_completed_at = comp.playbook_completed_at or now
        if target_depth > comp.depth_level_norm:
            comp.depth_level_norm = target_depth
            comp.peak_depth_level_norm = max(comp.peak_depth_level_norm, target_depth)
            comp.depth_label = depth_label_for_norm(target_depth)
            comp.confidence = max(comp.confidence, target_conf)
            if target_depth >= 0.50:
                comp.last_practiced_at = now
        comp.updated_at = now
        _bump_user_state_version_if_accessible(db, user.id)
        db.flush()

        ret_after = _compute_real_retention(comp)
        obs_after = _build_domain_obs_snapshot(
            db, user.id, domain_slug, catalog, target_concept_slug=concept_slug
        )
        reward_bd = MultiObjectiveRewardCalculator.compute(
            depth_before=depth_before,
            depth_after=float(comp.depth_level_norm),
            retention_before=ret_before,
            retention_after=ret_after,
            code_before=code_before,
            code_after=float(comp.code_practice_score),
            mode=LearningMode.LEARN_NEW,
            step_passed=True,
        )
        record_outbox_event_in_tx(
            db,
            event_type="CompetencyUpdatedEvent",
            stream_name="plumora:competency_events",
            payload={
                "user_id": str(user.id),
                "domain_slug": domain_slug,
                "concept_slug": concept_slug,
                "action_mode": "Learn_New",
                "action_node_idx": obs_before.get("action_node_idx"),
                "reward": reward_bd.total_reward,
                "depth_level_norm": round(comp.depth_level_norm, 4),
                "stability_s": round(comp.stability_s, 4),
                "obs_before": obs_before,
                "obs_after": obs_after,
            },
        )
        resp_obj = PlaybookCompleteResponse(
            domain_slug=domain_slug,
            concept_slug=concept_slug,
            playbook_completed=True,
            idempotent_replay=False,
            updated_competency=_build_competency_out(comp, stability_before=stab_before),
        )
        if sub_id is not None:
            db.add(
                AttemptRecordModel(
                    user_id=user.id,
                    submission_id=sub_id,
                    session_id=None,
                    concept_slug=concept_slug,
                    attempt_type="playbook_complete",
                    question_or_challenge_id=uuid.uuid5(uuid.NAMESPACE_DNS, concept_slug),
                    step_score=1.0,
                    passed=True,
                    grader_source="playbook_completion",
                    response_json=resp_obj.model_dump(mode="json"),
                )
            )
    _invalidate_user_competency_cache(user.id)
    return resp_obj



def get_code_challenge_for_concept(
    db: Session,
    user: UserModel,
    concept_slug: str,
    domain_slug: str | None = None,
    catalog_port: ContentCatalogPort | None = None,
) -> CodeChallengeOut:
    """Fetch active public Code Sandbox challenge for a concept after verifying DAG eligibility."""
    catalog = catalog_port or get_content_catalog_port(db)
    _check_concept_eligible(db, user.id, domain_slug, concept_slug, catalog)
    bundle = catalog.get_concept_bundle(concept_slug)
    ch = bundle.code_challenge if bundle is not None else None
    if ch is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "CODE_CHALLENGE_NOT_FOUND",
                "message": f"No code challenge configured for '{concept_slug}'.",
            },
        )
    public_cases = [
        {"name": tc["name"], "call": tc["call"], "expected": tc["expected"]}
        for tc in ch.test_cases_json
        if not tc.get("is_hidden", False)
    ]
    return CodeChallengeOut(
        challenge_id=ch.id,
        concept_slug=ch.concept_slug,
        title=ch.title,
        language=ch.language,
        prompt=ch.prompt,
        buggy_starter_code=ch.buggy_starter_code,
        public_test_cases=public_cases,
        timeout_ms=ch.timeout_ms,
        memory_limit_mb=ch.memory_limit_mb,
    )


def submit_code_sandbox(
    db: Session,
    user: UserModel,
    concept_slug: str,
    payload: CodeSandboxSubmitRequest,
    domain_slug: str | None = None,
    catalog_port: ContentCatalogPort | None = None,
) -> CodeSandboxSubmitResponse:
    """3-Phase UoW Code Sandbox execution enforcing INV-SEQ-01, INV-SEQ-02 & INV-SANDBOX-01."""
    catalog = catalog_port or get_content_catalog_port(db)

    # Phase 1: Fast idempotency & eligibility read (no DB lock)
    existing_fast = db.scalars(
        select(AttemptRecordModel).where(
            AttemptRecordModel.user_id == user.id,
            AttemptRecordModel.submission_id == payload.submission_id,
        )
    ).first()
    if existing_fast is not None:
        if (
            existing_fast.concept_slug != concept_slug
            or existing_fast.question_or_challenge_id != payload.challenge_id
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error_code": "SUBMISSION_ID_CONFLICT", "message": "submission_id already used."},
            )
        cached = dict(existing_fast.response_json)
        cached["idempotent_replay"] = True
        return CodeSandboxSubmitResponse(**cached)

    node = _check_concept_eligible(db, user.id, domain_slug, concept_slug, catalog)

    comp_preview = db.get(UserNodeCompetencyModel, (user.id, concept_slug))
    playbook_done = comp_preview is not None and (
        comp_preview.playbook_completed_at is not None or comp_preview.depth_level_norm >= 0.25
    )
    if not playbook_done:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "PLAYBOOK_NOT_COMPLETED",
                "message": "Complete the concept Playbook lesson before submitting Code Sandbox solutions.",
            },
        )

    bundle = catalog.get_concept_bundle(concept_slug)
    ch = bundle.code_challenge if bundle is not None else None
    if ch is None or ch.id != payload.challenge_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "CODE_CHALLENGE_NOT_FOUND", "message": "Challenge not found."},
        )

    # Phase 2: Execute isolated sandbox worker OUTSIDE any DB lock
    try:
        exec_res = _SANDBOX_WORKER.execute(
            language=payload.language,
            source_code=payload.source_code,
            test_cases=ch.test_cases_json,
            timeout_ms=ch.timeout_ms,
            memory_limit_mb=ch.memory_limit_mb,
            setup_sql=ch.setup_sql,
        )
    except SandboxTimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail={"error_code": exc.error_code, "message": str(exc)},
        ) from exc
    except SandboxSecurityError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"error_code": exc.error_code, "message": str(exc)},
        ) from exc

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
                    existing.concept_slug != concept_slug
                    or existing.question_or_challenge_id != payload.challenge_id
                ):
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail={"error_code": "SUBMISSION_ID_CONFLICT", "message": "submission_id already used."},
                    )
                cached = dict(existing.response_json)
                cached["idempotent_replay"] = True
                return CodeSandboxSubmitResponse(**cached)

            obs_before = _build_domain_obs_snapshot(
                db, user.id, node.domain_slug, catalog, target_concept_slug=concept_slug
            )
            comp = _get_or_create_competency(db, user.id, concept_slug)
            depth_before = float(comp.depth_level_norm)
            ret_before = _compute_real_retention(comp)
            code_before = float(comp.code_practice_score)
            stab_before = float(comp.stability_s)

            comp.code_practice_score = max(comp.code_practice_score, exec_res.code_score)
            now = datetime.now(UTC)
            if exec_res.code_score >= 1.0:
                # INV-SEQ-02: Passing 100% code when depth < 0.75 caps at 0.50 (Applied);
                # reaching 1.00 Mastery strictly requires BOTH depth >= 0.75 AND code_practice_score >= 1.0.
                new_depth = 1.00 if comp.depth_level_norm >= 0.75 else max(comp.depth_level_norm, 0.50)
                new_depth = max(comp.peak_depth_level_norm, new_depth)
                comp.depth_level_norm = new_depth
                comp.peak_depth_level_norm = new_depth
                comp.depth_label = depth_label_for_norm(new_depth)
                comp.confidence = max(comp.confidence, 0.95 if new_depth >= 1.0 else 0.75)
                comp.stability_s = (
                    update_stability(comp.stability_s, exec_res.code_score, passed=True)
                    if comp.last_practiced_at
                    else INITIAL_STABILITY_DAYS
                )
                comp.last_practiced_at = now
            comp.updated_at = now
            _bump_user_state_version_if_accessible(db, user.id)
            db.flush()

            hidden_names = {
                str(tc["name"]) for tc in ch.test_cases_json if tc.get("is_hidden", False)
            }
            sanitized_results = [
                (
                    {
                        "name": r.get("name"),
                        "passed": bool(r.get("passed")),
                        "is_hidden": True,
                        **({"error": "Hidden test execution failed"} if "error" in r else {}),
                    }
                    if r.get("is_hidden") or r.get("name") in hidden_names
                    else r
                )
                for r in exec_res.test_results
            ]

            attempt_id = uuid.uuid4()
            resp_obj = CodeSandboxSubmitResponse(
                attempt_id=attempt_id,
                idempotent_replay=False,
                passed_tests=exec_res.passed_tests,
                total_tests=exec_res.total_tests,
                code_score=exec_res.code_score,
                runtime_ms=exec_res.runtime_ms,
                memory_kb=exec_res.memory_kb,
                test_results=sanitized_results,
                updated_competency=_build_competency_out(comp, stability_before=stab_before),
            )

            obs_after = _build_domain_obs_snapshot(
                db, user.id, node.domain_slug, catalog, target_concept_slug=concept_slug
            )
            reward_bd = MultiObjectiveRewardCalculator.compute(
                depth_before=depth_before,
                depth_after=float(comp.depth_level_norm),
                retention_before=ret_before,
                retention_after=_compute_real_retention(comp),
                code_before=code_before,
                code_after=float(comp.code_practice_score),
                mode=LearningMode.CODE_PRACTICE,
                step_passed=exec_res.code_score >= 1.0,
            )
            record_outbox_event_in_tx(
                db,
                event_type="CompetencyUpdatedEvent",
                stream_name="plumora:competency_events",
                payload={
                    "user_id": str(user.id),
                    "domain_slug": node.domain_slug,
                    "concept_slug": concept_slug,
                    "action_mode": "Code_Practice",
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
                    session_id=None,
                    concept_slug=concept_slug,
                    attempt_type="code_sandbox",
                    question_or_challenge_id=ch.id,
                    step_score=exec_res.code_score,
                    passed=exec_res.code_score >= 1.0,
                    grader_source="isolated_sandbox",
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
        if replayed.concept_slug != concept_slug or replayed.question_or_challenge_id != payload.challenge_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error_code": "SUBMISSION_ID_CONFLICT", "message": "submission_id already used."},
            ) from exc
        cached = dict(replayed.response_json)
        cached["idempotent_replay"] = True
        return CodeSandboxSubmitResponse(**cached)


def recommend_v2_next_step(
    db: Session,
    user: UserModel,
    domain_slug: str,
) -> V2RecommendationResponse:
    """Rule-guarded fallback recommendation respecting INV-SEQ-01, INV-SEQ-03 & Ebbinghaus review."""
    from app.modules.content.kg_service import get_domain_roadmap_for_user

    roadmap = get_domain_roadmap_for_user(db, user.id, domain_slug, 0.0)
    review_nodes = sorted(
        [n for n in roadmap.nodes if n.needs_review],
        key=lambda n: n.retention_ebbinghaus,
    )
    if review_nodes:
        target = review_nodes[0]
        return V2RecommendationResponse(
            domain_slug=domain_slug,
            status="active",
            recommended_action=V2RecommendedAction(
                concept_slug=target.slug,
                title=target.title,
                tier=target.tier,
                learning_mode="Spaced_Review",
                reason_vi=f"Độ nhớ Ebbinghaus giảm còn {int(target.retention_ebbinghaus * 100)}% (< 60%), cần ôn tập ngay.",
            ),
            policy_source="fallback_rule",
            state_source="postgres_fallback",
            guardrail_applied=True,
            retention_alert=True,
            checkpoint_sha256="",
        )

    eligible_incomplete = [n for n in roadmap.nodes if n.is_eligible and n.depth_level_norm < 1.0]
    if not eligible_incomplete:
        return V2RecommendationResponse(
            domain_slug=domain_slug,
            status="completed",
            recommended_action=None,
            policy_source="fallback_rule",
            state_source="postgres_fallback",
            guardrail_applied=True,
            retention_alert=False,
            checkpoint_sha256="",
        )

    target = min(eligible_incomplete, key=lambda n: (n.tier, n.depth_level_norm, n.node_idx))
    if target.depth_level_norm >= 0.75 and target.has_code_challenge and target.code_practice_score < 1.0:
        mode = "Code_Practice"
        reason = "Đã hiểu bản chất (75%), hãy thực hành Code Sandbox để đạt Làm chủ (100%)."
    elif target.depth_level_norm >= 0.25 or target.playbook_completed:
        mode = "Deep_Probe"
        reason = "Đã hoàn thành lý thuyết nền tảng, hãy đào sâu 5 tầng để nâng mức hiểu và mở khóa nhánh tiếp theo."
    else:
        mode = "Learn_New"
        reason = "Khái niệm đã mở khóa theo đồ thị tiên quyết DAG, hãy đọc bài giảng Playbook trước."

    return V2RecommendationResponse(
        domain_slug=domain_slug,
        status="active",
        recommended_action=V2RecommendedAction(
            concept_slug=target.slug,
            title=target.title,
            tier=target.tier,
            learning_mode=mode,
            reason_vi=reason,
        ),
        policy_source="fallback_rule",
        state_source="postgres_fallback",
        guardrail_applied=True,
        retention_alert=False,
        checkpoint_sha256="",
    )
