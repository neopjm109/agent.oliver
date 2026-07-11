---
name: backend-orchestrator
description: Routes backend generation for a feature to the stack-specific backend orchestrator selected by target_stack.backend (Spring Boot, NestJS, or Django). Never generates code; delegates to one stack orchestrator and returns its artifact.
version: 1.0.0
category: orchestrator
tags:
  - orchestrator
  - backend
  - router
  - multi-stack
model: inherit
invokes:
  - spring-backend-orchestrator
  - nestjs-backend-orchestrator
  - django-backend-orchestrator
inputs:
  - feature
  - application_blueprint
  - target_stack
outputs:
  - backend_artifact
---

# Goal

Select the backend stack for a feature and delegate the entire backend generation to that
stack's orchestrator. This skill **only routes** — it never generates code and never
delegates to leaf generators directly. It returns the chosen stack orchestrator's
`backend_artifact` unchanged.

The stack-neutral blueprint (`domain-model` / `database` / `api-spec` / `event-topology`) is
the shared contract every stack consumes, so switching stacks does not change the design.

# Inputs

```yaml
feature:
  id: FEAT-ORDER
  name: Place Order
  stories: [...]
  tasks: [...]
application_blueprint: {...}
target_stack:
  backend: spring        # spring | nestjs | django  (default: spring)
```

# Output

```yaml
backend_artifact: <the selected stack orchestrator's artifact, unchanged>
```

# Workflow

## Step 1 — Resolve the stack
Read `target_stack.backend`. Accept `spring` (Spring Boot), `nestjs` (NestJS + TypeORM), or
`django` (Django + DRF). Default to `spring` when unset.

## Step 2 — Delegate to the stack orchestrator
Invoke exactly one:
- `spring` → `spring-backend-orchestrator`
- `nestjs` → `nestjs-backend-orchestrator`
- `django` → `django-backend-orchestrator`

Pass `feature`, `application_blueprint`, and `target_stack` through unchanged.

## Step 3 — Return
Return the delegated orchestrator's `backend_artifact` verbatim. The router adds nothing.

# Rules

- This skill only routes. Never generate code, and never call leaf generators directly.
- Exactly one stack orchestrator runs per invocation, chosen by `target_stack.backend`.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- All stacks consume the same blueprint contract; the router must not alter the blueprint.
- If `target_stack.backend` is an unknown value, stop and report the unsupported stack
  rather than defaulting silently.

# Examples

Input:

```yaml
feature: { id: FEAT-ORDER, name: Place Order }
target_stack: { backend: nestjs }
```

Output (abridged):

```
✔ resolve  → stack = nestjs
✔ delegate → nestjs-backend-orchestrator
✔ return   → backend_artifact (NestJS: modules, controllers, entities, migrations, tests)
```
