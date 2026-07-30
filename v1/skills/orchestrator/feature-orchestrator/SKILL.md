---
name: feature-orchestrator
description: Orchestrates the complete implementation of a single feature by coordinating the backend and frontend orchestrators and the integration generator. Invoked once per feature by app-orchestrator.
version: 1.0.0
category: orchestrator
tags:
  - orchestrator
  - feature
  - backend
  - frontend
  - integration
model: inherit
invokes:
  - backend-orchestrator
  - frontend-orchestrator
  - integration-generator
  - nestjs-integration-generator
  - django-integration-generator
inputs:
  - feature
  - application_blueprint
  - target_stack
outputs:
  - feature_artifact
---

# Goal

Generate a complete, independently deliverable implementation for a single feature by
coordinating the backend and frontend orchestrators and the integration generator. This skill
**never generates implementation code directly** — it delegates and merges.

# Inputs

```yaml
feature:
  id: FEAT-LOGIN
  name: Login
  description: Email/password authentication
  stories: [...]
  tasks: [...]
application_blueprint: {...}
target_stack:
  backend: Spring Boot
  frontend: Next.js
  database: MariaDB
```

# Output

```yaml
feature_artifact:
  backend: {...}
  frontend: {...}
  integration: {...}
  status: completed
```

# Workflow

## Step 1 — Analyze feature
Read the feature, stories, and tasks. Determine backend, frontend, and integration scope.

## Step 2 — Generate backend
If the feature needs business logic, persistence, APIs, auth, or background processing,
invoke `backend-orchestrator` → domain, API, security, events, tests.

## Step 3 — Generate frontend
If the feature needs pages, components, forms, tables, dialogs, or state,
invoke `frontend-orchestrator` → pages, components, data layer, tests.

## Step 4 — Generate integration
If the feature needs cross-system wiring (external HTTP services, contract glue), invoke the
integration generator matching `target_stack.backend` — `integration-generator` (spring) /
`nestjs-integration-generator` / `django-integration-generator` — directly → external clients
(auth, timeout, retry, circuit breaker) and contract-consistency glue.

## Step 5 — Merge outputs
Merge backend, frontend, and integration outputs into a single `feature_artifact` with status.

# Rules

- Never generate implementation code directly; delegate to backend/frontend orchestrators and the integration generator.
- Generate only artifacts required by the current feature (skip empty scopes).
- Backend, frontend, and integration may run in parallel where dependencies permit.
- The integration generator (stack-selected: `integration-generator` / `nestjs-integration-generator` / `django-integration-generator`) covers external HTTP transport only; the frontend API client is owned by `frontend-orchestrator`, and events/messaging/Redis by the backend generators — do not duplicate them here.
- Email/SMS/push is `notification-generator` and file/object storage is `file-storage-generator` (backend), not `integration-generator`.
- Every generated artifact must reference its feature, story, task, requirement, and blueprint component.
- Complete only when all required sub-orchestrations finish and outputs are merged with a reported status.

# Examples

Input:

```yaml
feature: { id: FEAT-LOGIN, name: Login, stories: [Login API, Login Screen] }
target_stack: { backend: Spring Boot, frontend: Next.js }
```

Output (abridged):

```
✔ backend-orchestrator   → 6 files (entity, repo, service, controller, security, tests)
✔ frontend-orchestrator  → 5 files (login page, form, api-client, data hook, tests)
∅ integration-generator  → skipped (no external systems)
✔ merge → feature_artifact FEAT-LOGIN status=completed
```
