---
name: seed-data-orchestrator
description: Coordinate the end-to-end seed/mock data pipeline that turns a data model (domain model, DB schema, or entity list) into realistic, referentially-consistent sample records exported as SQL/JSON/CSV fixtures. Use to populate a generated app for demos and tests. Entrypoint of the seed-data domain.
version: 1.0.0
category: seed-data
tags:
  - seed-data
  - orchestrator
  - mock-data
  - fixtures
  - pipeline
  - entrypoint
model: inherit
invokes:
  - docs-analyze-xlsx
  - docs-analyze-csv
  - docs-analyze-docx
  - docs-analyze-markdown
  - data-schema-analyzer
  - mock-record-generator
  - relationship-linker
  - seed-export-generator
  - seed-data-validator
inputs:
  - seed_request
  - schema_source
  - options
outputs:
  - seed_bundle
---

# Goal

Produce realistic seed data by orchestrating specialized seed-data skills. This skill
**never generates records directly** — it resolves the schema, sequences the pipeline,
delegates each stage, and returns exported fixtures plus a validation report. It produces
data rows, never schema/DDL and never runtime code.

# Inputs

```yaml
seed_request:
  entities:
    - { name: User, count: 50 }
    - { name: Order, count: 200 }
  locale: ko-KR            # realistic names/addresses/phones
schema_source:
  domain_model: <from blueprint/domain-model-generator, or inline>
  documents: [schema.xlsx]   # optional
options:
  export_format: sql        # sql | json | csv
  seed: 42                  # deterministic generation seed
  asset_manifest: null      # optional: point image fields at asset-manifest entries
```

# Output

```yaml
seed_bundle:
  records: { <Entity>: [ {...}, ... ] }
  export: { format: <fmt>, files: [ { path, content } ] }
  validation: <from seed-data-validator>
```

# Workflow

## Step 1 — Resolve the schema
If `schema_source.documents` are provided, invoke the matching `docs-analyze-*` skill.
Invoke `data-schema-analyzer` to produce a normalized field spec (types, constraints,
relationships) for each entity.

## Step 2 — Generate records
Invoke `mock-record-generator` to create `count` records per entity honoring types,
constraints, and `locale`, using `options.seed` for determinism.

## Step 3 — Link relationships
Invoke `relationship-linker` to wire foreign keys/references so the dataset is
referentially consistent (no dangling FKs, cardinality respected).

## Step 4 — Export
Invoke `seed-export-generator` to serialize records into the requested `export_format`.

## Step 5 — Validate
Invoke `seed-data-validator` to check referential integrity, constraints, uniqueness, and
volume.

## Step 6 — Return
Return `seed_bundle`. The pipeline ends here.

# Rules

- This skill only coordinates. Delegate every stage; never generate, link, export, or
  validate records directly.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Never generate schema/DDL or migrations — this domain produces DATA. Schema/DDL is
  `backend/migration-generator`; this pipeline consumes a schema and fills it with rows.
- Generation must be deterministic given `options.seed` so runs are reproducible.
- Respect all constraints from the schema; never emit rows that violate NOT NULL, unique,
  enum, or FK constraints.
- Error handling: if a `docs-analyze-*` skill fails, continue with the domain model. If a
  downstream stage fails, return partial records and mark the incomplete stage.

# Examples

Input:

```yaml
seed_request:
  entities: [ { name: User, count: 3 }, { name: Order, count: 5 } ]
  locale: ko-KR
schema_source: { domain_model: "<User(1)-(N)Order>" }
options: { export_format: sql, seed: 42 }
```

Output (abridged):

```
✔ schema  → User(id,name,email) · Order(id,user_id→User,amount,status)
✔ records → 3 users, 5 orders (locale ko-KR, seed 42)
✔ link    → 5 orders assigned to existing users (no dangling FKs)
✔ export  → seed.sql (8 INSERTs)
✔ validate→ pass (FK 0 orphans, unique email OK)

Bundle: seed.sql — 3 users, 5 orders (referentially consistent, seed 42)
```
