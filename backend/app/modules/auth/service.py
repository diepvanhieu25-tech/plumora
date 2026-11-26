"""Authentication constants and seed competency presets."""

from __future__ import annotations

DEMO_PASSWORD = "PlumoraDemo#2026"

PRESET_COMPETENCY_MAPS: dict[str, dict[str, float]] = {
    "new_learner": {},
    "foundation_ready": {
        "net-internet": 1.00,
        "os-basics": 0.75,
        "web-http": 0.75,
        "db-relational": 0.75,
        "db-nosql": 0.25,
    },
    "api_stage_ready": {
        "net-internet": 1.00,
        "os-basics": 1.00,
        "web-http": 1.00,
        "db-relational": 1.00,
        "db-transactions": 0.75,
        "db-nosql": 0.75,
        "api-rest": 0.75,
    },
}
