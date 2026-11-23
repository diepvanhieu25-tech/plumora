"""Application Boundary Ports (Protocols) unifying Monolith DB and Microservice HTTP access."""

from __future__ import annotations

import uuid
from typing import Protocol

from app.modules.contracts.dtos import (
    ConceptBundleDTO,
    DomainTopologyDTO,
    UserCompetencySnapshotDTO,
)


class ContentCatalogPort(Protocol):
    """Port for reading multi-domain Knowledge Graph topology and concept assessment bundles."""

    def get_domain_topology(self, domain_slug: str) -> DomainTopologyDTO | None:
        """Return domain DAG topology and questions, or None if domain does not exist."""
        ...

    def get_concept_bundle(self, concept_slug: str) -> ConceptBundleDTO | None:
        """Return concept node, questions/rubrics, and code challenge, or None if not found."""
        ...

    def find_question_concept_slug(self, question_id: uuid.UUID) -> str | None:
        """Return the concept_slug owning question_id if it exists in any domain, else None."""
        ...


class CompetencyReaderPort(Protocol):
    """Port for reading learner cross-domain competencies, state_version, and placement status."""

    def get_user_competency_snapshot(self, user_id: uuid.UUID) -> UserCompetencySnapshotDTO:
        """Return the learner's authoritative competency snapshot."""
        ...
