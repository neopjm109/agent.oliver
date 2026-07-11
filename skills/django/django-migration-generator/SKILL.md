---
name: django-migration-generator
description: Generate Django migrations for a feature's schema changes from the blueprint database design (create/alter models, indexes, constraints, data migrations). Django peer of migration-generator.
version: 1.0.0
category: backend
tags:
  - django
  - migration
  - schema
model: inherit
invokes:
  - django-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - migration_artifact
---

# Goal

Produce Django migrations that evolve the schema for the feature per the blueprint database
design: model create/alter, indexes, constraints, and data migrations where needed. Delegates
code to `django-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
application_blueprint: { database_schema: { tables: [...], changes: [...] } }
```

# Output

```yaml
migration_artifact:
  migrations: [ { app, name, operations } ]
  data_migrations: [<RunPython, if needed>]
```

# Workflow

## Step 1 — Diff the schema
Determine model create/alter/index operations from the database design.

## Step 2 — Migration operations
Generate migration files with the operations; add data migrations (`RunPython`) if required.

## Step 3 — Delegate & return
Delegate to `django-senior-programmer`; return `migration_artifact`.

# Rules

- Follow the blueprint database design; never invent fields/constraints.
- Provide reverse operations; keep data migrations idempotent.
- Migrations define schema; seed/mock data is `seed-data/*`, not here.
- Delegate file contents to `django-senior-programmer`.

# Examples

Input:

```yaml
application_blueprint: { database_schema: { changes: ["create Order", "create OrderItem"] } }
```

Output (abridged):

```yaml
migration_artifact:
  migrations: [ { app: order, name: "0003_order", operations: ["CreateModel Order", "CreateModel OrderItem"] } ]
  data_migrations: []
```
