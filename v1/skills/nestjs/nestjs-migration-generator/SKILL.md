---
name: nestjs-migration-generator
description: Generate TypeORM migrations for a feature's schema changes from the blueprint database design. NestJS peer of migration-generator.
version: 1.0.0
category: backend
tags:
  - nestjs
  - migration
  - typeorm
model: inherit
invokes:
  - nestjs-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - migration_artifact
---

# Goal

Produce TypeORM migrations that evolve the schema for the feature per the blueprint database
design: create/alter tables, indexes, and constraints, with up/down. Delegates code to
`nestjs-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
application_blueprint: { database_schema: { tables: [...], changes: [...] } }
```

# Output

```yaml
migration_artifact:
  migrations: [ { name, up, down } ]
```

# Workflow

## Step 1 — Diff the schema
Determine required create/alter/index operations from the database design.

## Step 2 — Write up/down
Generate a timestamped TypeORM migration with reversible up/down.

## Step 3 — Delegate & return
Delegate to `nestjs-senior-programmer`; return `migration_artifact`.

# Rules

- Follow the blueprint database design; never invent columns/constraints.
- Provide reversible `down` for every `up`.
- Migrations define schema (DDL); seed/mock data is `seed-data/*`, not here.
- Delegate file contents to `nestjs-senior-programmer`.

# Examples

Input:

```yaml
application_blueprint: { database_schema: { changes: ["create orders", "create order_items"] } }
```

Output (abridged):

```yaml
migration_artifact:
  migrations:
    - { name: "1699999999-CreateOrders", up: "CREATE TABLE orders ...", down: "DROP TABLE orders" }
```
