# Software Design Patterns in System Design

This guide provides a pragmatic methodology for identifying problems and selecting appropriate module, object, and component-level software design patterns during Step 1.3 of Phase 1.

---

## 1. Golden Rule: Anti-Overengineering

* **No Pattern Without a Concrete Problem**: A simple function or basic CRUD operation does not warrant wrapping in five layers of Factories, Proxies, or Decorators.
* **Rule of Three as a heuristic**: Repeated variation may justify abstraction; security, transactions or external adapters can justify a pattern on first use. Record problem → simplest alternative → chosen pattern/trade-off → participants → verification.
* **Objective of Design Patterns**: Must directly serve testability, extensibility, fault isolation, or transactional integrity.

---

## 2. Pattern Selection Matrix by Problem Category

### A. Creational Patterns
Controls object instantiation and decouples callers from concrete implementations:

| Pattern | Trigger Scenario | Architectural Value | Concrete Example |
| :--- | :--- | :--- | :--- |
| **Factory Method / Abstract Factory** | Instantiating diverse objects sharing an interface based on config, environment, or vendor. | Callers remain agnostic of concrete classes; allows adding types without modifying caller code (Open-Closed Principle). | Payment gateway client factory (`StripeFactory`, `VNPayFactory`, `MoMoFactory`). |
| **Builder** | Complex object construction with numerous optional parameters or step-by-step assembly. | Eliminates telescoping constructors; readable call sites; prevents misordered arguments. | Dynamic SQL query builders, notification dispatch payloads (`NotificationBuilder`). |
| **Dependency Injection (DI)** | Managing service lifecycles and decoupling dependencies for testability. | Effortlessly swap production dependencies with test mocks; loose coupling between layers. | Injecting `UserRepository` into `AuthService` rather than calling `new UserRepository()` inside the method. |

---

### B. Structural Patterns
Organizes components and integrates disparate or external interfaces:

| Pattern | Trigger Scenario | Architectural Value | Concrete Example |
| :--- | :--- | :--- | :--- |
| **Adapter** | Integrating third-party SDKs or legacy APIs with interfaces incompatible with internal standards. | Isolates domain code from vendor changes; changing providers requires only writing a new adapter. | `S3StorageAdapter` and `GCSStorageAdapter` standardizing `IFileStorage`. |
| **Facade** | Orchestrating multiple fine-grained subsystem calls into a unified business operation. | Provides a clean, simplified entry point for clients (e.g., frontend); hides subsystem orchestration complexity. | `OrderCheckoutFacade` orchestrating inventory reservation, billing, and receipt email. |
| **Decorator / Middleware** | Adding cross-cutting behavior (logging, rate limiting, caching, auth) without altering core logic. | Composes independent behaviors into a pipeline; enforces Single Responsibility Principle. | HTTP middleware pipelines, execution timer decorators. |
| **Proxy** | Access control, lazy loading, or response caching on resource-intensive objects. | Resource conservation; guards authoritative resources against invalid invocations. | Caching proxy for rate-limited or expensive external API calls. |

---

### C. Behavioral Patterns
Distributes responsibilities and enables flexible interaction between runtime objects:

| Pattern | Trigger Scenario | Architectural Value | Concrete Example |
| :--- | :--- | :--- | :--- |
| **Strategy** | Swappable algorithms or business calculation rules selectable at runtime. | Replaces monolithic `if-else` / `switch` ladders with extensible strategy objects. | Shipping fee calculators (`ExpressShipping`, `StandardShipping`), tiered discount rules. |
| **Observer / Pub-Sub** | An event in one module triggers multiple decoupled downstream side-effects. | Loose coupling; event emitters remain unaware of subscriber count or implementations. | `OrderPlaced` event consumed independently by `EmailService`, `InventoryService`, and `LoyaltyService`. |
| **State** | Entities with complex lifecycles whose valid actions vary strictly based on state. | Encapsulates state-specific logic into dedicated classes; guards against invalid state transitions. | Booking lifecycle (`DraftState`, `ConfirmedState`, `CompletedState`, `CancelledState`). |
| **Chain of Responsibility** | A sequential pipeline where each handler inspects or mutates a request and may halt execution. | Clean addition, removal, or reordering of validation/enrichment stages. | Order processing filters: inventory check $\rightarrow$ credit limit verification $\rightarrow$ coupon validation. |

---

### D. Distributed & Resilience Patterns
Essential for distributed systems, event-driven architectures, and remote service integrations:

| Pattern | Trigger Scenario | Architectural Value |
| :--- | :--- | :--- |
| **Circuit Breaker** | Downstream dependencies (payment gateways, SMS providers) suffer intermittent errors or outages. | Trips to `Open State` on error spikes, returning immediate fallback errors to prevent cascade resource starvation. |
| **Transactional Outbox** | Mutating database state and publishing an event to a message broker (RabbitMQ/Kafka) atomically. | Persists the event within the same database transaction; a background worker relays it to the broker, preventing message loss. |
| **Saga (Orchestration / Choreography)** | Coordinating distributed transactions across independent services without two-phase commit (2PC). | Sequences local transactions paired with compensating transactions for clean rollback on partial failures. |
| **CQRS** | Systems with asymmetrical read/write ratios or divergent read vs write models. | Segregates write operations (optimized for transaction integrity) from read queries (optimized for low-latency views). |

---

## 3. Documenting Design Patterns in Architecture Specs (`docs/design.md`)

When introducing a software design pattern, document:
1. **Pattern Name & Classification**: (e.g., `Strategy Pattern - Behavioral`).
2. **Context & Justification**: Why this pattern is preferred over procedural functions.
3. **Participating Components**: Interfaces, concrete implementations, and caller boundaries.
4. **Testing Strategy**: How each component is verified in isolation via unit tests.
