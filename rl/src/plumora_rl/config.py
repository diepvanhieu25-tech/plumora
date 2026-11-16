"""Authoritative 12-Concept Backend DAG and RL Constants (D-05, D-06, D-07, D-08)."""

from __future__ import annotations

from dataclasses import dataclass

OBS_DIM: int = 24
ACT_DIM: int = 12
PASS_THRESHOLD: float = 0.75
MAX_STEPS: int = 40

TRAIN_SEEDS: tuple[int, ...] = (101, 202, 303)
VAL_SEED: int = 999
VAL_EPISODES: int = 200
EVAL_SEED: int = 2026
EVAL_EPISODES: int = 500


@dataclass(frozen=True)
class ConceptSpec:
    """Immutable specification of a single Backend learning concept node."""

    action_id: int
    slug: str
    title: str
    tier: int
    prerequisites: tuple[int, ...]


CONCEPTS_DAG: tuple[ConceptSpec, ...] = (
    ConceptSpec(0, "net-internet", "Internet & Mô hình Mạng cơ bản", 1, ()),
    ConceptSpec(1, "os-basics", "Hệ điều hành, Process/Thread & I/O cơ bản", 1, ()),
    ConceptSpec(2, "web-http", "Giao thức HTTP/HTTPS", 2, (0,)),
    ConceptSpec(3, "db-relational", "CSDL Quan hệ & SQL cơ bản", 2, (1,)),
    ConceptSpec(4, "db-transactions", "Transaction (ACID) & Indexing trong RDBMS", 2, (3,)),
    ConceptSpec(5, "db-nosql", "CSDL NoSQL (Document & Key-Value Store)", 2, (3,)),
    ConceptSpec(6, "api-rest", "Thiết kế RESTful API chuẩn", 3, (2,)),
    ConceptSpec(7, "api-validation", "Validation, Serialization & Xử lý lỗi API", 3, (6,)),
    ConceptSpec(8, "api-data", "Kết nối API với Database & Query Patterns", 3, (4, 6)),
    ConceptSpec(9, "cache-redis", "Caching & Quản lý State với Redis", 3, (5, 6)),
    ConceptSpec(10, "sec-authn", "Xác thực & Phân quyền (Session/JWT, RBAC)", 4, (6, 9)),
    ConceptSpec(11, "sec-api", "Bảo mật API cơ bản (SQLi, Rate Limit, CORS)", 4, (7, 8, 10)),
)
