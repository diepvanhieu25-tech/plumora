# Project UI/UX Screen Inventory & Anatomy Checklist

**Project Name**: `[Project / Product Name]`\
**Target Viewport**: `[Desktop 1440x900 / Mobile 390x844 / Tablet / Responsive]`\
**Stitch Project ID**: `[Stitch Project Resource ID or Pending]`\

---

## 1. Executive Summary & Design System Baseline

- **Primary Persona**: `[Target user role & core jobs-to-be-done]`
- **Architecture Baseline**: `[docs/design.md or mapped source; version and approval reference]`
- **Design System**: `[docs/ui-design-system.md or mapped source; version; Drafted / supplied via supported connector inputs]`
- **Capabilities & Schemas Checked**: `[Available operation → actual tool/schema; missing capabilities and dependent blockers]`
- **Theme & Palette**:
  - Primary Brand Token: `[#Hex / RGB]`
  - Surface Background: `[#Hex / Neutral]`
  - Contrast Ratio: Verified WCAG 2.1 AA ($\ge 4.5:1$ for normal text)

---

## 2. Comprehensive Screen Inventory Matrix

| Screen ID | Category | Screen Name | Route / Path | Core Objective & Primary CTA | Parent / Trigger | State / Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SCR-01** | Primary | `[Dashboard / Home]` | `/` | `[Overview of key metrics, CTA: "New Task"]` | Initial Entry | `[P0 / Must-Have]` |
| **SCR-02** | Primary | `[Entity Master List]` | `/[entities]` | `[Browse, filter, sort entities, CTA: "Create"]` | Nav Link | `[P0 / Must-Have]` |
| **SCR-03** | Drill-Down | `[Entity Detail View]` | `/[entities]/:id` | `[Deep inspection & edit fields, CTA: "Save"]` | Row Click | `[P0 / Must-Have]` |
| **SCR-04** | Form / Wizard | `[Create Flow Step 1]` | `/[entities]/new` | `[Data capture wizard, CTA: "Next: Review"]` | SCR-02 Button | `[P0 / Must-Have]` |
| **SCR-05** | Overlay | `[Advanced Filter Sheet]` | Drawer | `[Multi-criteria filter panel, CTA: "Apply"]` | Filter Button | `[P1 / High]` |
| **SCR-06** | Overlay | `[Destructive Confirm]` | Modal | `[Confirm entity deletion, CTA: "Delete Entity"]` | Row Menu | `[P0 / Must-Have]` |
| **SCR-07** | Edge State | `[Empty List State]` | `/[entities]` | `[Onboarding guidance, CTA: "Create First Item"]` | 0 Items Found | `[P0 / Must-Have]` |
| **SCR-08** | Edge State | `[404 / Error Boundary]` | `/*` | `[Helpful error page, CTA: "Return Home"]` | Route Mismatch | `[P1 / High]` |

---

## 3. Page Anatomy Checklist per Screen

Before passing prompts to `StitchMCP:generate_screen_from_text`, verify each screen against the 8-point anatomy checklist:

### Screen: `[Screen Name / SCR-XX]`

- [ ] **1. Navigation & Orientation**:
  - [ ] Breadcrumb trail present (`Home > Section > Screen`)
  - [ ] Active navigation tab highlighted
  - [ ] Contextual "Back" button included (if drill-down)
- [ ] **2. Search, Filter & Sort Controls**:
  - [ ] Search input with informative placeholder
  - [ ] Quick filter pills / chips defined
  - [ ] Sort order dropdown with current value indicated
- [ ] **3. Data Display & Status Visualization**:
  - [ ] Semantic status badges with explicit color tokens
  - [ ] Logical card / table grouping with consistent padding
  - [ ] Essential metadata (created date, author, tags)
- [ ] **4. Data Controls & Pagination**:
  - [ ] Total record count summary (`Showing X of Y`)
  - [ ] Page navigation controls (Previous, numbers, Next)
- [ ] **5. Action Hierarchy (Fitts's Law)**:
  - [ ] Single high-contrast Primary CTA button
  - [ ] Secondary outline / ghost actions
  - [ ] Destructive actions styled with warning treatment
  - [ ] Row-level menu (`...`) for item-specific actions
- [ ] **6. System Feedback & Alerts**:
  - [ ] Toast notification container anchor
  - [ ] Inline alert slots for system status
- [ ] **7. Empty & Loading States**:
  - [ ] Zero-state illustration and recovery action defined
  - [ ] Matching skeleton loading layout
- [ ] **8. Micro-copy & Accessibility**:
  - [ ] Tooltip triggers (`(?)`) for complex terms
  - [ ] Minimum 44x44px touch targets on interactive controls
  - [ ] WCAG 2.1 AA text-to-background contrast verified

---

## 4. Human Approval Sign-off

- [ ] **Inventory Completeness**: All 4 screen categories accounted for (no missing drill-down or edge states).
- [ ] **Anatomy Coverage**: Core controls and micro-UI elements explicitly enumerated.
- [ ] **Input Sign-Off**: Explicit authorization received before project creation or screen generation; record approver, input version, and decision reference.

## 5. Generated Output Review

State: `[draft / ready-for-review / approved / changes-requested]`. Technical inspection without defects means `ready-for-review` only. Mark inapplicable anatomy items with rationale.

| Screen / Export ID | Revision / Hash | Inspection evidence | User decision & reference | Approver | Approved scope |
| --- | --- | --- | --- | --- | --- |
| [SCR-ID / artifact] | [Exact version] | [Checks and limitations] | [Pending / approved / changes requested; decision reference] | [User] | [Screens/sections] |

Edits and variants require renewed sign-off for affected versions. Pending output approval blocks dependent UI implementation; prior inventory approval does not approve generated output.
