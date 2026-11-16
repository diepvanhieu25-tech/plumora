# Frontend Engineering Standards in Phase 2

Establishes architectural principles, coding conventions, state management, 5 UX states, and accessibility (`a11y`) standards for developers and AI coding agents building frontend interfaces in Step 2.3 of Phase 2.

---

## 1. Feature-Driven Component Architecture

Structure directories vertically by domain feature (`Feature-First`) rather than piling components into monolithic folders:

```text
src/
├── features/
│   ├── booking/
│   │   ├── components/         # Feature-specific UI components
│   │   │   ├── BookingCalendar.tsx
│   │   │   └── ServiceSelector.tsx
│   │   ├── hooks/              # Custom domain hooks (e.g., useBookingFlow)
│   │   ├── api/                # API fetchers & TanStack Query hooks
│   │   │   └── bookingApi.ts
│   │   └── types/              # Domain types & Zod schemas
│   │       └── booking.types.ts
├── components/                 # Shared generic UI components (Button, Modal, Input)
├── hooks/                      # Shared utility hooks (useMediaQuery, useDebounce)
├── layouts/                    # Application shells (Header, Sidebar, Shell)
└── lib/                        # Shared client utilities (axios instance, theme tokens)
```

1. **Separation of Presentational and Container Components**:
   * **Presentational (Dumb) Components**: Ingest data via `props`, emit events via callbacks, render UI. Never call APIs or mutate global state directly.
   * **Container (Smart) Components**: Act as orchestration bridges; invoke query hooks or global state and pass data down to presentational components.

---

## 2. State Management: Clear Server State vs Client State Separation

1. **Server State (API Data)**:
   * Mandatory use of specialized libraries: **TanStack Query (React Query)** or **SWR**.
   * Maximize automated capabilities: caching, refetch on window focus, automated retries, and request cancellation via `AbortController` on unmount.
   * **STRICTLY FORBIDDEN** to synchronize API data into raw `useState` combined with manual `useEffect` fetch calls. That anti-pattern causes stale state, memory leaks, and duplicated loading/error flag logic.
2. **Client UI State (Pure Interface State)**:
   * Retain only local interaction state: modal open/closed, light/dark theme, form wizard step.
   * Use lightweight primitives (`Zustand` or bounded `React Context`); avoid heavy Redux boilerplates for simple interface state.

---

## 3. The 5 States of UX Implementation

Every screen and dynamic data component must handle all 5 UX states approved in Phase 1:

1. **Empty State**:
   * When data collections are empty, render clean illustrations, informative copy, and clear call-to-action buttons (e.g., *"No appointments yet. Book your first appointment!"*).
2. **Loading State**:
   * **Skeleton Loaders are mandatory**, matching the dimensions of actual content to eliminate layout shift (`Cumulative Layout Shift - CLS < 0.1`).
   * Spinners are restricted to submitting buttons or rapid inline updates.
3. **Error State**:
   * Render helpful, user-friendly error messages (never expose technical errors like `Network Error 500`).
   * **A Retry button is mandatory** allowing users to re-fetch data without full page reloads.
4. **Ideal State**:
   * Render complete content; format currencies, numbers, and dates via locale standards (`Intl.DateTimeFormat`, `Intl.NumberFormat`).
   * Mutation actions (create/update/delete) trigger confirmation Toast notifications.
5. **Disabled State**:
   * Make unavailable actions non-executable with correct disabled semantics and explain unmet prerequisites.

Success confirmations and partial-result pagination/infinite scroll are additional feedback states where relevant; they do not replace these five baseline states.

---

## 4. Semantic HTML & Accessibility (`a11y`)

1. **Semantic HTML Tags**:
   * Use `<button>` for clickable actions; using `<div onClick={...}>` is **FORBIDDEN** because it breaks keyboard navigation.
   * Use structural landmarks: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`.
2. **Keyboard Navigation & Screen Reader Support**:
   * Users can `Tab` sequentially through interactive controls in logical DOM order.
   * `Enter`/`Space` activates buttons and submits forms; `Escape` closes modals and dialogs.
   * Icon-only buttons must declare an `aria-label` (e.g., `<button aria-label="Close dialog"><CloseIcon /></button>`).
3. **Color Contrast (WCAG AA)**:
   * Contrast ratio must reach at least `4.5:1` for body text and `3:1` for large text against backgrounds.

---

## 5. Type Safety & Form Management

1. **Schema-Driven Form Validation**:
   * Mandatory integration of **React Hook Form** with **Zod Resolver**.
   * Define validation schemas once in Zod, infer TypeScript types automatically (`type BookingFormValues = z.infer<typeof bookingSchema>`).
   * Render field validation errors immediately upon blur or submit.
2. **End-to-End Type Safety**:
   * Share TypeScript DTO interfaces between frontend and backend or generate client types from OpenAPI / GraphQL / tRPC. Never use `any`.

---

## 6. Frontend Quality Checklist

| Category | Verification Criteria |
| :--- | :--- |
| **Frontend Architecture** | Feature-driven structure; dumb/smart component separation; zero components exceeding 300 lines. |
| **Frontend State** | Strict separation between Server State (TanStack Query) and Client State (Zustand); zero raw fetch in `useEffect`. |
| **Frontend UX States** | All 5 baseline states (Ideal, Loading, Empty, Error, Disabled) handled on primary views; success confirmations and partial results verified where relevant. |
| **Frontend a11y** | Semantic HTML tags used; full keyboard navigation (`Tab`, `Enter`, `Escape`); WCAG AA contrast. |
| **Full-stack Types** | 100% of codebase avoids `any`; DTO types synchronized between client and server APIs. |
