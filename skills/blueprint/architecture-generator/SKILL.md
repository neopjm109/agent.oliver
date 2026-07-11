---
name: architecture-generator
description: Produce a system architecture design (style, layers, modules, boundaries, data flow, technology decisions) from unified requirements. Use at the blueprint stage before domain, database, or API design.
version: 1.0.0
category: blueprint
tags:
  - architecture
  - system-design
  - blueprint
  - backend
  - frontend
model: inherit
invokes: []
inputs:
  - unified_requirements
outputs:
  - architecture_design
---

# Goal

Produce a high-level system architecture design from unified requirements:
architecture style, layers, modules, service boundaries, data flow, communication
model, scalability strategy, deployment model, and technology decisions. This is a
**design-time skill — it does not generate code or domain logic**. It only emits an
`architecture_design` artifact consumed by later blueprint and generation skills. The
target stack is fixed: Spring Boot (backend) + Next.js (frontend).

# Inputs

```yaml
unified_requirements:
  functional_requirements:
    - id: FR-1
      description: Users can register and authenticate
    - id: FR-2
      description: Users can place and track orders
  non_functional_requirements:
    - id: NFR-1
      description: 500 concurrent users, p95 latency < 300ms
    - id: NFR-2
      description: Horizontal scalability for order processing
  ui_requirements:
    - id: UI-1
      description: Responsive web dashboard with order tracking
  business_rules:
    - id: BR-1
      description: An order cannot be cancelled after shipment
```

# Output

```yaml
architecture_design:
  system_style: modular-monolith        # monolith | modular-monolith | microservices | event-driven | hybrid
  layers: [presentation, application, domain, infrastructure]
  modules:
    - name: user
      responsibility: registration, authentication, profile
    - name: order
      responsibility: order lifecycle, tracking
  service_boundaries:
    - module: order
      owns: [Order, OrderItem]
  data_flow: request -> controller -> application service -> domain -> repository
  communication_style: REST (sync) + in-process domain events (async)
  scalability_strategy: stateless app nodes, Redis cache, async order processing
  deployment_model: containerized (Docker) behind load balancer, CI/CD ready
  technology_stack:
    backend: Spring Boot
    frontend: Next.js
    database: MariaDB
    cache: Redis
  traceability:
    - decision: modular-monolith
      refs: [NFR-1, NFR-2]
```

# Workflow

## Step 1 — Analyze requirements

Read functional, non-functional, UI, and business-rule requirements. Extract the
constraints that drive architecture: performance targets, scalability needs, security
requirements, and integration points.

## Step 2 — Choose architecture style

Select one of: monolith, modular-monolith, microservices, event-driven, hybrid. Default
to modular-monolith unless requirements explicitly demand otherwise. Record the driving
requirement ids.

## Step 3 — Define layers and modules

Define system layers (presentation, application, domain, infrastructure) and break the
system into cohesive modules with clear responsibilities and service boundaries. When
cross-cutting domain types will be shared by two or more modules (e.g. `Money`, `Address`,
common identifiers), declare a **shared-kernel module** (`shared-kernel`, conventionally
`common`) to host them, rather than duplicating the type or coupling the sharing modules to
each other. Mark it `kind: shared-kernel`. Because this step precedes the domain model, treat
the shared kernel as provisional: `domain-model-generator` emits the authoritative
`shared_kernel` list, and `blueprint-orchestrator` reconciles the module set against it — so
declare a shared-kernel module whenever sharing is likely, and it will be confirmed or dropped
during assembly.

## Step 4 — Define communication and data flow

Specify the communication style (REST, in-process events, broker messaging, RPC) and the
request/event data flow, marking synchronous vs asynchronous boundaries.

## Step 5 — Define scalability and deployment

Describe the scaling strategy (stateless nodes, caching, async processing) and the
deployment model (containerization, load balancing, CI/CD compatibility).

## Step 6 — Select technology stack and assemble

Map the design onto the fixed stack (Spring Boot + Next.js) plus supporting components
(database, cache, messaging). Assemble all decisions into the `architecture_design`
artifact with traceability back to requirements.

# Rules

- Never generate implementation code — emit design artifacts only. Runtime code is the
  job of backend/frontend generators.
- Keep the design technology-aware but implementation-agnostic; backend is Spring Boot
  and frontend is Next.js by default.
- Maximize module cohesion, minimize inter-module coupling; cross-module references go
  through defined boundaries only.
- Declare a shared-kernel module (`kind: shared-kernel`) for domain types shared across
  modules instead of duplicating them or coupling the sharing modules together; it is
  reconciled against `domain_model.shared_kernel` during blueprint assembly.
- Prefer stateless services and async processing for heavy workloads.
- Every architecture decision must reference a requirement, business constraint, or
  non-functional requirement (traceability).
- The design is complete only when style, layers, modules, communication model,
  scalability strategy, deployment model, and technology stack are all defined.

# Examples

Input:

```yaml
unified_requirements:
  functional_requirements:
    - id: FR-1
      description: Manage a product catalog
    - id: FR-2
      description: Customers place orders
  non_functional_requirements:
    - id: NFR-1
      description: 1000 req/s peak, p95 < 250ms
  business_rules:
    - id: BR-1
      description: Stock cannot go negative
```

Output (abridged):

```yaml
architecture_design:
  system_style: modular-monolith
  layers: [presentation, application, domain, infrastructure]
  modules:
    - name: catalog
      responsibility: product & inventory management   # refs: FR-1, BR-1
    - name: order
      responsibility: order placement & tracking        # refs: FR-2
    - name: common
      kind: shared-kernel
      responsibility: cross-module domain types (e.g. Money)   # provisional; reconciled vs domain_model.shared_kernel
  communication_style: REST (sync) + in-process domain events (async)
  scalability_strategy: stateless app nodes + Redis cache (refs: NFR-1)
  deployment_model: containerized behind load balancer, CI/CD ready
  technology_stack:
    backend: Spring Boot
    frontend: Next.js
    database: MariaDB
    cache: Redis
```
