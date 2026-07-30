---
name: nestjs-backend-orchestrator
description: Orchestrates the NestJS backend implementation for a feature by coordinating module/domain, API, auth, event, messaging, cache, scheduler, queue, migration, config, observability, notification, file-storage, websocket, api-docs, and test generators. Selected by backend-orchestrator when target_stack.backend is nestjs.
version: 1.0.0
category: backend
tags:
  - orchestrator
  - backend
  - nestjs
  - node
model: inherit
invokes:
  - nestjs-domain-generator
  - nestjs-api-generator
  - nestjs-auth-generator
  - nestjs-event-generator
  - nestjs-messaging-generator
  - nestjs-cache-generator
  - nestjs-scheduler-generator
  - nestjs-queue-generator
  - nestjs-migration-generator
  - nestjs-config-generator
  - nestjs-observability-generator
  - nestjs-notification-generator
  - nestjs-file-storage-generator
  - nestjs-websocket-generator
  - nestjs-api-docs-generator
  - nestjs-test-generator
inputs:
  - feature
  - application_blueprint
  - target_stack
outputs:
  - backend_artifact
---

# Goal

Generate the complete NestJS backend for a feature by orchestrating module/domain, API,
auth, eventing/messaging, cache, scheduling, queues, migrations, and cross-cutting concerns.
This skill **never generates implementation code directly** — it delegates to specialized
generators (which delegate implementation to `nestjs-senior-programmer`) and merges results.
It consumes the same stack-neutral blueprint as the Spring and Django stacks.

# Inputs

```yaml
feature: { id: FEAT-ORDER, name: Place Order, stories: [...], tasks: [...] }
application_blueprint: {...}
target_stack: { backend: nestjs }
```

# Output

```yaml
backend_artifact:
  domain: entities (TypeORM) + value objects + providers + rules
  api: controllers + DTOs (class-validator) + mappers
  auth: guards + strategies (Passport) + roles/permissions
  events: EventEmitter2 events + listeners
  messaging: microservice transports / broker publishers + consumers
  cache: cache-manager keys + TTL (Redis)
  scheduler: @nestjs/schedule cron/interval tasks
  queue: BullMQ producers + processors (bulk/background jobs)
  migrations: TypeORM migrations
  config: ConfigModule typed config + validation
  observability: pino logging + metrics + tracing + health (Terminus)
  notification: email/SMS/push delivery
  file_storage: uploads + object storage + signed URLs
  websocket: gateways (client-facing real-time)
  api_docs: Nest Swagger (OpenAPI)
  tests: Jest unit + e2e tests
```

# Workflow

## Step 1 — Precondition: project scaffolded
The project scaffold (via `nestjs-initializer`) is created once by `app-orchestrator` before the
feature loop; this per-feature orchestrator assumes it exists and never invokes it.

## Step 2 — Domain
Invoke `nestjs-domain-generator` → entities (TypeORM), value objects, domain providers, rules.

## Step 3 — API
Invoke `nestjs-api-generator` → controllers, DTOs (class-validator), mappers (thin).

## Step 4 — Auth
If required, invoke `nestjs-auth-generator` → guards, Passport strategies, roles/permissions.

## Step 5 — Events & messaging
If required, invoke `nestjs-event-generator` (in-process EventEmitter2) and
`nestjs-messaging-generator` (broker/microservice transports).

## Step 6 — Cache, scheduler, queue
If required, invoke `nestjs-cache-generator` (cache-manager/Redis), `nestjs-scheduler-generator`
(@nestjs/schedule triggers), and `nestjs-queue-generator` (BullMQ background/bulk jobs).

## Step 7 — Migrations
If schema changes are required, invoke `nestjs-migration-generator` (TypeORM).

## Step 8 — Cross-cutting
If required, invoke `nestjs-config-generator`, `nestjs-observability-generator`,
`nestjs-notification-generator`, `nestjs-file-storage-generator`, `nestjs-websocket-generator`,
and `nestjs-api-docs-generator`.

## Step 9 — Tests
If tests are enabled, invoke `nestjs-test-generator` → Jest unit + e2e.

## Step 10 — Assemble
Merge outputs into `backend_artifact`.

# Rules

- Never generate implementation code directly; always delegate to `nestjs-senior-programmer`
  via the leaf generators.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Project scaffold (`nestjs-initializer`) is owned by `app-orchestrator` (once, before the feature loop); this orchestrator never invokes it.
- Keep controllers thin; business rules live in domain providers/services, not controllers.
- In-process events are `nestjs-event-generator`; broker/microservice transport is
  `nestjs-messaging-generator`; client-facing real-time is `nestjs-websocket-generator`.
- Scheduled triggers are `nestjs-scheduler-generator`; background/bulk jobs are
  `nestjs-queue-generator` (BullMQ).
- Every artifact references its requirement, blueprint component, feature, story, and task.
- Complete only when domain and API finish and required layers merge into `backend_artifact`.

# Examples

Input:

```yaml
feature: { id: FEAT-ORDER, name: Place Order, stories: [Order API, Order Domain] }
target_stack: { backend: nestjs }
```

Output (abridged):

```
✔ domain    → Order entity, OrderItem, Money VO, OrderService provider
✔ api       → OrderController, PlaceOrderDto (class-validator), OrderMapper
✔ auth      → JwtAuthGuard + RolesGuard on POST /orders
✔ event     → OrderPlacedEvent + listener (EventEmitter2)
✔ queue     → order-email processor (BullMQ)
✔ migration → 1699999999-CreateOrders.ts (TypeORM)
✔ api-docs  → @nestjs/swagger decorators
✔ tests     → order.service.spec.ts, order.e2e-spec.ts
✔ assemble  → backend_artifact (14 files)
```
