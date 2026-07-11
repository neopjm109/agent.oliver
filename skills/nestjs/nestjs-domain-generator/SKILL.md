---
name: nestjs-domain-generator
description: Generate the NestJS domain layer for a feature — TypeORM entities, value objects, domain providers/services, and business rules — from the blueprint domain model. NestJS peer of domain-generator.
version: 1.0.0
category: backend
tags:
  - nestjs
  - domain
  - typeorm
model: inherit
invokes:
  - nestjs-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - domain_artifact
---

# Goal

Produce the feature's domain layer in NestJS from the stack-neutral domain model: TypeORM
entities, value objects, and domain providers holding business rules. Delegates code writing
to `nestjs-senior-programmer`; keeps the domain independent of the API layer.

# Inputs

```yaml
feature: { id, name, stories }
application_blueprint: { domain_model, database_schema }
```

# Output

```yaml
domain_artifact:
  entities: [<TypeORM entity>]
  value_objects: [<VO>]
  providers: [<domain service provider with rules>]
  module: <feature module wiring>
```

# Workflow

## Step 1 — Map the domain model
Translate blueprint entities/relations into TypeORM entities and value objects.

## Step 2 — Encode rules
Place invariants/business rules in domain providers, not controllers.

## Step 3 — Wire the module
Register entities and providers in the feature module.

## Step 4 — Delegate & return
Delegate implementation to `nestjs-senior-programmer`; return `domain_artifact`.

# Rules

- Follow the blueprint domain model exactly; never invent entities or fields.
- Domain must not depend on the API layer.
- Use TypeORM entities/relations; keep value objects immutable.
- Delegate file contents to `nestjs-senior-programmer`.

# Examples

Input:

```yaml
feature: { id: FEAT-ORDER, name: Place Order }
application_blueprint: { domain_model: { Order: { items, total }, OrderItem: {...} } }
```

Output (abridged):

```yaml
domain_artifact:
  entities: [Order (OneToMany items), OrderItem]
  value_objects: [Money]
  providers: [OrderService (invariant: total = sum(items))]
  module: OrderModule (TypeOrmModule.forFeature([Order, OrderItem]))
```
