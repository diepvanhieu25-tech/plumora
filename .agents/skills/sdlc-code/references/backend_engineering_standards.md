# Backend Engineering Standards in Phase 2

Establishes architectural principles, coding conventions, schema validation, concurrency control, data integrity, and observability standards for developers and AI coding agents developing backend services in Step 2.3 of Phase 2.

---

## 1. Clean & Layered Architecture

Strictly decouple source code following the Single Responsibility Principle and Dependency Inversion:

```
[Presentation / API Layer]  (Controllers, Routers, Middleware, DTOs Validation)
            │
            ▼
[Application / Service Layer]  (Use Cases, Business Orchestration, Transaction Boundaries)
            │
            ▼
[Domain Core Layer]  (Entities, Value Objects, Domain Events, Pure Business Rules - ZERO Deps)
            ▲
            │ (Dependency Inversion)
[Infrastructure Layer]  (Database Repositories, ORM, Cache Redis, External Adapters)
```

1. **Domain Layer (Core Business Rules)**:
   * Contains business entities, value objects, and pure domain rules.
   * **Absolute Invariant**: This layer **MUST HAVE ZERO EXTERNAL DEPENDENCIES** (no web frameworks, ORMs, third-party libraries, or database drivers).
2. **Application Layer (Use Cases / Orchestration)**:
   * Coordinates business flows for single use cases (`CreateBookingUseCase`, `CancelOrderUseCase`).
   * Manages transaction boundaries and communicates with infrastructure via interfaces/ports.
3. **Infrastructure Layer**:
   * Implements interfaces: database access via ORMs (Prisma, Drizzle, SQLAlchemy), caching (Redis), external adapters (`StripeAdapter`, `SendGridAdapter`).
4. **Presentation Layer (API & Transport)**:
   * Ingests HTTP requests, parses DTOs, executes schema validation, invokes use cases, and serializes responses.
   * Writing business logic or database queries directly in controllers/routers is STRICTLY FORBIDDEN.

---

## 2. Strict Input Validation & Standardized API Envelopes

### A. Strict Schema Validation at Ingress
* Using raw, unvalidated payloads directly from clients is **FORBIDDEN**.
* Every API endpoint ingesting payloads (body, query params, path params) must pass strict schema validation (e.g., Zod in TypeScript, Pydantic in Python, Validator in Go).
* Invalid payloads are rejected immediately at the presentation layer with `400 Bad Request` or `422 Unprocessable Entity` before reaching use cases.

---

### B. Standardized API Response Envelope
All REST API responses follow a uniform envelope structure:
```json
// Success Response:
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 100 } // if paginated
}

// Error Response:
{
  "success": false,
  "error": {
    "code": "SLOT_ALREADY_BOOKED",
    "message": "The selected time slot is already booked by another customer.",
    "details": [ ... ] // detailed validation errors if applicable
  }
}
```

---

### C. HTTP Status Code Semantics
* `200 OK`: Successful read or update query.
* `201 Created`: Resource successfully created.
* `204 No Content`: Successful deletion (zero response body).
* `400 Bad Request`: Malformed syntax or missing mandatory fields.
* `401 Unauthorized`: Missing or invalid authentication token.
* `403 Forbidden`: Authenticated identity lacks permission for resource.
* `404 Not Found`: Target resource does not exist.
* `409 Conflict`: Resource state conflict (duplicate key, double booking).
* `422 Unprocessable Entity`: Well-formed syntax violating business rules.
* `500 Internal Server Error`: Unhandled server exception (logged internally, stack trace hidden).

---

## 3. Data Integrity & Concurrency Control

1. **ACID Transactions**:
   * Workflows involving two or more write operations (Insert/Update/Delete) must execute within a database transaction.
   * Enforce automatic complete rollback if any step fails.
2. **Race Condition Prevention**:
   * For contended or limited resources (booking slots, inventory deduction, wallet balance transfer):
     * **Pessimistic Locking (`SELECT ... FOR UPDATE`)**: Lock records within a transaction during processing.
     * **Optimistic Locking (`version` check)**: Use version columns (`UPDATE table SET ... version = version + 1 WHERE id = :id AND version = :current_version`). If zero rows are affected, return `409 Conflict` prompting client retry.
3. **Idempotency Keys for State Mutations**:
   * Critical mutation APIs (payments, order creation) must support `Idempotency-Key` headers to prevent double billing upon network retries.

---

## 4. Centralized Error Handling & Observability

1. **Global Exception Handling Middleware**:
   * Uncaught exceptions are intercepted by centralized middleware and formatted into the standard error envelope.
   * Exposing stack traces, operating system paths, database table names, or connection strings to clients is **STRICTLY FORBIDDEN**.
2. **Structured Logging**:
   * Emit logs in structured JSON format with minimum fields: `timestamp`, `level` (INFO, WARN, ERROR), `request_id`, `path`, `duration_ms`, and `error_message`.

---

## 5. Backend Quality Checklist

| Category | Verification Criteria |
| :--- | :--- |
| **Backend Architecture** | Domain layer has zero external dependencies; use cases govern business boundaries; controllers delegate. |
| **Backend Validation** | 100% of endpoints enforce schema validators (Zod/Pydantic); malformed payloads rejected with 400/422. |
| **Backend Concurrency** | Multi-write flows execute in transactions; contended resources use pessimistic or optimistic locking. |
| **Backend Security** | Zero stack trace leakage in responses; passwords hashed with secure algorithms (Argon2id/bcrypt). |
| **API Envelope & Status** | Responses strictly conform to `success`, `data`, `error` envelope; HTTP status codes follow REST semantics. |
