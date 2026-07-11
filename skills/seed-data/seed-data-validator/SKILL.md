---
name: seed-data-validator
description: Validate a generated seed dataset for referential integrity, constraint satisfaction, uniqueness, and requested volume, returning a pass/fail report with specific violations. Final stage of the seed-data pipeline.
version: 1.0.0
category: seed-data
tags:
  - seed-data
  - validation
  - integrity
  - final-output
model: inherit
invokes: []
inputs:
  - linked_records
  - schema_spec
  - seed_request
outputs:
  - validation_result
---

# Goal

Verify the generated dataset is valid and complete before it is used, reporting a
deterministic pass/fail verdict with any violations. This validates data (rows); it does not
generate, link, or export.

# Scope

- Referential integrity (no dangling foreign keys)
- Constraint satisfaction (NOT NULL, enum, min/max, type)
- Uniqueness (unique fields have no duplicates)
- Volume (each entity has the requested `count`)

Out of scope: schema/DDL validation, code validation (see `validator/*`).

# Checks

1. Every non-null FK references an existing parent row.
2. No unique field contains duplicate values.
3. No NOT NULL field is null; enum fields use allowed values; numeric fields respect min/max.
4. Each entity's record count equals the requested count.

# Pass/Fail Criteria

- **pass**: all checks succeed.
- **fail**: any orphaned FK, duplicate unique value, constraint breach, or count mismatch.

# Output Schema

```yaml
validation_result:
  result: pass | fail
  violations:
    - { entity: <name>, field: <name or "-">, issue: <what>, count: <n> }
  stats: { entities: <n>, records: <n>, orphans: <n>, duplicates: <n> }
```

# Rules

- Report violations only; never modify the dataset.
- Deterministic verdict: any single violation forces `fail`.
- Check against the schema constraints and the requested counts, not assumptions.
- Do not validate schema definitions or code — out of scope.

# Examples

Input:

```yaml
linked_records:
  User: [ { id: 1, email: "a@example.com" }, { id: 2, email: "a@example.com" } ]
  Order: [ { id: 1, user_id: 9 } ]
schema_spec: { entities: [ { name: User, fields: [ { name: email, unique: true } ] }, { name: Order, fields: [ { name: user_id, fk: { entity: User, field: id } } ] } ] }
seed_request: { entities: [ { name: User, count: 2 }, { name: Order, count: 1 } ] }
```

Output:

```yaml
validation_result:
  result: fail
  violations:
    - { entity: User, field: email, issue: "duplicate unique value 'a@example.com'", count: 2 }
    - { entity: Order, field: user_id, issue: "FK references missing User id 9", count: 1 }
  stats: { entities: 2, records: 3, orphans: 1, duplicates: 1 }
```
