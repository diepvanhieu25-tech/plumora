"""Adaptive Placement session start & DAG-navigated answer submission."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

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
)
from app.db.uow import SqlAlchemyUnitOfWork
from app.modules.assessment.depth_state_machine import (
    depth_label_for_norm,
)
from app.modules.assessment.placement_engine import (
    MAX_PLACEMENT_QUESTIONS,
    PlacementDagNavigator,
)
from app.modules.assessment.schemas_v2 import (
    PlacementAnswerRequest,
    PlacementAnswerResponse,
    PlacementInitializedNode,
    PlacementQuestionItem,
    PlacementStartResponse,
)
from app.modules.assessment.services.competency_helpers import (
    _build_domain_obs_snapshot,
    _bump_user_state_version_if_accessible,
    _compute_real_retention,
    _get_or_create_competency,
    _invalidate_user_competency_cache,
)
from app.shared.contracts.adapters import get_content_catalog_port
from app.shared.contracts.ports import ContentCatalogPort
from app.shared.events.outbox import record_outbox_event_in_tx

logger = logging.getLogger(__name__)


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
        return PlacementAnswerResponse(**cached)


