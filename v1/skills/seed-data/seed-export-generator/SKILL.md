---
name: seed-export-generator
description: Serialize linked records into the requested fixture format — SQL INSERT statements, JSON, or CSV — with correct ordering, escaping, and type formatting. Export stage of the seed-data pipeline.
version: 1.0.0
category: seed-data
tags:
  - seed-data
  - export
  - sql
  - json
  - csv
  - fixtures
model: inherit
invokes: []
inputs:
  - linked_records
  - schema_spec
  - options
outputs:
  - export
---

# Goal

Turn the referentially-linked records into ready-to-load fixture files in the requested
format, ordered so parents load before children and with values correctly escaped and typed.
This skill only serializes; it does not generate or link data.

# Inputs

```yaml
linked_records: { User: [...], Order: [...] }
schema_spec: { generation_order: [ User, Order ] }
options:
  export_format: sql        # sql | json | csv
  dialect: mysql            # for SQL escaping/quoting
  one_file_per_entity: false
```

# Output

```yaml
export:
  format: <fmt>
  files:
    - { path: <file>, content: <serialized fixture> }
```

# Workflow

## Step 1 — Order by dependencies
Emit entities in `generation_order` so FK targets exist before referencing rows load.

## Step 2 — Serialize
- `sql` → `INSERT` statements with dialect-correct quoting/escaping and typed literals.
- `json` → an object keyed by entity with an array of records.
- `csv` → one file per entity with a header row.

## Step 3 — Package files
Group into files per `options.one_file_per_entity`.

## Step 4 — Return
Return `export`. Stop.

# Rules

- Serialize only; never change values or add/remove records.
- Preserve load order so referential integrity holds on import.
- Escape strings and format types per the target format/dialect; never emit invalid syntax.
- Nulls, enums, decimals, and dates must serialize in a form the target loader accepts.

# Examples

Input:

```yaml
linked_records:
  User: [ { id: 1, email: "a@example.com", name: "김민준" } ]
  Order: [ { id: 1, user_id: 1, amount: 15000, status: "PAID" } ]
schema_spec: { generation_order: [ User, Order ] }
options: { export_format: sql, dialect: mysql }
```

Output:

```yaml
export:
  format: sql
  files:
    - path: seed.sql
      content: |
        INSERT INTO `user` (`id`, `email`, `name`) VALUES (1, 'a@example.com', '김민준');
        INSERT INTO `order` (`id`, `user_id`, `amount`, `status`) VALUES (1, 1, 15000, 'PAID');
```
