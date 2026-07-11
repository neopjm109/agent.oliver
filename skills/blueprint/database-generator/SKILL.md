---
name: database-generator
description: Produce a physical database schema design (tables, relationships, indexes, constraints, migration strategy, ORM mapping rules) from the domain model and architecture design. Use at the blueprint stage after the domain model is defined.
version: 1.0.0
category: blueprint
tags:
  - database
  - schema
  - sql
  - erd
  - persistence
model: inherit
invokes: []
inputs:
  - domain_model
  - architecture_design
outputs:
  - database_schema
---

# Goal

Convert the domain model into a physical database schema design: tables, relationships,
indexes, constraints, a migration strategy, and domain-to-schema mapping rules. This is a
**design-time skill — it does not generate code, DDL files, or migration scripts**; it
emits a `database_schema` artifact. Actual migration/DDL code is produced later by the
backend migration-generator. The default target database is MariaDB.

# Inputs

```yaml
domain_model:
  aggregates:
    - name: Order
      root: Order
      entities: [Order, OrderItem]
      value_objects: [Money]
  entities:
    - name: Order
      identity: orderId
      attributes: [status, placedAt]
    - name: OrderItem
      identity: orderItemId
      attributes: [productId, quantity, unitPrice]
  relationships:
    - from: Order
      to: OrderItem
      type: composition (1..*)
architecture_design:
  technology_stack:
    database: MariaDB
  scalability_strategy: read-heavy, index order lookups by customer
```

# Output

```yaml
database_schema:
  tables:
    - name: orders
      columns:
        - { name: id, type: BIGINT, pk: true, auto_increment: true }
        - { name: status, type: VARCHAR(32), nullable: false }
        - { name: placed_at, type: DATETIME, nullable: false }
    - name: order_items
      columns:
        - { name: id, type: BIGINT, pk: true, auto_increment: true }
        - { name: order_id, type: BIGINT, nullable: false }
        - { name: product_id, type: BIGINT, nullable: false }
        - { name: quantity, type: INT, nullable: false }
        - { name: unit_price_amount, type: DECIMAL(19,4), nullable: false }
        - { name: unit_price_currency, type: CHAR(3), nullable: false }
  relationships:
    - { from: order_items.order_id, to: orders.id, type: many-to-one, on_delete: CASCADE }
  indexes:
    - { table: order_items, columns: [order_id], name: idx_order_items_order }
  constraints:
    - { table: order_items, type: foreign_key, columns: [order_id], references: orders(id) }
  migration_strategy: versioned forward-only migrations (e.g. Flyway)
  mapping_rules:
    - domain: Order            -> table: orders
    - domain: OrderItem        -> table: order_items
    - domain: Money (VO)       -> embedded columns unit_price_amount + unit_price_currency
```

# Workflow

## Step 1 — Determine persistence strategy

From the architecture and domain model, decide the persistence approach: relational vs
NoSQL (relational by default), normalization level, and how aggregate boundaries map to
persistence.

## Step 2 — Map entities and value objects to tables

Map entities to tables. Map value objects to embedded columns (or a child table when they
are collections). Assign column types, nullability, and primary keys.

## Step 3 — Define relationships and constraints

Define one-to-one, one-to-many, and many-to-many relationships as foreign keys. Add
primary keys, unique constraints, and not-null rules that enforce domain invariants at the
schema level where appropriate.

## Step 4 — Define indexes

Add indexes for known query patterns, join columns, and performance hotspots identified in
the architecture design.

## Step 5 — Define migration strategy and mapping rules

Describe the schema-evolution approach (versioned, forward-only migrations) and record the
explicit domain-to-schema mapping rules for downstream generators.

# Rules

- Never generate implementation code, DDL files, or migration scripts — emit a design
  artifact only. DDL/migration code is the backend migration-generator's job.
- The schema must strictly follow the domain model: no tables without domain
  justification.
- Preserve aggregate boundaries; align tables to aggregates and avoid unnecessary joins.
- Every schema element must reference a domain entity, requirement, or architecture module
  (traceability).
- The design is complete only when every aggregate is mapped, every entity has a
  persistence representation, and relationships, indexes, and constraints are specified.

# Examples

Input:

```yaml
domain_model:
  aggregates:
    - name: User
      root: User
      entities: [User]
      value_objects: [Email]
  entities:
    - name: User
      identity: userId
      attributes: [displayName, createdAt]
  value_objects:
    - name: Email
      fields: [address]
architecture_design:
  technology_stack: { database: MariaDB }
```

Output (abridged):

```yaml
database_schema:
  tables:
    - name: users
      columns:
        - { name: id, type: BIGINT, pk: true, auto_increment: true }
        - { name: email, type: VARCHAR(255), nullable: false }
        - { name: display_name, type: VARCHAR(100), nullable: false }
        - { name: created_at, type: DATETIME, nullable: false }
  indexes:
    - { table: users, columns: [email], name: uq_users_email, unique: true }
  constraints:
    - { table: users, type: unique, columns: [email] }   # enforces Email uniqueness invariant
  mapping_rules:
    - domain: User        -> table: users
    - domain: Email (VO)  -> embedded column email
  migration_strategy: versioned forward-only migrations (e.g. Flyway)
```
