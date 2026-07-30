---
name: data-schema-analyzer
description: Normalize a data model (domain model, DB schema, or entity list) into a per-entity field spec with types, constraints, and relationships, ordered for generation. First stage of the seed-data pipeline.
version: 1.0.0
category: seed-data
tags:
  - seed-data
  - schema
  - analysis
  - normalization
model: inherit
invokes: []
inputs:
  - schema_material
  - options
outputs:
  - schema_spec
---

# Goal

Turn a data model into a normalized, generation-ready spec: each entity's fields, types,
constraints, and relationships, plus a topological generation order so parents exist before
children. This skill analyzes only; it does not generate data.

# Inputs

```yaml
schema_material:
  domain_model: <entities/fields/relations, or facts extracted from a document>
options:
  dialect: mysql   # optional, informs type mapping
```

# Output

```yaml
schema_spec:
  entities:
    - name: User
      fields:
        - { name: id, type: bigint, pk: true, generated: true }
        - { name: email, type: string, unique: true, nullable: false }
        - { name: name, type: string, nullable: false }
      relations: []
    - name: Order
      fields:
        - { name: id, type: bigint, pk: true }
        - { name: user_id, type: bigint, fk: { entity: User, field: id }, nullable: false }
        - { name: amount, type: decimal, min: 0 }
        - { name: status, type: enum, values: [PENDING, PAID, CANCELLED] }
      relations: [ { to: User, kind: many-to-one } ]
  generation_order: [ User, Order ]
```

# Workflow

## Step 1 — Extract entities & fields
List each entity with its fields, mapping to normalized types and capturing constraints
(pk, unique, nullable, min/max, enum values).

## Step 2 — Capture relationships
Record FKs and their cardinality between entities.

## Step 3 — Order generation
Topologically sort entities so referenced (parent) entities are generated first.

## Step 4 — Return
Return `schema_spec`. Stop.

# Rules

- Analyze only; never produce records.
- Capture every constraint that affects valid data (unique, nullable, enum, min/max, FK).
- `generation_order` must be a valid topological order; flag cycles rather than guessing.
- Do not invent fields or constraints absent from the source model.

# Examples

Input:

```yaml
schema_material: { domain_model: "User(id pk, email unique, name) ; Order(id pk, user_id -> User.id, amount>=0, status in {PENDING,PAID})" }
options: { dialect: mysql }
```

Output:

```yaml
schema_spec:
  entities:
    - { name: User, fields: [ {name: id, type: bigint, pk: true}, {name: email, type: string, unique: true}, {name: name, type: string} ], relations: [] }
    - { name: Order, fields: [ {name: id, type: bigint, pk: true}, {name: user_id, type: bigint, fk: {entity: User, field: id}}, {name: amount, type: decimal, min: 0}, {name: status, type: enum, values: [PENDING, PAID]} ], relations: [ {to: User, kind: many-to-one} ] }
  generation_order: [ User, Order ]
```
