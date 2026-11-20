"""Service layer for Placement, 5-Depth State Machine, Code Sandbox, AI Tutor, and Ebbinghaus."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.models import (
    AssessmentSessionModel,
    AttemptRecordModel,
    CodeChallengeModel,
    ConceptModel,
    DepthQuestionModel,
    DomainConceptMapModel,
    DomainModel,
    GradingRubricModel,
    UserConceptMasteryModel,
    UserModel,
    UserNodeCompetencyModel,
)
from app.modules.assessment.depth_state_machine import (
    PASS_THRESHOLD,
    advance_depth_state,
    depth_label_for_norm,
    map_depth_to_competency,
)
from app.modules.assessment.ebbinghaus import (
    INITIAL_STABILITY_DAYS,
    compute_elapsed_days,
    compute_retention,
    is_review_needed,
    update_stability,
)
from app.modules.assessment.placement_engine import (
    MAX_PLACEMENT_QUESTIONS,
    build_placement_node_init,
)
from app.modules.assessment.rubric_grader import (
    CircuitBreakerRubricService,
    DeterministicRubricGrader,
    LlmRubricGraderAdapter,
    RubricCriterion,
)
from app.modules.assessment.sandbox_worker import (
    IsolatedSandboxWorkerAdapter,
    SandboxSecurityError,
    SandboxTimeoutError,
)
from app.modules.assessment.schemas_v2 import (
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
    TutorFeedbackOut,
    UpdatedCompetencyOut,
    V2RecommendationResponse,
    V2RecommendedAction,
)
from app.modules.events.internal_client import (
    content_service_url,
    fetch_concept_bundle_internal,
    fetch_domain_bundle_internal,
)
from app.modules.events.outbox import record_outbox_event_in_tx

_RUBRIC_SERVICE = CircuitBreakerRubricService(
    primary=LlmRubricGraderAdapter(timeout_s=4.0),
    fallback=DeterministicRubricGrader(),
    failure_threshold=2,
)
_SANDBOX_WORKER = IsolatedSandboxWorkerAdapter()


def _lock_user_for_assessment(db: Session, user_id: uuid.UUID) -> UserModel | None:
    """Acquire pessimistic per-user transaction lock; fallback to pg_advisory_xact_lock under schema isolation."""
    if db.get_bind() is not None and db.get_bind().dialect.name == "postgresql" and content_service_url():
        db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:uid))"), {"uid": str(user_id)})
        return None
    try:
        return db.scalars(select(UserModel).where(UserModel.id == user_id).with_for_update()).first()
    except SQLAlchemyError:
        db.rollback()
        if db.get_bind() is not None and db.get_bind().dialect.name == "postgresql":
            db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:uid))"), {"uid": str(user_id)})
        return None


def _sync_v2_to_mvp_if_backend(
    db: Session,
    user_id: uuid.UUID,
    concept_slug: str,
    depth_norm: float,
) -> None:
    """Keep MVP user_concept_mastery synchronized when a Backend concept is updated in v2."""
    if content_service_url():
        return
    try:
        concept = db.scalars(select(ConceptModel).where(ConceptModel.slug == concept_slug)).first()
    except SQLAlchemyError:
        db.rollback()
        return
    if concept is None:
        return
    mastery = db.get(UserConceptMasteryModel, (user_id, concept.action_id))
    if mastery is None:
        mastery = UserConceptMasteryModel(
            user_id=user_id,
            concept_action_id=concept.action_id,
            mastery_score=depth_norm,
            is_mastered=depth_norm >= 0.75,
            updated_at=datetime.now(UTC),
        )
        db.add(mastery)
    elif depth_norm > mastery.mastery_score:
        mastery.mastery_score = depth_norm
        mastery.is_mastered = depth_norm >= 0.75
        mastery.updated_at = datetime.now(UTC)


def _check_concept_eligible(
    db: Session,
    user_id: uuid.UUID,
    domain_slug: str | None,
    concept_slug: str,
) -> DomainConceptMapModel:
    if content_service_url():
        bundle = fetch_concept_bundle_internal(concept_slug)
        if bundle is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "CONCEPT_NOT_FOUND", "message": f"Concept '{concept_slug}' not found."},
            )
        n = bundle["node"]
        node = DomainConceptMapModel(
            domain_slug=str(n["domain_slug"]),
            concept_slug=str(n["concept_slug"]),
            node_idx=int(n["node_idx"]),
            title=str(n["title"]),
            tier=int(n["tier"]),
            is_shared=bool(n["is_shared"]),
            prerequisites_json=list(n.get("prerequisites_json", [])),
        )
    else:
        from app.modules.content.kg_service import sync_mvp_mastery_to_v2_competency

        sync_mvp_mastery_to_v2_competency(db, user_id)
        node_opt = db.get(DomainConceptMapModel, (domain_slug, concept_slug)) if domain_slug else None
        if node_opt is None:
            node_opt = db.scalars(
                select(DomainConceptMapModel).where(DomainConceptMapModel.concept_slug == concept_slug)
            ).first()
        if node_opt is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "CONCEPT_NOT_FOUND", "message": f"Concept '{concept_slug}' not found."},
            )
        node = node_opt

    for prereq_slug in node.prerequisites_json:
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


def _question_from_dict(qd: dict[str, Any]) -> DepthQuestionModel:
    return DepthQuestionModel(
        id=uuid.UUID(str(qd["id"])),
        concept_slug=str(qd["concept_slug"]),
        depth_tier=int(qd["depth_tier"]),
        task_type=str(qd["task_type"]),
        prompt=str(qd["prompt"]),
        options_json=qd.get("options_json"),
        correct_option_key=qd.get("correct_option_key"),
        is_placement_eligible=bool(qd.get("is_placement_eligible")),
    )


def _rubric_from_dict(q_id: uuid.UUID, r_dict: dict[str, Any]) -> GradingRubricModel:
    return GradingRubricModel(
        id=uuid.uuid4(),
        question_id=q_id,
        criteria_json=list(r_dict.get("criteria_json", [])),
        reference_explanation=str(r_dict.get("reference_explanation", "")),
    )


def _get_domain_bundle_or_db(
    db: Session,
    domain_slug: str,
) -> tuple[list[DomainConceptMapModel], dict[uuid.UUID, DepthQuestionModel], dict[uuid.UUID, GradingRubricModel]]:
    if content_service_url():
        bundle = fetch_domain_bundle_internal(domain_slug)
        if bundle is None:
            return [], {}, {}
        nodes = [
            DomainConceptMapModel(
                domain_slug=str(n["domain_slug"]),
                concept_slug=str(n["concept_slug"]),
                node_idx=int(n["node_idx"]),
                title=str(n["title"]),
                tier=int(n["tier"]),
                is_shared=bool(n["is_shared"]),
                prerequisites_json=list(n.get("prerequisites_json", [])),
            )
            for n in bundle.get("nodes", [])
        ]
        q_map: dict[uuid.UUID, DepthQuestionModel] = {}
        r_map: dict[uuid.UUID, GradingRubricModel] = {}
        for qd in bundle.get("questions", []):
            q_obj = _question_from_dict(qd)
            q_map[q_obj.id] = q_obj
            if qd.get("rubric"):
                r_map[q_obj.id] = _rubric_from_dict(q_obj.id, qd["rubric"])
        return nodes, q_map, r_map

    nodes = list(
        db.scalars(
            select(DomainConceptMapModel)
            .where(DomainConceptMapModel.domain_slug == domain_slug)
            .order_by(DomainConceptMapModel.node_idx)
        ).all()
    )
    slugs = [n.concept_slug for n in nodes]
    qs = (
        db.scalars(
            select(DepthQuestionModel)
            .where(DepthQuestionModel.concept_slug.in_(slugs))
            .order_by(DepthQuestionModel.depth_tier)
        ).all()
        if slugs
        else []
    )
    q_map = {q.id: q for q in qs}
    r_rows = (
        db.scalars(select(GradingRubricModel).where(GradingRubricModel.question_id.in_(list(q_map.keys())))).all()
        if q_map
        else []
    )
    r_map = {r.question_id: r for r in r_rows}
    return nodes, q_map, r_map


def _get_concept_bundle_or_db(
    db: Session,
    concept_slug: str,
) -> tuple[list[DepthQuestionModel], dict[uuid.UUID, GradingRubricModel], CodeChallengeModel | None]:
    if content_service_url():
        bundle = fetch_concept_bundle_internal(concept_slug)
        if bundle is None:
            return [], {}, None
        qs: list[DepthQuestionModel] = []
        r_map: dict[uuid.UUID, GradingRubricModel] = {}
        for qd in bundle.get("questions", []):
            q_obj = _question_from_dict(qd)
            qs.append(q_obj)
            if qd.get("rubric"):
                r_map[q_obj.id] = _rubric_from_dict(q_obj.id, qd["rubric"])
        ch_d = bundle.get("code_challenge")
        ch_obj = (
            CodeChallengeModel(
                id=uuid.UUID(str(ch_d["id"])),
                concept_slug=str(ch_d["concept_slug"]),
                title=str(ch_d["title"]),
                language=str(ch_d["language"]),
                prompt=str(ch_d["prompt"]),
                buggy_starter_code=str(ch_d["buggy_starter_code"]),
                test_cases_json=list(ch_d["test_cases_json"]),
                timeout_ms=int(ch_d["timeout_ms"]),
                memory_limit_mb=int(ch_d["memory_limit_mb"]),
            )
            if ch_d
            else None
        )
        return qs, r_map, ch_obj

    qs = list(
        db.scalars(
            select(DepthQuestionModel)
            .where(DepthQuestionModel.concept_slug == concept_slug)
            .order_by(DepthQuestionModel.depth_tier)
        ).all()
    )
    q_ids = [q.id for q in qs]
    r_rows = (
        db.scalars(select(GradingRubricModel).where(GradingRubricModel.question_id.in_(q_ids))).all()
        if q_ids
        else []
    )
    r_map = {r.question_id: r for r in r_rows}
    ch_obj = db.scalars(
        select(CodeChallengeModel).where(CodeChallengeModel.concept_slug == concept_slug)
    ).first()
    return qs, r_map, ch_obj


def _build_domain_obs_snapshot(
    db: Session,
    user_id: uuid.UUID,
    domain_slug: str | None,
    nodes: list[DomainConceptMapModel] | None = None,
    *,
    target_concept_slug: str | None = None,
) -> dict[str, Any]:
    """Build structured domain observation snapshot (before/after) with real node_order & retention."""
    if not domain_slug:
        return {"domain_slug": "", "node_order": [], "action_node_idx": None, "nodes": []}
    domain_nodes = nodes if nodes is not None else _get_domain_bundle_or_db(db, domain_slug)[0]
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
        if c is not None and c.last_practiced_at is not None:
            dt = compute_elapsed_days(c.last_practiced_at, 0.0)
            ret = float(compute_retention(dt, float(c.stability_s)))
        else:
            ret = 1.0
        needs_rev = 1.0 if (c is not None and is_review_needed(depth, ret)) else 0.0
        elig = 1.0 if all(
            (comp_map.get(p) is not None and comp_map[p].depth_level_norm >= 0.75)
            for p in n.prerequisites_json
        ) else 0.0
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


def _build_step_item(
    db: Session,
    q: DepthQuestionModel,
    rubric_map: dict[uuid.UUID, GradingRubricModel] | None = None,
) -> DepthStepItem:
    rubric_summary: list[dict[str, Any]] | None = None
    rubric = rubric_map.get(q.id) if rubric_map is not None else None
    if rubric is None and not content_service_url():
        rubric = db.scalars(
            select(GradingRubricModel).where(GradingRubricModel.question_id == q.id)
        ).first()
    if rubric is not None:
        rubric_summary = [
            {"name": c["name"], "weight": c["weight"]} for c in rubric.criteria_json
        ]
    return DepthStepItem(
        question_id=q.id,
        depth_tier=q.depth_tier,
        task_type=q.task_type,
        prompt=q.prompt,
        options=q.options_json,
        rubric_summary=rubric_summary,
    )


def start_placement_session(
    db: Session,
    user: UserModel,
    domain_slug: str,
) -> PlacementStartResponse:
    """Start an Adaptive Placement session (<= 6 DAG-stepping questions, cap 0.75)."""
    if content_service_url():
        bundle = fetch_domain_bundle_internal(domain_slug)
        if bundle is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "DOMAIN_NOT_FOUND", "message": f"Domain '{domain_slug}' not found."},
            )
        nodes = [
            DomainConceptMapModel(
                domain_slug=str(n["domain_slug"]),
                concept_slug=str(n["concept_slug"]),
                node_idx=int(n["node_idx"]),
                title=str(n["title"]),
                tier=int(n["tier"]),
                is_shared=bool(n["is_shared"]),
                prerequisites_json=list(n.get("prerequisites_json", [])),
            )
            for n in bundle.get("nodes", [])
        ]
        root_slugs = [n.concept_slug for n in nodes if not n.prerequisites_json]
        first_slug = root_slugs[0] if root_slugs else nodes[0].concept_slug
        first_node = next(n for n in nodes if n.concept_slug == first_slug)
        q_dicts = [
            qd for qd in bundle.get("questions", [])
            if qd["concept_slug"] == first_slug and qd.get("is_placement_eligible")
        ]
        if not q_dicts:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "NO_PLACEMENT_QUESTIONS", "message": "No placement questions seeded."},
            )
        qd0 = min(q_dicts, key=lambda x: int(x["depth_tier"]))
        q = DepthQuestionModel(
            id=uuid.UUID(str(qd0["id"])),
            concept_slug=str(qd0["concept_slug"]),
            depth_tier=int(qd0["depth_tier"]),
            task_type=str(qd0["task_type"]),
            prompt=str(qd0["prompt"]),
            options_json=qd0.get("options_json"),
            correct_option_key=qd0.get("correct_option_key"),
            is_placement_eligible=bool(qd0.get("is_placement_eligible")),
        )
    else:
        domain = db.get(DomainModel, domain_slug)
        if domain is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "DOMAIN_NOT_FOUND", "message": f"Domain '{domain_slug}' not found."},
            )

        nodes = list(
            db.scalars(
                select(DomainConceptMapModel)
                .where(DomainConceptMapModel.domain_slug == domain_slug)
                .order_by(DomainConceptMapModel.node_idx)
            ).all()
        )
        root_slugs = [n.concept_slug for n in nodes if not n.prerequisites_json]
        first_slug = root_slugs[0] if root_slugs else nodes[0].concept_slug
        first_node = next(n for n in nodes if n.concept_slug == first_slug)

        q_opt = db.scalars(
            select(DepthQuestionModel)
            .where(
                DepthQuestionModel.concept_slug == first_slug,
                DepthQuestionModel.is_placement_eligible.is_(True),
            )
            .order_by(DepthQuestionModel.depth_tier)
        ).first()
        if q_opt is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "NO_PLACEMENT_QUESTIONS", "message": "No placement questions seeded."},
            )
        q = q_opt

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
) -> PlacementAnswerResponse:
    """Evaluate one Adaptive Placement answer, step up DAG or stop branch, cap at 0.75."""
    # Lock user row BEFORE idempotency check to eliminate race conditions (F-G3-03)
    locked_user = _lock_user_for_assessment(db, user.id)

    existing = db.scalars(
        select(AttemptRecordModel).where(
            AttemptRecordModel.user_id == user.id,
            AttemptRecordModel.submission_id == payload.submission_id,
        )
    ).first()
    if existing is not None:
        if existing.session_id != session_id or existing.question_or_challenge_id != payload.question_id:
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

    nodes, q_map, _ = _get_domain_bundle_or_db(db, domain_slug)
    q = q_map.get(payload.question_id)
    if q is None and not content_service_url():
        q = db.get(DepthQuestionModel, payload.question_id)
    if q is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "QUESTION_NOT_FOUND", "message": "Question not found."},
        )
    node_map = {n.concept_slug: n for n in nodes}
    curr_node = node_map.get(q.concept_slug)
    if curr_node is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "QUESTION_DOMAIN_MISMATCH",
                "message": f"Question does not belong to domain '{domain_slug}'.",
            },
        )
    state_check = dict(session.state_json or {})
    expected_q_id = state_check.get("current_question_id")
    if not expected_q_id or str(payload.question_id) != str(expected_q_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "QUESTION_STEP_MISMATCH",
                "message": "Submitted question_id does not match the current placement question.",
            },
        )

    passed = payload.selected_option.upper() == (q.correct_option_key or "").upper()
    node_init = build_placement_node_init(q.concept_slug, curr_node.tier, passed)
    obs_before_snap = _build_domain_obs_snapshot(
        db, user.id, domain_slug, nodes=nodes, target_concept_slug=q.concept_slug
    )

    # Persist competency (without overwriting higher existing peak)
    comp = db.get(UserNodeCompetencyModel, (user.id, q.concept_slug))
    if comp is None:
        comp = UserNodeCompetencyModel(
            user_id=user.id,
            concept_slug=q.concept_slug,
            depth_level_norm=node_init.depth_level_norm,
            peak_depth_level_norm=node_init.depth_level_norm,
            depth_label=depth_label_for_norm(node_init.depth_level_norm),
            confidence=node_init.confidence,
            stability_s=node_init.stability_s,
            last_practiced_at=datetime.now(UTC) if passed else None,
        )
        db.add(comp)
    elif node_init.depth_level_norm > comp.depth_level_norm:
        comp.depth_level_norm = node_init.depth_level_norm
        comp.peak_depth_level_norm = max(comp.peak_depth_level_norm, node_init.depth_level_norm)
        comp.depth_label = depth_label_for_norm(node_init.depth_level_norm)
        comp.confidence = node_init.confidence
        comp.stability_s = node_init.stability_s
        comp.last_practiced_at = datetime.now(UTC)
    if passed:
        _sync_v2_to_mvp_if_backend(db, user.id, q.concept_slug, comp.depth_level_norm)

    state = dict(session.state_json)
    queue: list[str] = list(state.get("queue", []))
    visited: list[str] = list(state.get("visited", []))
    initialized: list[dict[str, Any]] = list(state.get("initialized", []))
    initialized.append(
        {
            "concept_slug": node_init.concept_slug,
            "depth_level_norm": node_init.depth_level_norm,
            "confidence": node_init.confidence,
            "stability_s": node_init.stability_s,
        }
    )

    if passed:
        # Enqueue direct children of current node in next tier
        for candidate in nodes:
            if (
                q.concept_slug in candidate.prerequisites_json
                and candidate.concept_slug not in visited
                and candidate.concept_slug not in queue
            ):
                queue.append(candidate.concept_slug)

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
                    for cand_q in sorted(q_map.values(), key=lambda x: x.depth_tier)
                    if cand_q.concept_slug == nxt_slug and cand_q.is_placement_eligible
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
        "initialized": initialized,
        "current_question_id": str(next_q_item.question_id) if next_q_item else None,
    }
    session.updated_at = datetime.now(UTC)

    resp_obj = PlacementAnswerResponse(
        idempotent_replay=False,
        step_passed=passed,
        placement_status=placement_status,
        next_question=next_q_item,
        initialized_nodes=[PlacementInitializedNode(**item) for item in initialized],
    )
    if locked_user is not None:
        locked_user.state_version += 1

    db.flush()
    obs_after_snap = _build_domain_obs_snapshot(
        db, user.id, domain_slug, nodes=nodes, target_concept_slug=q.concept_slug
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
            "action_node_idx": obs_before_snap.get("action_node_idx"),
            "reward": 1.0 if passed else -0.25,
            "depth_level_norm": round(comp.depth_level_norm, 4),
            "stability_s": round(comp.stability_s, 4),
            "obs_before": obs_before_snap,
            "obs_after": obs_after_snap,
        },
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
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
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
    return resp_obj


def start_depth_or_review_session(
    db: Session,
    user: UserModel,
    payload: AssessmentStartRequest,
) -> AssessmentStartResponse:
    """Start a 5-Depth Probing or Spaced Review session after verifying DAG eligibility."""
    _check_concept_eligible(db, user.id, payload.domain_slug, payload.concept_slug)

    comp = db.get(UserNodeCompetencyModel, (user.id, payload.concept_slug))
    start_tier = 1
    if payload.session_mode == "depth_probe" and comp is not None and comp.depth_level_norm >= 0.50 or payload.session_mode == "spaced_review":
        start_tier = 3

    concept_qs, rubric_map, _ = _get_concept_bundle_or_db(db, payload.concept_slug)
    q = next((cand for cand in concept_qs if cand.depth_tier == start_tier), None)
    if q is None and concept_qs:
        q = concept_qs[0]
    if q is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "NO_QUESTIONS", "message": "No depth questions for concept."},
        )

    session = AssessmentSessionModel(
        user_id=user.id,
        domain_slug=payload.domain_slug,
        concept_slug=payload.concept_slug,
        session_mode=payload.session_mode,
        status="active",
        current_depth_tier=q.depth_tier,
        consecutive_fails_at_tier=0,
        highest_passed_tier=0,
        steps_completed=0,
        state_json={"current_question_id": str(q.id)},
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return AssessmentStartResponse(
        session_id=session.id,
        concept_slug=payload.concept_slug,
        session_mode=payload.session_mode,
        current_depth_tier=q.depth_tier,
        step_item=_build_step_item(db, q, rubric_map),
    )


def submit_depth_or_review_step(
    db: Session,
    user: UserModel,
    session_id: uuid.UUID,
    payload: AssessmentSubmitRequest,
) -> AssessmentSubmitResponse:
    """Submit a step in 5-Depth Probing or Spaced Review with Rubric + AI Tutor + Ebbinghaus."""
    # Lock user row BEFORE idempotency check to eliminate race conditions (F-G3-03)
    locked_user = _lock_user_for_assessment(db, user.id)

    existing = db.scalars(
        select(AttemptRecordModel).where(
            AttemptRecordModel.user_id == user.id,
            AttemptRecordModel.submission_id == payload.submission_id,
        )
    ).first()
    if existing is not None:
        if existing.session_id != session_id or existing.question_or_challenge_id != payload.question_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error_code": "SUBMISSION_ID_CONFLICT", "message": "submission_id already used."},
            )
        cached = dict(existing.response_json)
        cached["idempotent_replay"] = True
        return AssessmentSubmitResponse(**cached)

    session = db.get(AssessmentSessionModel, session_id)
    if session is None or session.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "SESSION_NOT_FOUND", "message": "Assessment session not found."},
        )
    if session.session_mode not in ("depth_probe", "spaced_review"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "SESSION_MODE_MISMATCH", "message": "Invalid session mode for depth/review submit."},
        )
    if session.status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "SESSION_CLOSED",
                "message": f"Assessment session is already '{session.status}'.",
            },
        )

    concept_slug_lookup = session.concept_slug or ""
    concept_qs, rubric_map, _ = _get_concept_bundle_or_db(db, concept_slug_lookup)
    q = next((cand for cand in concept_qs if cand.id == payload.question_id), None)
    if q is None and not content_service_url():
        q = db.get(DepthQuestionModel, payload.question_id)
    if q is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "QUESTION_NOT_FOUND", "message": "Question not found."},
        )
    if session.concept_slug and q.concept_slug != session.concept_slug:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "QUESTION_SESSION_MISMATCH",
                "message": f"Question does not belong to concept '{session.concept_slug}'.",
            },
        )
    sess_state = dict(session.state_json or {})
    expected_q_id = sess_state.get("current_question_id")
    if expected_q_id and str(payload.question_id) != str(expected_q_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "QUESTION_STEP_MISMATCH",
                "message": "Submitted question_id does not match the current assessment step.",
            },
        )
    if session.session_mode == "depth_probe" and q.depth_tier != session.current_depth_tier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "QUESTION_TIER_MISMATCH",
                "message": f"Expected depth tier {session.current_depth_tier}, got tier {q.depth_tier}.",
            },
        )

    tutor_feedback: TutorFeedbackOut | None = None
    rubric_score_val: float | None = None

    if q.task_type == "mcq":
        if not payload.selected_option:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"error_code": "ANSWER_REQUIRED", "message": "selected_option is required for MCQ."},
            )
        step_passed = payload.selected_option.upper() == (q.correct_option_key or "").upper()
        step_score = 1.0 if step_passed else 0.0
        grader_source = "deterministic_mcq"
    else:
        explanation = (payload.written_explanation or "").strip()
        if len(explanation) < 10:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error_code": "EXPLANATION_TOO_SHORT",
                    "message": "Written explanation must be at least 10 characters.",
                },
            )
        rubric = rubric_map.get(q.id)
        if rubric is None and not content_service_url():
            rubric = db.scalars(
                select(GradingRubricModel).where(GradingRubricModel.question_id == q.id)
            ).first()
        criteria = [
            RubricCriterion(
                name=str(c["name"]),
                weight=float(c["weight"]),
                required_keywords=[str(k) for k in c["required_keywords"]],
            )
            for c in (rubric.criteria_json if rubric else [])
        ]
        ref_exp = rubric.reference_explanation if rubric else ""
        grade_res = _RUBRIC_SERVICE.grade_with_fallback(
            prompt=q.prompt,
            written_explanation=explanation,
            criteria=criteria,
            reference_explanation=ref_exp,
        )
        step_score = grade_res.rubric_score
        rubric_score_val = grade_res.rubric_score
        step_passed = step_score >= PASS_THRESHOLD
        grader_source = grade_res.grader_source
        tutor_feedback = TutorFeedbackOut(
            summary=grade_res.tutor_summary,
            criteria_results=grade_res.criteria_results,
        )

    concept_slug = session.concept_slug or q.concept_slug
    obs_before_snap = _build_domain_obs_snapshot(
        db, user.id, session.domain_slug, target_concept_slug=concept_slug
    )
    comp = db.get(UserNodeCompetencyModel, (user.id, concept_slug))
    if comp is None:
        comp = UserNodeCompetencyModel(
            user_id=user.id,
            concept_slug=concept_slug,
            depth_level_norm=0.0,
            peak_depth_level_norm=0.0,
            depth_label="Untested / Below Surface",
            confidence=0.0,
            stability_s=INITIAL_STABILITY_DAYS,
            last_practiced_at=None,
            code_practice_score=0.0,
        )
        db.add(comp)

    session.steps_completed += 1
    next_step_item: DepthStepItem | None = None

    if session.session_mode == "spaced_review":
        # Spaced Review completes in 1 step and updates Ebbinghaus stability S_new
        session.status = "completed"
        new_s = update_stability(comp.stability_s, step_score)
        comp.stability_s = new_s
        if step_passed:
            comp.last_practiced_at = datetime.now(UTC)
            ret_now = 1.0
        else:
            dt = compute_elapsed_days(comp.last_practiced_at, 0.0)
            ret_now = compute_retention(dt, new_s)
        comp.updated_at = datetime.now(UTC)
        next_tier_val = None
    else:
        trans = advance_depth_state(
            current_tier=session.current_depth_tier,
            consecutive_fails=session.consecutive_fails_at_tier,
            highest_passed_tier=session.highest_passed_tier,
            step_score=step_score,
        )
        session.status = trans.next_status
        session.consecutive_fails_at_tier = trans.consecutive_fails_at_tier
        session.highest_passed_tier = trans.highest_passed_tier
        next_tier_val = trans.next_depth_tier
        if trans.next_depth_tier is not None:
            session.current_depth_tier = trans.next_depth_tier
            nxt_q = next((cand for cand in concept_qs if cand.depth_tier == trans.next_depth_tier), None)
            if nxt_q is not None:
                next_step_item = _build_step_item(db, nxt_q, rubric_map)
        session.state_json = {
            **sess_state,
            "current_question_id": str(next_step_item.question_id) if next_step_item else None,
        }

        # Update competency when session finishes or when highest tier increases
        passed_code = comp.code_practice_score >= 1.0
        mapped = map_depth_to_competency(
            highest_passed_tier=session.highest_passed_tier,
            passed_code_sandbox=passed_code,
            rubric_score=rubric_score_val,
            abandoned=False,
            steps_completed=session.steps_completed,
            existing_depth=comp.depth_level_norm,
        )
        if session.status in ("ceiling_reached", "completed") or mapped.depth_level_norm > comp.depth_level_norm:
            # High-water mark preservation (INV-MASTERY-01)
            new_depth = max(comp.peak_depth_level_norm, mapped.depth_level_norm)
            comp.depth_level_norm = new_depth
            comp.peak_depth_level_norm = new_depth
            comp.depth_label = depth_label_for_norm(new_depth)
            comp.confidence = max(comp.confidence, mapped.confidence)
            if new_depth >= 0.50:
                comp.stability_s = update_stability(comp.stability_s, step_score) if comp.last_practiced_at else INITIAL_STABILITY_DAYS
                comp.last_practiced_at = datetime.now(UTC)
            comp.updated_at = datetime.now(UTC)
            _sync_v2_to_mvp_if_backend(db, user.id, concept_slug, new_depth)
        ret_now = 1.0

    session.updated_at = datetime.now(UTC)
    attempt_id = uuid.uuid4()
    resp_obj = AssessmentSubmitResponse(
        attempt_id=attempt_id,
        idempotent_replay=False,
        step_score=step_score,
        step_passed=step_passed,
        grader_source=grader_source,
        session_status=session.status,
        next_depth_tier=next_tier_val,
        next_step_item=next_step_item,
        updated_competency=UpdatedCompetencyOut(
            depth_level_norm=round(comp.depth_level_norm, 4),
            depth_label=comp.depth_label,
            confidence=round(comp.confidence, 4),
            stability_s=round(comp.stability_s, 4),
            retention_ebbinghaus=round(ret_now, 4),
        ),
        tutor_feedback=tutor_feedback,
    )
    if locked_user is not None:
        locked_user.state_version += 1

    action_mode = "Spaced_Review" if session.session_mode == "spaced_review" else "Deep_Probe"
    db.flush()
    obs_after_snap = _build_domain_obs_snapshot(
        db, user.id, session.domain_slug, target_concept_slug=concept_slug
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
            "action_node_idx": obs_before_snap.get("action_node_idx"),
            "reward": round(float(step_score) * 2.0 - 0.5, 4),
            "depth_level_norm": round(comp.depth_level_norm, 4),
            "stability_s": round(comp.stability_s, 4),
            "obs_before": obs_before_snap,
            "obs_after": obs_after_snap,
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
            step_score=step_score,
            passed=step_passed,
            grader_source=grader_source,
            response_json=resp_obj.model_dump(mode="json"),
        )
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
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
    return resp_obj


def get_code_challenge_for_concept(
    db: Session,
    user: UserModel,
    concept_slug: str,
) -> CodeChallengeOut:
    """Fetch public Code Sandbox challenge for a concept after verifying DAG eligibility."""
    _check_concept_eligible(db, user.id, None, concept_slug)
    _, _, ch = _get_concept_bundle_or_db(db, concept_slug)
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
) -> CodeSandboxSubmitResponse:
    """Execute user code in isolated sandbox worker, enforce limits, and update competency."""
    # Lock user row BEFORE idempotency check to eliminate race conditions (F-G3-03)
    locked_user = _lock_user_for_assessment(db, user.id)

    existing = db.scalars(
        select(AttemptRecordModel).where(
            AttemptRecordModel.user_id == user.id,
            AttemptRecordModel.submission_id == payload.submission_id,
        )
    ).first()
    if existing is not None:
        if existing.concept_slug != concept_slug or existing.question_or_challenge_id != payload.challenge_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error_code": "SUBMISSION_ID_CONFLICT", "message": "submission_id already used."},
            )
        cached = dict(existing.response_json)
        cached["idempotent_replay"] = True
        return CodeSandboxSubmitResponse(**cached)

    node = _check_concept_eligible(db, user.id, None, concept_slug)

    _, _, ch = _get_concept_bundle_or_db(db, concept_slug)
    if ch is None or ch.id != payload.challenge_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "CODE_CHALLENGE_NOT_FOUND", "message": "Challenge not found."},
        )

    try:
        exec_res = _SANDBOX_WORKER.execute(
            language=payload.language,
            source_code=payload.source_code,
            test_cases=ch.test_cases_json,
            timeout_ms=ch.timeout_ms,
            memory_limit_mb=ch.memory_limit_mb,
        )
    except SandboxTimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail={"error_code": exc.error_code, "message": str(exc)},
        ) from exc
    except SandboxSecurityError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error_code": exc.error_code, "message": str(exc)},
        ) from exc

    obs_before_snap = _build_domain_obs_snapshot(
        db, user.id, node.domain_slug, target_concept_slug=concept_slug
    )
    comp = db.get(UserNodeCompetencyModel, (user.id, concept_slug))
    if comp is None:
        comp = UserNodeCompetencyModel(
            user_id=user.id,
            concept_slug=concept_slug,
            depth_level_norm=0.0,
            peak_depth_level_norm=0.0,
            depth_label="Untested / Below Surface",
            confidence=0.0,
            stability_s=INITIAL_STABILITY_DAYS,
            last_practiced_at=None,
            code_practice_score=0.0,
        )
        db.add(comp)

    comp.code_practice_score = max(comp.code_practice_score, exec_res.code_score)
    if exec_res.code_score >= 1.0:
        # Passing 100% code sandbox elevates to Deep Understanding (0.75) or Mastery (1.00 if >= 0.75)
        new_depth = 1.00 if comp.depth_level_norm >= 0.75 else 0.75
        new_depth = max(comp.peak_depth_level_norm, new_depth)
        comp.depth_level_norm = new_depth
        comp.peak_depth_level_norm = new_depth
        comp.depth_label = depth_label_for_norm(new_depth)
        comp.confidence = max(comp.confidence, 0.95 if new_depth >= 1.0 else 0.85)
        comp.stability_s = update_stability(comp.stability_s, exec_res.code_score) if comp.last_practiced_at else INITIAL_STABILITY_DAYS
        comp.last_practiced_at = datetime.now(UTC)
        _sync_v2_to_mvp_if_backend(db, user.id, concept_slug, new_depth)
    comp.updated_at = datetime.now(UTC)

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
        updated_competency=UpdatedCompetencyOut(
            depth_level_norm=round(comp.depth_level_norm, 4),
            depth_label=comp.depth_label,
            confidence=round(comp.confidence, 4),
            stability_s=round(comp.stability_s, 4),
            retention_ebbinghaus=1.0,
        ),
    )
    if locked_user is not None:
        locked_user.state_version += 1

    db.flush()
    obs_after_snap = _build_domain_obs_snapshot(
        db, user.id, node.domain_slug, target_concept_slug=concept_slug
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
            "action_node_idx": obs_before_snap.get("action_node_idx"),
            "reward": round(float(exec_res.code_score) * 2.0 - 0.5, 4),
            "depth_level_norm": round(comp.depth_level_norm, 4),
            "stability_s": round(comp.stability_s, 4),
            "obs_before": obs_before_snap,
            "obs_after": obs_after_snap,
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
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
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
    return resp_obj


def recommend_v2_next_step(
    db: Session,
    user: UserModel,
    domain_slug: str,
) -> V2RecommendationResponse:
    """Rule-guarded v2 recommendation (prioritizing Ebbinghaus Needs Review, then eligible DAG nodes)."""
    from app.modules.content.kg_service import get_domain_roadmap_for_user

    roadmap = get_domain_roadmap_for_user(db, user.id, domain_slug, 0.0)
    review_nodes = [n for n in roadmap.nodes if n.needs_review]
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

    # Prefer lowest tier eligible incomplete node
    target = min(eligible_incomplete, key=lambda n: (n.tier, n.depth_level_norm, n.node_idx))
    if target.depth_level_norm >= 0.75:
        mode = "Code_Practice"
        reason = "Đã hiểu bản chất (75%), hãy thực hành Code Sandbox để đạt Làm chủ (100%)."
    elif target.depth_level_norm >= 0.25:
        mode = "Deep_Probe"
        reason = "Đang ở mức cơ bản, hãy đào sâu 5 tầng để mở khóa các khái niệm tiếp theo."
    else:
        mode = "Learn_New"
        reason = "Khái niệm đã mở khóa theo đồ thị tiên quyết DAG, sẵn sàng học và kiểm tra."

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
