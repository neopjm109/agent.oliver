---
name: mock-record-generator
description: Generate the requested number of realistic records per entity, honoring field types, constraints, and locale, deterministically from a seed. Does not resolve foreign keys (that is the linker's job).
version: 1.0.0
category: seed-data
tags:
  - seed-data
  - mock-data
  - generation
  - locale
model: inherit
invokes: []
inputs:
  - schema_spec
  - seed_request
  - options
outputs:
  - raw_records
---

# Goal

Create realistic sample values for each entity's non-relational fields, respecting types,
constraints, and locale, reproducibly from a seed. Foreign-key values are left as
placeholders for `relationship-linker` to resolve.

# Inputs

```yaml
schema_spec: { entities: [...], generation_order: [...] }
seed_request: { entities: [ { name: User, count: 50 } ], locale: ko-KR }
options:
  seed: 42
```

# Output

```yaml
raw_records:
  User:
    - { id: 1, email: "user1@example.com", name: "김민준" }
  Order:
    - { id: 1, user_id: null, amount: 15000, status: "PAID" }   # FK left null
```

# Workflow

## Step 1 — Generate per entity in order
Follow `generation_order`. For each entity, produce `count` records.

## Step 2 — Fill fields realistically
Choose locale-appropriate values (names, emails, addresses, phones), respect min/max,
pick from enum `values`, and satisfy `unique` fields.

## Step 3 — Leave FKs unset
Set FK fields to `null` placeholders; the linker assigns them.

## Step 4 — Return
Return `raw_records`. Stop.

# Rules

- Deterministic: the same `seed` + spec yields identical records.
- Honor every constraint (unique, nullable, enum, min/max); never emit invalid values.
- Do not assign foreign keys — that is `relationship-linker`.
- Use realistic, locale-appropriate data; avoid obviously fake repeated values for unique
  fields.

# Examples

Input:

```yaml
schema_spec: { entities: [ { name: User, fields: [ {name: id, pk: true}, {name: email, unique: true}, {name: name} ] } ], generation_order: [ User ] }
seed_request: { entities: [ { name: User, count: 2 } ], locale: ko-KR }
options: { seed: 42 }
```

Output:

```yaml
raw_records:
  User:
    - { id: 1, email: "minjun.kim@example.com", name: "김민준" }
    - { id: 2, email: "seoyeon.lee@example.com", name: "이서연" }
```
