"""Plumora FastAPI Modular Monolith Application Package."""

import sys
from pathlib import Path

_RL_SRC_DIR = Path(__file__).resolve().parents[2] / "rl" / "src"
if _RL_SRC_DIR.is_dir() and str(_RL_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_RL_SRC_DIR))
