---
name: relationship-linker
description: Assign foreign-key values across generated records so the dataset is referentially consistent — respecting cardinality, nullability, and distribution. Runs after record generation.
version: 1.0.0
category: seed-data
tags:
  - seed-data
  - foreign-key
  - referential-integrity
  - relationships
model: inherit
invokes: []
inputs:
  - raw_records
  - schema_spec
  - options
outputs:
  - linked_records
---

# Goal

Resolve every foreign key in the generated records to a valid parent row, honoring
relationship cardinality and nullability, so the exported dataset has no dangling
references. This skill only links; it does not create or delete records.

# Inputs

```yaml
raw_records: { User: [...], Order: [ { id, user_id: null, ... } ] }
schema_spec: { entities: [...] }   # for FK definitions and cardinality
options:
  distribution: even   # even | random | skewed(power-law)
  seed: 42             # seeds random/skewed assignment so linking is reproducible
```

# Output

```yaml
linked_records: { User: [...], Order: [ { id, user_id: 3, ... } ] }
report: { assigned: <n>, orphans: 0, nullable_left_null: <n> }
```

# Workflow

## Step 1 — Identify FK fields
From `schema_spec`, find every FK field and its parent entity/key.

## Step 2 — Assign parents
For each child row, pick a valid parent id per `options.distribution`. Respect cardinality
(e.g. one-to-one uniqueness) and leave nullable FKs null only where allowed.

## Step 3 — Verify no orphans
Ensure every non-null FK references an existing parent.

## Step 4 — Return
Return `linked_records` and a link `report`. Stop.

# Rules

- Only assign FK values; never add, remove, or otherwise mutate record fields.
- No dangling references: every non-null FK must resolve to a generated parent.
- Respect cardinality and nullability from the schema.
- Deterministic given the same inputs, distribution, and `seed` (random/skewed assignment is seeded).

# Examples

Input:

```yaml
raw_records:
  User: [ { id: 1 }, { id: 2 } ]
  Order: [ { id: 1, user_id: null }, { id: 2, user_id: null }, { id: 3, user_id: null } ]
schema_spec: { entities: [ { name: Order, fields: [ { name: user_id, fk: { entity: User, field: id }, nullable: false } ] } ] }
options: { distribution: even }
```

Output:

```yaml
linked_records:
  User: [ { id: 1 }, { id: 2 } ]
  Order: [ { id: 1, user_id: 1 }, { id: 2, user_id: 2 }, { id: 3, user_id: 1 } ]
report: { assigned: 3, orphans: 0, nullable_left_null: 0 }
```
