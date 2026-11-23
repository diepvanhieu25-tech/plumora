"""Pydantic schemas for Multi-Domain Knowledge Graph endpoints."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class DomainUserSummary(BaseModel):
    """Per-domain user competency summary across 4 depth levels + Ebbinghaus review count."""

    surface_count: int
    applied_count: int
    deep_count: int
    mastery_count: int
    needs_review_count: int
    placement_completed: bool


class DomainListItem(BaseModel):
    """Summary card for a Knowledge Graph domain."""

    slug: str
    title: str
    description: str
    total_nodes: int
    shared_nodes_count: int
    graph_version: int
    user_summary: DomainUserSummary


class DomainsListResponse(BaseModel):
    """Response for GET /api/v2/domains."""

    domains: list[DomainListItem]


class DomainRoadmapNode(BaseModel):
    """Node item in GET /api/v2/domains/{slug}/roadmap."""

    node_idx: int
    slug: str
    title: str
    tier: int
    is_shared: bool
    prerequisites: list[str]
    prerequisite_titles: list[dict[str, str]] = Field(default_factory=list)
    lesson_markdown: str
    depth_level_norm: float
    depth_label: str
    confidence: float
    stability_s: float
    retention_ebbinghaus: float
    is_eligible: bool
    needs_review: bool
    code_practice_score: float
    has_code_challenge: bool = False
    playbook_completed: bool = False
    last_practiced_at: datetime | None = None
    next_review_due_at: datetime | None = None


class DomainRoadmapResponse(BaseModel):
    """Response for GET /api/v2/domains/{slug}/roadmap."""

    domain_slug: str
    domain_title: str
    graph_version: int
    nodes: list[DomainRoadmapNode]


class ConceptPlaybookDetailResponse(BaseModel):
    """Response for GET /api/v2/domains/{domain_slug}/concepts/{concept_slug}."""

    domain_slug: str
    domain_title: str
    node: DomainRoadmapNode
