"""Hexagonal Architecture Contracts: Pure DTOs, Ports, and Monolith/Microservice Adapters."""

from app.shared.contracts.adapters import (
    CachedHttpContentCatalogAdapter,
    HttpCompetencyReaderAdapter,
    SqlCompetencyReaderAdapter,
    SqlContentCatalogAdapter,
    get_competency_reader_port,
    get_content_catalog_port,
)
from app.shared.contracts.dtos import (
    CodeChallengeDTO,
    ConceptBundleDTO,
    ConceptNodeDTO,
    DepthQuestionDTO,
    DomainTopologyDTO,
    GradingRubricDTO,
    StandardErrorDetail,
    UserCompetencySnapshotDTO,
    UserNodeCompetencyDTO,
)
from app.shared.contracts.ports import CompetencyReaderPort, ContentCatalogPort

__all__ = [
    "CachedHttpContentCatalogAdapter",
    "CodeChallengeDTO",
    "CompetencyReaderPort",
    "ConceptBundleDTO",
    "ConceptNodeDTO",
    "ContentCatalogPort",
    "DepthQuestionDTO",
    "DomainTopologyDTO",
    "GradingRubricDTO",
    "HttpCompetencyReaderAdapter",
    "SqlCompetencyReaderAdapter",
    "SqlContentCatalogAdapter",
    "StandardErrorDetail",
    "UserCompetencySnapshotDTO",
    "UserNodeCompetencyDTO",
    "get_competency_reader_port",
    "get_content_catalog_port",
]
