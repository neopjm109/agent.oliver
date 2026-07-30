---
name: nestjs-senior-programmer
description: Implementation delegate for the NestJS stack — writes idiomatic NestJS/TypeScript (modules, providers, controllers, TypeORM, Passport, BullMQ) from a generator's spec. Invoked by nestjs generators, not by the orchestrator directly.
version: 1.0.0
category: backend
tags:
  - nestjs
  - implementation
  - senior-programmer
model: inherit
invokes: []
inputs:
  - implementation_spec
outputs:
  - source_files
---

# Goal

Produce idiomatic, production-quality NestJS/TypeScript source from a structured spec handed
down by a `nestjs-*` generator. This skill writes the actual files; the generators decide
*what* to build, this decides *how* in NestJS idioms. NestJS peer of `spring-senior-programmer`.

# Inputs

```yaml
implementation_spec:
  kind: controller | provider | entity | dto | guard | listener | processor | migration | test | ...
  intent: <what the generator wants built>
  contract: <api-spec / domain-model references>
  constraints: [<naming, layering, validation rules>]
```

# Output

```yaml
source_files:
  - { path, content }
```

# Workflow

## Step 1 — Interpret the spec
Map the generator's intent to NestJS constructs (module, provider, controller, entity, DTO,
guard, listener, processor, migration, spec).

## Step 2 — Implement idiomatically
Write TypeScript using DI, decorators, class-validator DTOs, TypeORM repositories, and Nest
module boundaries. Keep controllers thin; put logic in providers/services.

## Step 3 — Enforce constraints
Apply the generator's naming/layering/validation constraints; keep imports and module wiring
correct.

## Step 4 — Return
Return `source_files`. Stop.

# Rules

- Follow NestJS idioms (modules, providers, DI, decorators); do not emit Express-style ad-hoc
  handlers unless the spec explicitly requests it.
- Respect layering: controllers thin, business logic in providers, persistence via repositories.
- Honor the blueprint contract exactly (entities, fields, endpoints); never invent schema.
- Produce compilable, lint-clean TypeScript; include imports and module registration.

# Examples

Input:

```yaml
implementation_spec:
  kind: controller
  intent: "POST /orders creates an order"
  contract: { endpoint: "POST /orders", dto: PlaceOrderDto }
  constraints: [thin controller, delegate to OrderService]
```

Output (abridged):

```yaml
source_files:
  - path: src/modules/order/order.controller.ts
    content: |
      @Controller('orders')
      export class OrderController {
        constructor(private readonly orders: OrderService) {}
        @Post()
        create(@Body() dto: PlaceOrderDto) { return this.orders.place(dto); }
      }
```
