"""Sequential Assessment Engine: Placement, Playbook, 5-Depth Probing, Code Sandbox & Ebbinghaus."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from plumora_rl.domain import (
    EbbinghausMemoryModel,
    LearningMode,
    MultiObjectiveRewardCalculator,
)
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.models import (
    AssessmentSessionModel,
    AttemptRecordModel,
    ConceptModel,
    UserConceptMasteryModel,
    UserModel,
    UserNodeCompetencyModel,
)
from app.db.uow import SqlAlchemyUnitOfWork
from app.modules.assessment.depth_state_machine import (
    advance_depth_state,
    depth_label_for_norm,
    map_depth_to_competency,
)
from app.modules.assessment.ebbinghaus import (
    INITIAL_STABILITY_DAYS,
    compute_elapsed_days,
    compute_next_review_due_at,
    compute_retention,
    is_review_needed,
    update_stability,
)
from app.modules.assessment.graders_registry import TaskGraderRegistry
from app.modules.assessment.placement_engine import (
    MAX_PLACEMENT_QUESTIONS,
    PlacementDagNavigator,
)
from app.modules.assessment.rubric_grader import (
    CircuitBreakerRubricService,
    DeterministicRubricGrader,
    LlmRubricGraderAdapter,
)
from app.modules.assessment.sandbox_worker import (
    IsolatedSandboxWorkerAdapter,
    SandboxSecurityError,
    SandboxTimeoutError,
)
from app.modules.assessment.schemas_v2 import (
    AssessmentAbandonResponse,
    AssessmentStartRequest,
    AssessmentStartResponse,
    AssessmentSubmitRequest,
    AssessmentSubmitResponse,
    CodeChallengeOut,
    CodeSandboxSubmitRequest,
    CodeSandboxSubmitResponse,
    DepthStepItem,
    PlacementAnswerRequest,
    PlacementAnswerResponse,
    PlacementInitializedNode,
    PlacementQuestionItem,
    PlacementStartResponse,
    PlaybookCompleteRequest,
    PlaybookCompleteResponse,
    TutorFeedbackOut,
    UpdatedCompetencyOut,
    V2RecommendationResponse,
    V2RecommendedAction,
)
from app.modules.contracts.adapters import get_content_catalog_port
from app.modules.contracts.dtos import ConceptNodeDTO, DepthQuestionDTO
from app.modules.contracts.ports import ContentCatalogPort
from app.modules.events.outbox import record_outbox_event_in_tx

_RUBRIC_SERVICE = CircuitBreakerRubricService(
    primary=LlmRubricGraderAdapter(timeout_s=4.0),
    fallback=DeterministicRubricGrader(),
    failure_threshold=2,
)
_GRADER_REGISTRY = TaskGraderRegistry(_RUBRIC_SERVICE)
_SANDBOX_WORKER = IsolatedSandboxWorkerAdapter()


def _bump_user_state_version_if_accessible(db: Session, user_id: uuid.UUID) -> None:
    """Increment auth_svc.users.state_version in monolith mode; safe SAVEPOINT no-op under schema isolation."""
    try:
        with db.begin_nested():
            user_row = db.get(UserModel, user_id)
            if user_row is not None:
                user_row.state_version += 1
    except SQLAlchemyError:
        pass


def _sync_v2_to_mvp_if_backend(
    db: Session,
    user_id: uuid.UUID,
    concept_slug: str,
    depth_norm: float,
) -> None:
    """Keep MVP user_concept_mastery synchronized when a Backend concept is updated in monolith mode."""
    try:
        with db.begin_nested():
            concept = db.scalars(select(ConceptModel).where(ConceptModel.slug == concept_slug)).first()
            if concept is None:
                return
            mastery = db.get(UserConceptMasteryModel, (user_id, concept.action_id))
            if mastery is None:
                db.add(
                    UserConceptMasteryModel(
                        user_id=user_id,
                        concept_action_id=concept.action_id,
                        mastery_score=depth_norm,
                        is_mastered=depth_norm >= 0.75,
                        updated_at=datetime.now(UTC),
                    )
                )
            elif depth_norm > mastery.mastery_score:
                mastery.mastery_score = depth_norm
                mastery.is_mastered = depth_norm >= 0.75
                mastery.updated_at = datetime.now(UTC)
    except SQLAlchemyError:
        return


def _get_or_create_competency(
    db: Session,
    user_id: uuid.UUID,
    concept_slug: str,
) -> UserNodeCompetencyModel:
    comp = db.get(UserNodeCompetencyModel, (user_id, concept_slug))
    if comp is None:
        comp = UserNodeCompetencyModel(
            user_id=user_id,
            concept_slug=concept_slug,
            depth_level_norm=0.0,
            peak_depth_level_norm=0.0,
            depth_label="Untested / Below Surface",
            confidence=0.0,
            stability_s=INITIAL_STABILITY_DAYS,
            last_practiced_at=None,
            playbook_completed_at=None,
            code_practice_score=0.0,
        )
        db.add(comp)
        db.flush()
    return comp


def _compute_real_retention(comp: UserNodeCompetencyModel) -> float:
    if (
        comp.last_practiced_at is not None
        and comp.depth_level_norm >= EbbinghausMemoryModel.MIN_DEPTH_FOR_RETENTION
    ):
        dt = compute_elapsed_days(comp.last_practiced_at, 0.0)
        return compute_retention(dt, comp.stability_s)
    return 1.0


def _build_competency_out(
    comp: UserNodeCompetencyModel,
    *,
    stability_before: float | None = None,
) -> UpdatedCompetencyOut:
    ret_now = _compute_real_retention(comp)
    next_due = compute_next_review_due_at(
        comp.last_practiced_at, comp.stability_s, comp.depth_level_norm
    )
    return UpdatedCompetencyOut(
        depth_level_norm=round(comp.depth_level_norm, 4),
        depth_label=comp.depth_label,
        confidence=round(comp.confidence, 4),
        stability_s=round(comp.stability_s, 4),
        stability_s_before=round(stability_before, 4) if stability_before is not None else None,
        stability_s_after=round(comp.stability_s, 4),
        retention_ebbinghaus=round(ret_now, 4),
        next_review_due_at=next_due,
    )


def _check_concept_eligible(
    db: Session,
    user_id: uuid.UUID,
    domain_slug: str | None,
    concept_slug: str,
    catalog: ContentCatalogPort,
) -> ConceptNodeDTO:
    node: ConceptNodeDTO | None = None
    if domain_slug:
        topo = catalog.get_domain_topology(domain_slug)
        if topo is not None:
            node = next((n for n in topo.nodes if n.concept_slug == concept_slug), None)
    if node is None:
        bundle = catalog.get_concept_bundle(concept_slug)
        if bundle is not None:
            node = bundle.node
    if node is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "CONCEPT_NOT_FOUND", "message": f"Concept '{concept_slug}' not found."},
        )

    for prereq_slug in node.prerequisites:
        comp = db.get(UserNodeCompetencyModel, (user_id, prereq_slug))
        if comp is None or comp.depth_level_norm < 0.75:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "CONCEPT_LOCKED",
                    "message": f"Prerequisite '{prereq_slug}' must reach Deep Understanding (>= 0.75) first.",
                },
            )
    return node


def _build_domain_obs_snapshot(
    db: Session,
    user_id: uuid.UUID,
    domain_slug: str | None,
    catalog: ContentCatalogPort,
    nodes: tuple[ConceptNodeDTO, ...] | None = None,
    *,
    target_concept_slug: str | None = None,
) -> dict[str, Any]:
    """Build structured domain observation snapshot (before/after) with real node_order & retention."""
    if not domain_slug:
        return {"domain_slug": "", "node_order": [], "action_node_idx": None, "nodes": []}
    if nodes is None:
        topo = catalog.get_domain_topology(domain_slug)
        domain_nodes = topo.nodes if topo is not None else ()
    else:
        domain_nodes = nodes
    if not domain_nodes:
        return {"domain_slug": domain_slug, "node_order": [], "action_node_idx": None, "nodes": []}

    slugs = [n.concept_slug for n in domain_nodes]
    comp_rows = db.scalars(
        select(UserNodeCompetencyModel).where(
            UserNodeCompetencyModel.user_id == user_id,
            UserNodeCompetencyModel.concept_slug.in_(slugs),
        )
    ).all()
    comp_map = {r.concept_slug: r for r in comp_rows}
    node_entries: list[dict[str, Any]] = []
    action_node_idx: int | None = None
    for idx, n in enumerate(domain_nodes):
        if target_concept_slug and n.concept_slug == target_concept_slug:
            action_node_idx = idx
        c = comp_map.get(n.concept_slug)
        depth = float(c.depth_level_norm) if c else 0.0
        conf = float(c.confidence) if c else 0.0
        ret = _compute_real_retention(c) if c is not None else 1.0
        needs_rev = 1.0 if (c is not None and is_review_needed(depth, ret)) else 0.0
        elig = (
            1.0
            if all(
                (comp_map.get(p) is not None and comp_map[p].depth_level_norm >= 0.75)
                for p in n.prerequisites
            )
            else 0.0
        )
        code_sc = float(c.code_practice_score) if c else 0.0
        feats = [
            round(depth, 4),
            round(conf, 4),
            round(ret, 4),
            elig,
            needs_rev,
            round(float(n.tier) / 4.0, 4),
            round(code_sc, 4),
            1.0,
        ]
        node_entries.append(
            {
                "concept_slug": n.concept_slug,
                "node_idx": idx,
                "mastery": round(depth, 4),
                "confidence": round(conf, 4),
                "retention": round(ret, 4),
                "eligible": elig,
                "needs_review": needs_rev > 0.5,
                "tier_norm": round(float(n.tier) / 4.0, 4),
                "code_score": round(code_sc, 4),
                "features": feats,
            }
        )
    return {
        "domain_slug": domain_slug,
        "node_order": slugs,
        "action_node_idx": action_node_idx,
        "nodes": node_entries,
    }


def _build_step_item(q: DepthQuestionDTO) -> DepthStepItem:
    rubric_summary: list[dict[str, Any]] | None = None
    if q.rubric is not None:
        rubric_summary = [
            {"name": c["name"], "weight": c["weight"]} for c in q.rubric.criteria_json
        ]
    return DepthStepItem(
        question_id=q.id,
        depth_tier=q.depth_tier,
        task_type=q.task_type,
        prompt=q.prompt,
        options=q.options_json,
        rubric_summary=rubric_summary,
    )


def _select_question_for_tier(
    questions: tuple[DepthQuestionDTO, ...],
    target_tier: int,
    seen_ids: set[str],
) -> DepthQuestionDTO | None:
    """Select an active question for target_tier, rotating away from seen_ids on retry/review."""
    tier_qs = [q for q in questions if q.is_active and q.depth_tier == target_tier]
    if not tier_qs:
        return None
    unseen = [q for q in tier_qs if str(q.id) not in seen_ids]
    return unseen[0] if unseen else tier_qs[0]


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
        _sync_v2_to_mvp_if_backend(db, user.id, concept_slug, comp.depth_level_norm)
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
        return resp_obj


def start_placement_session(
    db: Session,
    user: UserModel,
    domain_slug: str,
    catalog_port: ContentCatalogPort | None = None,
) -> PlacementStartResponse:
    """Start an Adaptive Placement session (<= 6 DAG-stepping questions, cap 0.75)."""
    catalog = catalog_port or get_content_catalog_port(db)
    topo = catalog.get_domain_topology(domain_slug)
    if topo is None or not topo.nodes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "DOMAIN_NOT_FOUND", "message": f"Domain '{domain_slug}' not found."},
        )

    nav = PlacementDagNavigator(topo.nodes)
    root_slugs = nav.initial_roots()
    first_slug = root_slugs[0]
    first_node = next(n for n in topo.nodes if n.concept_slug == first_slug)

    q_candidates = [
        q
        for q in topo.questions
        if q.is_active and q.concept_slug == first_slug and q.is_placement_eligible
    ]
    if not q_candidates:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "NO_PLACEMENT_QUESTIONS", "message": "No placement questions seeded."},
        )
    q = min(q_candidates, key=lambda x: (x.depth_tier, x.display_order))

    session = AssessmentSessionModel(
        user_id=user.id,
        domain_slug=domain_slug,
        concept_slug=None,
        session_mode="placement",
        status="active",
        current_depth_tier=1,
        steps_completed=0,
        state_json={
            "queue": root_slugs[1:],
            "visited": [first_slug],
            "passed_slugs": [],
            "failed_slugs": [],
            "initialized": [],
            "current_question_id": str(q.id),
        },
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return PlacementStartResponse(
        session_id=session.id,
        domain_slug=domain_slug,
        max_questions=MAX_PLACEMENT_QUESTIONS,
        current_question=PlacementQuestionItem(
            question_id=q.id,
            concept_slug=first_slug,
            tier=first_node.tier,
            prompt=q.prompt,
            options=q.options_json or {},
        ),
    )


def submit_placement_answer(
    db: Session,
    user: UserModel,
    domain_slug: str,
    session_id: uuid.UUID,
    payload: PlacementAnswerRequest,
    catalog_port: ContentCatalogPort | None = None,
) -> PlacementAnswerResponse:
    """Evaluate one Adaptive Placement answer with Strict Branch Ceiling & Transitive Promotion."""
    catalog = catalog_port or get_content_catalog_port(db)
    topo = catalog.get_domain_topology(domain_slug)
    if topo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "DOMAIN_NOT_FOUND", "message": f"Domain '{domain_slug}' not found."},
        )
    q_map = {q.id: q for q in topo.questions}
    node_map = {n.concept_slug: n for n in topo.nodes}
    nav = PlacementDagNavigator(topo.nodes)

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
                return PlacementAnswerResponse(**cached)

            session = db.get(AssessmentSessionModel, session_id)
            if session is None or session.user_id != user.id or session.domain_slug != domain_slug:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"error_code": "SESSION_NOT_FOUND", "message": "Placement session not found."},
                )
            if session.session_mode != "placement":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"error_code": "SESSION_MODE_MISMATCH", "message": "Session is not a placement session."},
                )
            if session.status != "active":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "error_code": "SESSION_CLOSED",
                        "message": f"Placement session is already '{session.status}'.",
                    },
                )

            q = q_map.get(payload.question_id)
            if q is None:
                other_slug = catalog.find_question_concept_slug(payload.question_id)
                if other_slug is not None and other_slug not in node_map:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail={
                            "error_code": "QUESTION_DOMAIN_MISMATCH",
                            "message": f"Question does not belong to domain '{domain_slug}'.",
                        },
                    )
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"error_code": "QUESTION_NOT_FOUND", "message": "Question not found."},
                )
            if q.concept_slug not in node_map:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "error_code": "QUESTION_DOMAIN_MISMATCH",
                        "message": f"Question does not belong to domain '{domain_slug}'.",
                    },
                )
            state = dict(session.state_json or {})
            expected_q_id = state.get("current_question_id")
            if not expected_q_id or str(payload.question_id) != str(expected_q_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "error_code": "QUESTION_STEP_MISMATCH",
                        "message": "Submitted question_id does not match the current placement question.",
                    },
                )

            passed = payload.selected_option.upper() == (q.correct_option_key or "").upper()
            obs_before = _build_domain_obs_snapshot(
                db, user.id, domain_slug, catalog, nodes=topo.nodes, target_concept_slug=q.concept_slug
            )
            queue: list[str] = list(state.get("queue", []))
            visited: list[str] = list(state.get("visited", []))
            passed_slugs: set[str] = set(state.get("passed_slugs", []))
            failed_slugs: set[str] = set(state.get("failed_slugs", []))
            initialized: list[dict[str, Any]] = list(state.get("initialized", []))

            inits, queue = nav.evaluate_step(
                concept_slug=q.concept_slug,
                passed=passed,
                queue=queue,
                visited=visited,
                passed_slugs=passed_slugs,
                failed_slugs=failed_slugs,
            )

            now = datetime.now(UTC)
            primary_comp = _get_or_create_competency(db, user.id, q.concept_slug)
            depth_before = float(primary_comp.depth_level_norm)
            ret_before = _compute_real_retention(primary_comp)
            code_before = float(primary_comp.code_practice_score)

            for node_init in inits:
                comp = _get_or_create_competency(db, user.id, node_init.concept_slug)
                if node_init.depth_level_norm > comp.depth_level_norm:
                    comp.depth_level_norm = node_init.depth_level_norm
                    comp.peak_depth_level_norm = max(
                        comp.peak_depth_level_norm, node_init.depth_level_norm
                    )
                    comp.depth_label = depth_label_for_norm(node_init.depth_level_norm)
                    comp.confidence = max(comp.confidence, node_init.confidence)
                    comp.stability_s = node_init.stability_s
                    comp.last_practiced_at = now
                    comp.playbook_completed_at = comp.playbook_completed_at or now
                    _sync_v2_to_mvp_if_backend(db, user.id, node_init.concept_slug, comp.depth_level_norm)
                elif not passed and comp.confidence == 0.0:
                    comp.confidence = node_init.confidence
                comp.updated_at = now
                initialized.append(
                    {
                        "concept_slug": node_init.concept_slug,
                        "depth_level_norm": node_init.depth_level_norm,
                        "confidence": node_init.confidence,
                        "stability_s": node_init.stability_s,
                    }
                )

            session.steps_completed += 1
            next_q_item: PlacementQuestionItem | None = None
            placement_status = "completed"

            if session.steps_completed < MAX_PLACEMENT_QUESTIONS and queue:
                while queue:
                    nxt_slug = queue.pop(0)
                    if nxt_slug in visited:
                        continue
                    visited.append(nxt_slug)
                    nxt_q = next(
                        (
                            cand_q
                            for cand_q in sorted(topo.questions, key=lambda x: (x.depth_tier, x.display_order))
                            if cand_q.is_active
                            and cand_q.concept_slug == nxt_slug
                            and cand_q.is_placement_eligible
                        ),
                        None,
                    )
                    if nxt_q is not None:
                        next_q_item = PlacementQuestionItem(
                            question_id=nxt_q.id,
                            concept_slug=nxt_slug,
                            tier=node_map[nxt_slug].tier,
                            prompt=nxt_q.prompt,
                            options=nxt_q.options_json or {},
                        )
                        placement_status = "in_progress"
                        break

            session.status = "completed" if placement_status == "completed" else "active"
            session.state_json = {
                "queue": queue,
                "visited": visited,
                "passed_slugs": sorted(passed_slugs),
                "failed_slugs": sorted(failed_slugs),
                "initialized": initialized,
                "current_question_id": str(next_q_item.question_id) if next_q_item else None,
            }
            session.updated_at = now
            _bump_user_state_version_if_accessible(db, user.id)
            db.flush()

            obs_after = _build_domain_obs_snapshot(
                db, user.id, domain_slug, catalog, nodes=topo.nodes, target_concept_slug=q.concept_slug
            )
            reward_bd = MultiObjectiveRewardCalculator.compute(
                depth_before=depth_before,
                depth_after=float(primary_comp.depth_level_norm),
                retention_before=ret_before,
                retention_after=_compute_real_retention(primary_comp),
                code_before=code_before,
                code_after=float(primary_comp.code_practice_score),
                mode=LearningMode.LEARN_NEW,
                step_passed=passed,
            )
            record_outbox_event_in_tx(
                db,
                event_type="CompetencyUpdatedEvent",
                stream_name="plumora:competency_events",
                payload={
                    "user_id": str(user.id),
                    "domain_slug": domain_slug,
                    "concept_slug": q.concept_slug,
                    "action_mode": "Learn_New",
                    "action_node_idx": obs_before.get("action_node_idx"),
                    "reward": reward_bd.total_reward,
                    "depth_level_norm": round(primary_comp.depth_level_norm, 4),
                    "stability_s": round(primary_comp.stability_s, 4),
                    "obs_before": obs_before,
                    "obs_after": obs_after,
                },
            )

            resp_obj = PlacementAnswerResponse(
                idempotent_replay=False,
                step_passed=passed,
                placement_status=placement_status,
                next_question=next_q_item,
                initialized_nodes=[PlacementInitializedNode(**item) for item in initialized],
            )
            db.add(
                AttemptRecordModel(
                    user_id=user.id,
                    submission_id=payload.submission_id,
                    session_id=session.id,
                    concept_slug=q.concept_slug,
                    attempt_type="placement",
                    question_or_challenge_id=q.id,
                    step_score=1.0 if passed else 0.0,
                    passed=passed,
                    grader_source="deterministic_mcq",
                    response_json=resp_obj.model_dump(mode="json"),
                )
            )
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
        return PlacementAnswerResponse(**cached)


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
    seen_ids: set[str] = set()
    if payload.session_mode == "spaced_review":
        prev_q_ids = db.scalars(
            select(AttemptRecordModel.question_or_challenge_id)
            .where(
                AttemptRecordModel.user_id == user.id,
                AttemptRecordModel.concept_slug == payload.concept_slug,
            )
            .order_by(AttemptRecordModel.created_at.desc())
            .limit(10)
        ).all()
        seen_ids = {str(qid) for qid in prev_q_ids}

    q = _select_question_for_tier(concept_qs, start_tier, seen_ids)
    if q is None and concept_qs:
        active_qs = [cand for cand in concept_qs if cand.is_active]
        q = active_qs[0] if active_qs else concept_qs[0]
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

        mapped = map_depth_to_competency(
            highest_passed_tier=session.highest_passed_tier,
            passed_code_sandbox=comp.code_practice_score >= 1.0,
            rubric_score=None,
            abandoned=True,
            steps_completed=session.steps_completed,
            existing_depth=comp.depth_level_norm,
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
        return AssessmentAbandonResponse(
            session_id=session.id,
            session_status=session.status,
            updated_competency=_build_competency_out(comp, stability_before=stab_before),
        )


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
    existing_fast = db.scalars(
        select(AttemptRecordModel).where(
            AttemptRecordModel.user_id == user.id,
            AttemptRecordModel.submission_id == payload.submission_id,
        )
    ).first()
    if existing_fast is not None:
        if (
            existing_fast.session_id != session_id
            or existing_fast.question_or_challenge_id != payload.question_id
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error_code": "SUBMISSION_ID_CONFLICT", "message": "submission_id already used."},
            )
        cached = dict(existing_fast.response_json)
        cached["idempotent_replay"] = True
        return AssessmentSubmitResponse(**cached)

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
                mapped = map_depth_to_competency(
                    highest_passed_tier=session.highest_passed_tier,
                    passed_code_sandbox=passed_code,
                    rubric_score=grade_out.rubric_score,
                    abandoned=False,
                    steps_completed=session.steps_completed,
                    existing_depth=comp.depth_level_norm,
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
                    _sync_v2_to_mvp_if_backend(db, user.id, concept_slug, new_depth)

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
                _sync_v2_to_mvp_if_backend(db, user.id, concept_slug, new_depth)
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
