---
name: blueprint-orchestrator
description: Turns unified requirements into a complete application blueprint by orchestrating architecture, domain-model, database, and API-spec design skills. Use after document analysis, before planning.
version: 1.0.0
category: orchestrator
tags:
  - orchestrator
  - blueprint
  - architecture
  - design
model: inherit
invokes:
  - architecture-generator
  - domain-model-generator
  - database-generator
  - api-spec-generator
  - event-topology-generator
  - blueprint-validator
inputs:
  - unified_requirements
  - target_stack
outputs:
  - application_blueprint
---

# Goal

Transform unified requirements into a complete application blueprint that becomes the
single source of truth for every downstream generator. It describes **what the
application should be**, not how components are implemented. This skill **never generates
source code** — it only delegates design work and merges the results.

# Inputs

```yaml
unified_requirements:
  functional_requirements: [...]
  non_functional_requirements: [...]
  ui_requirements: [...]
  business_rules: [...]
target_stack:
  backend: Spring Boot
  frontend: Next.js
  database: MariaDB
```

# Output

```yaml
application_blueprint:
  architecture_design: style + layers + packages + modules + tech decisions
  domain_model: aggregates + entities + value objects + relationships + rules + shared_kernel + write_policy
  database_schema: tables + indexes + relationships + constraints
  api_specification: REST endpoints + request/response models + auth
  event_topology: events + channels + producers/consumers + delivery semantics
  integrations: external services
  security: authn/authz model
  validation: <pass/fail + violations from blueprint-validator>
```

# Workflow

## Step 1 — Classify requirements
Split requirements into functional, non-functional, UI, business rules, and integrations.

## Step 2 — Design architecture
Invoke `architecture-generator` → architecture style, layers, packages, modules, technology decisions.

## Step 3 — Build domain model
Invoke `domain-model-generator` → aggregates, entities, value objects, relationships, business rules,
plus `shared_kernel` (value objects shared across modules) and `write_policy` (per-aggregate
client-supplied vs server-assigned/derived fields). These two feed the API spec and the validators.

## Step 3b — Reconcile the shared kernel
Reconcile `architecture_design.modules` against `domain_model.shared_kernel`: if the domain model
declares shared value objects, ensure a shared-kernel module (`kind: shared-kernel`, conventionally
`common`) is present in the architecture modules; drop a provisional shared-kernel module the domain
model does not confirm. This keeps every module referenced by the specs declared (so
`blueprint-validator`/`architecture-validator` see no undeclared shared-kernel module).

## Step 4 — Design database
Invoke `database-generator` (derived from the domain model) → tables, indexes, relationships, constraints.

## Step 5 — Design APIs
Invoke `api-spec-generator` → REST endpoints, request/response models, authentication, authorization.

## Step 5b — Design event topology
If the architecture uses events/messaging, invoke `event-topology-generator` (from the domain
model + architecture) → event catalog, in-process/broker/websocket split, channels, delivery
semantics. This guides the backend event/messaging/websocket generators.

## Step 5c — Validate spec consistency
Invoke `blueprint-validator` to verify the specs agree (domain↔db↔api↔event↔module) before
downstream generators consume them (pass/fail).

## Step 6 — Assemble blueprint
Merge all outputs plus the validation verdict into a single `application_blueprint`.

# Rules

- Never generate implementation code; produce design artifacts only.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Database design must be derived from the domain model — no duplicate/redundant schemas.
- `api-spec-generator` (blueprint, design) is distinct from `api-generator` (backend, runtime code); use this one for the spec.
- Every blueprint element must trace to its originating requirement, feature, and document.
- Complete only when architecture, domain model, database, and APIs are all merged.

# Examples

Input:

```yaml
unified_requirements:
  functional_requirements: ["User login", "Order placement"]
  business_rules: ["An order requires at least one line item"]
target_stack: { backend: Spring Boot, frontend: Next.js, database: MariaDB }
```

Output (abridged):

```
✔ architecture → layered + modular, packages: auth, order
✔ domain-model → 3 aggregates (User, Order, OrderItem), 5 entities
✔ database → 5 tables, 4 FKs, 6 indexes
✔ api-spec → 9 REST endpoints, JWT auth
✔ assemble → application_blueprint (traceable to 2 requirements)
```
