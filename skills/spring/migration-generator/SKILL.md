---
name: migration-generator
description: Generate production-ready database migration scripts and config using Flyway or Liquibase, with versioning, constraints, indexes, and safe rollback strategy.
version: 1.0.0
category: backend
tags:
  - spring-boot
  - flyway
  - liquibase
  - migration
  - database
model: inherit
invokes:
  - spring-senior-programmer
inputs:
  - migration_requirements
outputs:
  - migration_scripts
---

# Goal

Generate production-ready database migration scripts with proper versioning, constraints,
indexes, and a safe rollback strategy, using Flyway or Liquibase. Focus on safe, repeatable,
maintainable schema evolution.

# Inputs

```yaml
migration_requirements:
  tool: flyway            # flyway | liquibase
  purpose: create user table
  database: mariadb
  schema_changes:
    - create table users (id, name, email, created_at)
  rollback: true
  seed_data: false
```

# Output

```yaml
migration_scripts:
  - V1__Create_user_table.sql
  - rollback script (when applicable)
  - migration configuration (if required)
```

# Workflow

## Step 1 — Analyze requirements
Determine the migration strategy, database, and schema changes.

## Step 2 — Design the change
Generate schema changes with constraints and indexes; plan rollback where supported.

## Step 3 — Delegate implementation
Delegate the migration script/config authoring to `spring-senior-programmer`.

## Step 4 — Validate
Verify compatibility, immutability of applied migrations, and data safety.

# Rules

- Generate versioned, immutable-once-applied migrations; one logical change per migration.
- Flyway: follow `V<n>__Description.sql` naming; Liquibase: unique changeset IDs, structured changelogs.
- Prefer additive, non-destructive changes; never drop production data unless explicitly requested.
- Generate primary/foreign keys, unique constraints, and indexes for frequently queried columns.
- Never embed business rules in migrations; keep schema changes separate from application logic.

# Examples

Input:

```yaml
migration_requirements: { tool: flyway, purpose: create user table, database: mariadb }
```

Output (`V1__Create_user_table.sql`):

```sql
CREATE TABLE users (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    name       VARCHAR(100) NOT NULL,
    email      VARCHAR(255) NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uq_users_email UNIQUE (email)
);
CREATE INDEX idx_users_created_at ON users (created_at);
```
