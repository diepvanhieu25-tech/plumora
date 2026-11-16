# Four-Axis Comprehensive Audit Checklist in Phase 3

Provides detailed verification criteria and audit methodology across four core axes during Phase 3: **(1) UI/UX & Accessibility**, **(2) Code Quality & Architecture**, **(3) Security & Hardening**, and **(4) Performance, Database & Concurrency**.

---

## 1. Axis 1: UI/UX & Accessibility Review

Objective: Verify that the delivered UI accurately reflects the design baseline approved in Phase 1, delivers smooth interaction, avoids layout shifts, and remains universally accessible.

### A. Design Fidelity & Responsive Layout
* [ ] **Design Tokens Match**: Verify colors, typography (font size, line height, weight), border radius, box shadows, and spacing (padding/margin) against `docs/design.md`.
* [ ] **Multi-Viewport Audit**:
  * Mobile Portrait (`375px` – `414px`): Zero horizontal overflow, navigation collapses to mobile drawer/bottom nav, touch targets meet minimum `44x44px`.
  * Tablet (`768px` – `1024px`): Fluid grid scaling without excessive whitespace.
  * Desktop (`1280px` – `1920px`): Max-width constraints (`max-w-7xl` or equivalent) with balanced centering.

### B. The 5 States of UX Verification
* [ ] **Empty State**: Displays clear illustrations, helpful copy, and prominent call-to-action (CTA) buttons when lists or tables are empty.
* [ ] **Loading State**: Uses **Skeleton Loaders** mirroring real content dimensions; layout shifts remain minimal (`Cumulative Layout Shift - CLS < 0.1`). Spinners are restricted to submitting buttons.
* [ ] **Error State**: User-friendly copy in plain language (never expose technical errors like `AxiosError 500`); **must include a Retry button** to re-fetch data without reloading the whole page.
* [ ] **Ideal State**: Displays populated content and available actions. Confirm completed writes with appropriate feedback.
* [ ] **Disabled State**: Unavailable actions expose their prerequisites, use correct disabled semantics, and cannot execute prematurely.

When relevant, also verify success confirmations and partial-result pagination/infinite scroll; these do not replace any of the five baseline states.

### C. Accessibility (WCAG 2.1 AA)
* [ ] **Semantic HTML**: Correct use of `<button>` for click actions, `<nav>`, `<main>`, `<header>`, `<article>`, `<footer>`. Never use `<div onClick>`.
* [ ] **Keyboard Navigation**: Sequential `Tab` order across all form fields and controls; `Enter`/`Space` activates buttons; `Escape` closes dialogs/modals.
* [ ] **Screen Reader Labels**: Icon-only buttons include descriptive `aria-label` attributes (e.g., `<button aria-label="Close dialog"><XIcon /></button>`).
* [ ] **Color Contrast**: Contrast ratio reaches at least `4.5:1` for standard text and `3:1` for large text.
* [ ] **Console & Network Hygiene**: Browser DevTools audit confirms zero uncaught errors and zero SSR hydration mismatches in console logs.

---

## 2. Axis 2: Code Quality & Architecture Review

Objective: Verify that the codebase adheres to clean layered architecture, remains maintainable, and accumulates zero technical debt.

### A. Layered Architecture Adherence (Clean Architecture)
* [ ] **Domain Layer Zero Dependencies**: Core business entities and value objects import no ORMs, web frameworks, or databases.
* [ ] **Application Layer Orchestration**: Use cases clearly encapsulate single business flows without cross-boundary bleeding.
* [ ] **Thin Presentation Layer**: Controllers/routers parse DTOs, execute schema validation, and invoke use cases; no raw SQL or business logic in controllers.

### B. Clean Code Standards (DRY / KISS / SOLID)
* [ ] **Function and File Size**: Functions remain under 50–80 lines; files remain under 300–400 lines.
* [ ] **Semantic Naming**: Identifiers describe intent clearly (e.g., `calculateInvoiceTotal` vs `calc` or `doProcess`).
* [ ] **Type Safety**: Zero usage of `any` or dangerous type assertions (`as unknown as Type`). All DTO schemas are strictly validated via Zod/Pydantic.
* [ ] **Repository Hygiene**:
  * No stray `console.log`, `print`, `debugger`, or commented-out code blocks.
  * No untracked, temporary log, or scratch files left in working tree.
  * Commits follow Conventional Commits on dedicated task branches (`feat/`, `fix/`).

---

## 3. Axis 3: Security & Hardening Review

Objective: Ensure the application contains no common vulnerabilities per the OWASP Top 10 and safeguards sensitive user data.

### A. Authentication & Authorization
* [ ] **Object-Level Access Control (Anti-IDOR / BOLA)**:
  * User A cannot access or mutate User B's records by tampering with URL parameters (e.g., `GET /api/orders/123` validates `order.user_id === current_user.id`).
* [ ] **Role-Based Access Control (RBAC / ABAC)**: Internal and administrative endpoints are guarded by strict middleware checks.
* [ ] **Token & Session Management**: JWTs enforce reasonable expirations (`exp`); Refresh Tokens are stored in `HttpOnly`, `Secure`, `SameSite=Strict` cookies; tokens invalidate upon logout.

### B. Input Validation & Injection Defense
* [ ] **SQL Injection Prevention**: 100% of queries use parameterized queries via ORM or Query Builder; string concatenation in SQL is STRICTLY FORBIDDEN.
* [ ] **Cross-Site Scripting (XSS) Prevention**: User inputs are sanitized/escaped before rendering; `dangerouslySetInnerHTML` is prohibited unless sanitized via DOMPurify.
* [ ] **Path Traversal Prevention**: File upload names and read paths are normalized; path traversal (`../`) is blocked.

### C. Secrets Management & Hardened Configuration
* [ ] **No Hardcoded Secrets**: Passwords, API keys, private certificates, and DB credentials reside in environment variables, never in source code or Git history.
* [ ] **CORS & Security Headers**: CORS restricts access to explicit whitelisted origins; HTTP security headers (CSP, X-Frame-Options, X-Content-Type-Options) are active.
* [ ] **Dependency Audit**: `scan_dependencies`, `npm audit`, or `pip-audit` confirms zero unpatched `CRITICAL` or `HIGH` CVEs in dependencies.

---

## 4. Axis 4: Performance, Database & Concurrency Review

Objective: Ensure stable execution under workload spikes, zero resource leakage, and robust concurrency control.

### A. Database Optimization & Anti-N+1 Query
* [ ] **N+1 Query Elimination**: Audit queries in loops; use `JOIN`, eager loading, or DataLoader patterns to batch fetches.
* [ ] **Indexing Strategy**: Columns frequently used in `WHERE`, `JOIN`, and `ORDER BY` (especially foreign keys) are indexed. Run `EXPLAIN ANALYZE` via Database MCP to confirm no sequential scans on large tables.
* [ ] **Large Dataset Safeguards**: All list endpoints enforce pagination limits (`limit`, `offset`, or cursor pagination). Unbounded `SELECT * FROM table` queries are prohibited.

### B. Concurrency Control & Race Condition Prevention
* [ ] **Contended Resource Locking**:
  * High-contention flows (booking slots, inventory deduction, wallet balances):
    * Use **Pessimistic Locking (`SELECT ... FOR UPDATE`)** or **Optimistic Locking (`version` checks)**.
    * Concurrency stress-tested with simultaneous requests: exactly one succeeds; concurrent conflicts return `409 Conflict`.
* [ ] **ACID Transaction Boundaries**: Multi-table write sequences reside within a single database transaction with automatic rollback on error.

### C. Resource Management & Memory Cleanup
* [ ] **Frontend**: `useEffect` hooks with event listeners, `setInterval`, or WebSockets return cleanup functions. API calls support `AbortController`.
* [ ] **Backend**: Database connection pools release idle connections; outgoing API calls enforce explicit timeouts to prevent thread starvation.
