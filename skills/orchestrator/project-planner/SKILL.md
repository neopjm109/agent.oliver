---
name: project-planner
description: Decomposes an application blueprint into epics, features, stories, tasks, and a dependency graph, producing an executable development plan. Use after the blueprint, before feature generation.
version: 1.0.0
category: orchestrator
tags:
  - orchestrator
  - planner
  - roadmap
  - dependency
model: inherit
invokes: []
inputs:
  - application_blueprint
outputs:
  - execution_plan
---

# Goal

Transform an application blueprint into an executable development plan: epics, features,
stories, tasks, a dependency graph, and an execution order. The plan is the source of
truth for downstream orchestrators. This skill **never generates source code** — it only
plans and sequences.

# Inputs

```yaml
application_blueprint:
  architecture: {...}
  domain_model: {...}
  database: {...}
  apis: {...}
  integrations: {...}
  security: {...}
```

# Output

```yaml
execution_plan:
  epics: [...]
  features: [...]
  stories: [...]
  tasks: [...]
  dependency_graph: {...}
  execution_order: [...]
```

# Workflow

## Step 1 — Analyze blueprint
Identify business domains, modules, APIs, database objects, UI screens, and external integrations.

## Step 2 — Generate epics
Group related functionality into epics (e.g. Authentication, User Management, Order Management).

## Step 3 — Generate features
Split each epic into features (e.g. Authentication → Login, Logout, Refresh Token, Password Reset).

## Step 4 — Generate stories
Break each feature into implementation stories (e.g. Login → Login API, Login Screen, JWT Generation).

## Step 5 — Generate tasks
Produce concrete tasks per story (Create Entity, Repository, Service, Controller, UI Page, API Client, Tests).

## Step 6 — Resolve dependencies
Determine prerequisite, blocking, independent, and parallel tasks. Reject circular dependencies.

## Step 7 — Calculate execution order
Produce an execution order from the dependency graph, preferring parallelism where allowed.

# Rules

- Never generate implementation code; produce the plan only.
- Every feature belongs to exactly one epic; every story to one feature; every task to one story.
- Never create circular dependencies; minimize blocking; maximize parallel groups.
- Tasks must be independently executable, measurable, reviewable, and idempotent.
- Typical dependency order: database → backend → API → frontend → integration → testing.
- Every epic/feature/story/task must reference its originating requirement and blueprint component.
- Complete only when every blueprint component is assigned and the dependency graph plus execution order are valid.

# Examples

Input:

```yaml
application_blueprint:
  domain_model: { aggregates: [User, Order] }
  apis: { endpoints: 9 }
```

Output (abridged):

```
epics:    [Authentication, Order Management]
features: [Login, Password Reset, Place Order, Order History]  (4)
stories:  11
tasks:    23
dependency_graph: Order.entity → repository → service → controller → api-client → order-page
execution_order: parallel group A [User.entity, Order.entity] → ... → tests
```
