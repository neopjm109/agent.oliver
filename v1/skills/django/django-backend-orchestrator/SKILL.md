---
name: django-backend-orchestrator
description: Orchestrates the Django + DRF backend implementation for a feature by coordinating model, API, auth, signals, celery, cache, scheduler, task, migration, settings, observability, notification, storage, channels, api-docs, and test generators. Selected by backend-orchestrator when target_stack.backend is django.
version: 1.0.0
category: backend
tags:
  - orchestrator
  - backend
  - django
  - drf
model: inherit
invokes:
  - django-model-generator
  - django-api-generator
  - django-auth-generator
  - django-signals-generator
  - django-celery-generator
  - django-cache-generator
  - django-scheduler-generator
  - django-task-generator
  - django-migration-generator
  - django-settings-generator
  - django-observability-generator
  - django-notification-generator
  - django-storage-generator
  - django-channels-generator
  - django-api-docs-generator
  - django-test-generator
inputs:
  - feature
  - application_blueprint
  - target_stack
outputs:
  - backend_artifact
---

# Goal

Generate the complete Django + Django REST Framework backend for a feature by orchestrating
models, API, auth, signals/async, cache, scheduling, tasks, migrations, and cross-cutting
concerns. This skill **never generates implementation code directly** — it delegates to
specialized generators (which delegate implementation to `django-senior-programmer`) and
merges results. It consumes the same stack-neutral blueprint as the Spring and NestJS stacks.

# Inputs

```yaml
feature: { id: FEAT-ORDER, name: Place Order, stories: [...], tasks: [...] }
application_blueprint: {...}
target_stack: { backend: django }
```

# Output

```yaml
backend_artifact:
  models: Django models + managers + business rules
  api: DRF serializers + viewsets + routers
  auth: DRF authentication + permissions + roles
  signals: Django signals + receivers (in-process)
  celery: Celery tasks + broker wiring (async/messaging)
  cache: Django cache framework keys + TTL (Redis)
  scheduler: Celery beat schedules
  tasks: management commands / bulk jobs
  migrations: Django migrations
  settings: settings modules + env-bound config
  observability: structured logging + metrics + tracing + health
  notification: email/SMS/push delivery
  storage: uploads + object storage (django-storages) + signed URLs
  channels: Django Channels consumers (client-facing real-time)
  api_docs: drf-spectacular (OpenAPI)
  tests: pytest + DRF APITestCase
```

# Workflow

## Step 1 — Precondition: project scaffolded
The project scaffold (via `django-initializer`) is created once by `app-orchestrator` before the
feature loop; this per-feature orchestrator assumes it exists and never invokes it.

## Step 2 — Models
Invoke `django-model-generator` → models, managers, business rules (fat models where apt).

## Step 3 — API
Invoke `django-api-generator` → serializers, viewsets, routers (thin views).

## Step 4 — Auth
If required, invoke `django-auth-generator` → authentication classes, permissions, roles.

## Step 5 — Signals & async
If required, invoke `django-signals-generator` (in-process signals) and `django-celery-generator`
(async tasks / broker messaging).

## Step 6 — Cache, scheduler, tasks
If required, invoke `django-cache-generator` (cache framework/Redis), `django-scheduler-generator`
(Celery beat), and `django-task-generator` (management commands / bulk jobs).

## Step 7 — Migrations
If schema changes are required, invoke `django-migration-generator`.

## Step 8 — Cross-cutting
If required, invoke `django-settings-generator`, `django-observability-generator`,
`django-notification-generator`, `django-storage-generator`, `django-channels-generator`, and
`django-api-docs-generator`.

## Step 9 — Tests
If tests are enabled, invoke `django-test-generator` → pytest + DRF API tests.

## Step 10 — Assemble
Merge outputs into `backend_artifact`.

# Rules

- Never generate implementation code directly; always delegate to `django-senior-programmer`
  via the leaf generators.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Project scaffold (`django-initializer`) is owned by `app-orchestrator` (once, before the feature loop); this orchestrator never invokes it.
- Keep views/viewsets thin; business rules live in models/services, not views.
- In-process reactions are `django-signals-generator`; async/broker work is
  `django-celery-generator`; client-facing real-time is `django-channels-generator`.
- Scheduled triggers are `django-scheduler-generator` (Celery beat); bulk/one-off jobs are
  `django-task-generator` (management commands / Celery tasks).
- Every artifact references its requirement, blueprint component, feature, story, and task.
- Complete only when models and API finish and required layers merge into `backend_artifact`.

# Examples

Input:

```yaml
feature: { id: FEAT-ORDER, name: Place Order, stories: [Order API, Order Domain] }
target_stack: { backend: django }
```

Output (abridged):

```
✔ models    → Order, OrderItem, Money (value), OrderManager
✔ api       → OrderSerializer, OrderViewSet, router
✔ auth      → IsAuthenticated + OrderPermission on create
✔ signals   → post_save(Order) → confirmation
✔ celery    → send_order_email task
✔ migration → 0003_order.py
✔ api-docs  → drf-spectacular schema
✔ tests     → test_order_api.py (pytest)
✔ assemble  → backend_artifact (13 files)
```
