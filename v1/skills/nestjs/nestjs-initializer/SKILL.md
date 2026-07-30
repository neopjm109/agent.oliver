---
name: nestjs-initializer
description: Scaffold a NestJS project once — base module structure, TypeORM datasource, ConfigModule, main.ts bootstrap, and tooling (tsconfig/eslint/jest) — before feature generation. NestJS peer of spring-initializer.
version: 1.0.0
category: backend
tags:
  - nestjs
  - initializer
  - scaffold
model: inherit
invokes:
  - nestjs-senior-programmer
inputs:
  - application_blueprint
  - target_stack
outputs:
  - project_scaffold
---

# Goal

Create the one-time NestJS project skeleton so feature generators have a consistent base:
root/app module, TypeORM datasource wiring, ConfigModule, bootstrap, and standard tooling.
Implementation is delegated to `nestjs-senior-programmer`. Runs once, before the feature loop.

# Inputs

```yaml
application_blueprint: { architecture, database }
target_stack: { backend: nestjs, database: MariaDB }
```

# Output

```yaml
project_scaffold:
  structure: "src/{app.module.ts, main.ts, common/, config/, modules/}"
  datasource: "TypeORM DataSource wired to the target DB"
  config: "ConfigModule (env schema validation)"
  tooling: "tsconfig, eslint/prettier, jest, package.json scripts"
```

# Workflow

## Step 1 — Base structure
Create the root module, `main.ts` bootstrap, and a `modules/` area for feature modules.

## Step 2 — Data & config
Wire a TypeORM `DataSource` to the target DB and a validated `ConfigModule`.

## Step 3 — Tooling
Add tsconfig, lint/format, Jest config, and package scripts (start/build/test/migration).

## Step 4 — Return
Return `project_scaffold`. Stop.

# Rules

- Scaffold only; do not generate feature domain/API code (that is the generators' job).
- **pnpm is the preferred package manager** (as for every TypeScript/Node skill): emit a
  `pnpm-lock.yaml` and run scripts via `pnpm` (`pnpm install`, `pnpm start:dev`,
  `pnpm migration:run`, `pnpm build`, `pnpm test`). npm/yarn are a supported fallback, but pnpm
  is the default the downstream `cicd-generator` and `dependency-license-validator` assume
  (lockfile-driven, so a different lockfile is still honored).
- Provide the base datasource/config; feature-level typed config is `nestjs-config-generator`.
- Run once per project, before the feature loop.
- Delegate concrete file contents to `nestjs-senior-programmer`.

# Examples

Input:

```yaml
target_stack: { backend: nestjs, database: MariaDB }
```

Output (abridged):

```yaml
project_scaffold:
  structure: "src/app.module.ts, src/main.ts, src/config/, src/modules/"
  datasource: "TypeORM DataSource (mysql driver) → MariaDB"
  config: "ConfigModule.forRoot({ validate })"
  tooling: "jest + supertest, eslint, pnpm scripts (pnpm start:dev, pnpm migration:run); pnpm-lock.yaml"
```
