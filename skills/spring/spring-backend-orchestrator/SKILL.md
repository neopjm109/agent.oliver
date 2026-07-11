---
name: spring-backend-orchestrator
description: Orchestrates the Spring Boot backend implementation for a feature by coordinating its specialized generators — domain, API, security, event, messaging, Redis, scheduler, batch, migration, config-properties, observability, notification, file-storage, WebSocket, API-docs, and test. Selected by backend-orchestrator when target_stack.backend is spring.
version: 1.0.0
category: backend
tags:
  - orchestrator
  - backend
  - spring
  - domain
  - api
model: inherit
invokes:
  - domain-generator
  - api-generator
  - security-generator
  - event-generator
  - messaging-generator
  - redis-generator
  - scheduler-generator
  - batch-generator
  - migration-generator
  - config-properties-generator
  - observability-generator
  - notification-generator
  - file-storage-generator
  - websocket-generator
  - api-docs-generator
  - spring-test-generator
inputs:
  - feature
  - application_blueprint
  - target_stack
outputs:
  - backend_artifact
---

# Goal

Generate the complete Spring Boot backend for a feature by orchestrating domain modeling,
API layer, security, eventing/messaging, caching, scheduling, batch, migrations, and
tests. This skill **never generates implementation code directly** — it delegates to
specialized generators (which in turn delegate implementation to spring-senior-programmer)
and merges the results. It is the `spring` stack target of `backend-orchestrator`.

# Inputs

```yaml
feature:
  id: FEAT-ORDER
  name: Place Order
  stories: [...]
  tasks: [...]
application_blueprint: {...}
target_stack:
  backend: spring
```

# Output

```yaml
backend_artifact:
  domain: entities + value objects + domain services + aggregates + rules
  api: controllers + DTOs + request/response + mappers
  security: authn/authz + role/permission model + config
  events: domain/integration events + handlers
  messaging: topics/queues + publishers + consumers (broker)
  redis: cache keys + TTL + locks
  scheduler: scheduled triggers
  batch: bulk-processing jobs
  migrations: schema migrations
  config: typed @ConfigurationProperties + secrets binding
  observability: structured logging + metrics + tracing + health indicators
  notification: email/SMS/push delivery
  file_storage: uploads + object storage + signed URLs
  websocket: client-facing real-time endpoints
  api_docs: runtime OpenAPI/Swagger
  tests: unit + integration + API tests
```

# Workflow

## Step 1 — Analyze backend scope
Determine domain boundaries, API needs, security constraints, event/messaging needs, caching, scheduling, batch, and migrations from the feature.

## Step 2 — Generate domain layer
Invoke `domain-generator` → entities, value objects, domain services, aggregates, rules (framework-independent).

## Step 3 — Generate API layer
Invoke `api-generator` → controllers, DTOs, request/response models, mappers (thin; no business logic).

## Step 4 — Generate security
If required, invoke `security-generator` → authentication, authorization, role/permission model, security config.

## Step 5 — Generate events and messaging
If required, invoke `event-generator` (in-process Spring events) and `messaging-generator` (broker; Redis Pub/Sub is owned by messaging-generator).

## Step 6 — Generate caching, scheduling, batch
If required, invoke `redis-generator` (cache/locks), `scheduler-generator` (schedule triggers), and `batch-generator` (bulk jobs).

## Step 7 — Generate migrations
If schema changes are required, invoke `migration-generator`.

## Step 8 — Generate cross-cutting concerns
If required, invoke `config-properties-generator` (typed config), `observability-generator`
(logging/metrics/tracing/health), `notification-generator` (email/SMS/push), `file-storage-generator`
(uploads/object storage), `websocket-generator` (client-facing real-time), and `api-docs-generator`
(runtime OpenAPI/Swagger).

## Step 9 — Generate tests
If tests are enabled, invoke `spring-test-generator` → unit, integration, API tests.

## Step 10 — Assemble artifact
Merge all outputs into `backend_artifact`.

# Rules

- Never generate implementation code directly; always delegate.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Maintain strict separation: the domain layer holds business rules and must not depend on the API layer; the API layer stays thin and maps requests ↔ domain/service only.
- Scheduling triggers are owned by `scheduler-generator`; bulk-processing jobs by `batch-generator`.
- In-process Spring events are `event-generator`; broker messaging (incl. Redis Pub/Sub) is `messaging-generator`.
- Client-facing real-time is `websocket-generator`; do not confuse with broker messaging or in-process events.
- Email/SMS/push is `notification-generator`; file/object storage is `file-storage-generator`; generic external HTTP transport stays in `integration-generator`.
- Base logback/profile scaffold is `spring-initializer`; `observability-generator` adds structured logging, metrics, tracing, and health.
- Base `application.yml` scaffold is `spring-initializer`; `config-properties-generator` adds typed feature config.
- Use `api-generator` for runtime code; the design-time spec comes from `api-spec-generator` (blueprint); runtime OpenAPI/Swagger annotations come from `api-docs-generator`.
- Every artifact must reference its requirement, blueprint component, feature, story, and task.
- Complete only when domain and API generation finish and all required layers are merged into `backend_artifact`.

# Examples

Input:

```yaml
feature: { id: FEAT-ORDER, name: Place Order, stories: [Order API, Order Domain] }
target_stack: { backend: spring }
```

Output (abridged):

```
✔ domain     → Order aggregate, OrderItem entity, Money VO
✔ api        → OrderController, PlaceOrderRequest/Response DTOs, OrderMapper
✔ security   → @PreAuthorize on POST /orders (ROLE_USER)
✔ event      → OrderPlacedEvent + handler
∅ messaging  → skipped
✔ redis      → cache key order:{id}, TTL 300s
∅ scheduler / batch → skipped
✔ migration  → V3__create_orders.sql
✔ tests      → OrderServiceTest, OrderControllerIT
✔ assemble   → backend_artifact (12 files)
```
