---
trigger: model_decision
description: "Use whenever building, refactoring, or verifying frontend UI/UX screens, Stitch designs, or reporting UI/UX completion."
---
# UI/UX Visual Fidelity & No-Fake-Pass Rule

- Never claim UI/UX work is complete or "100% PASS" solely because CI (`ci_check.sh`), unit tests, or a 1–2 screen smoke check passed.
- When aligning UI with `docs/ui-design-system.md` or `StitchMCP` screens, audit and list **every screen in scope (`SCR-09`..`SCR-20`) explicitly** — state clearly which screens were updated to match Stitch HTML and which screens were not yet touched.
- Verify on live Docker (`http://localhost:3000` after `docker compose up -d --build`) with real PostgreSQL/Redis/RL data (zero mock data/API), inspecting actual rendered screenshots across Desktop (`1280px`) and Mobile (`390px`) for every modified screen.
- Ensure all `5+2` UX states (`Ideal`, `Loading`, `Empty`, `Error`, `Disabled`, `Async Grading`, `Insufficient Evidence`) and role-based portal boundaries (`/`, `/expert/*`, `/admin/*`) work end-to-end before reporting completion.
