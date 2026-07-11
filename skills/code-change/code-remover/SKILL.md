---
name: code-remover
description: Remove a symbol / file / feature from existing code and clean up everything that referenced it — reverse-dependency scan across imports, DI wiring, routes, config, tests, and FKs, then delete only what is safe and re-point or block the rest. Produces a deletion manifest. Refuses to delete anything with live inbound references unless cascade is explicit.
version: 1.0.0
category: code-change
tags:
  - code-change
  - delete
  - dead-code
  - reference-cleanup
model: inherit
invokes:
  - spring-senior-programmer
  - nestjs-senior-programmer
  - django-senior-programmer
  - typescript-senior-programmer
  - flutter-senior-programmer
  - validation-orchestrator
inputs:
  - remove_contract
outputs:
  - removal_result
---

# Goal

Remove code that already exists — a symbol, file, or whole feature — **without leaving
dangling references**. Deletion is the most dangerous operation because a single removed
file can break imports, DI registration, routes, config keys, tests, and database foreign
keys. This skill maps the full reverse-dependency graph first, deletes only what is safe,
and re-points or blocks the rest. It delegates any residual code edits (e.g. removing a
call site) to the stack's senior-programmer.

# Inputs

```yaml
remove_contract:
  target: <symbol / file / feature to remove>
  cascade: false        # true = also remove dependents; false = block if any live refs
  include_data: false   # true only with explicit confirmation (destructive: rows/tables)
  stack: spring         # spring | nestjs | django | nextjs | flutter
```

# Output

```yaml
removal_result:
  deleted: [<files / symbols removed>]
  repointed: [<references redirected elsewhere>]
  blocked_by: [<live references that prevented deletion, if any>]
  deletion_manifest: <full before→after list of every reference touched>
  verification: pass | fail
```

# Workflow

## Step 1 — Resolve the target
Pin the exact symbol/file/feature. Confirm what "the feature" includes (controller +
service + repo + DTOs + tests + migration?) before scoping the removal.

## Step 2 — Reverse-dependency scan (the danger zone)
Find **every** inbound reference to the target. The reference categories are universal, but
where they live is stack-specific — scan the right places for the target's stack:

| reference | spring | nestjs | django | nextjs (web/desktop) | flutter |
|-----------|--------|--------|--------|----------------------|---------|
| imports / usages | Java imports | TS imports | Python imports | TS imports | Dart imports |
| DI / registration | `@Component`/`@Bean`, component-scan, constructor injection | module `providers`/`imports`, constructor injection | `INSTALLED_APPS`, `AppConfig` | context/provider tree, hook usage | widget tree, provider/`GetIt` registration |
| routes / entry | `@RequestMapping` + API clients | controller decorators + clients | `urls.py` + DRF routers | `app/` routes, `<Link>`, API client | `Navigator`/`GoRouter` routes |
| config / flags | `application.yml`, `@ConfigurationProperties` | `ConfigModule`, `.env` | `settings.py` | `next.config`, env | `--dart-define`, config files |
| tests | JUnit | Jest/e2e specs | pytest/Django tests | Jest/RTL/Playwright | `flutter_test` |
| database | FKs + Flyway/Liquibase migrations | FKs + TypeORM migrations | FKs + Django migrations | (via backend) | (via backend) |

## Step 3 — Classify each dependent
For each reference decide: **cascade-delete** (the dependent exists only for the target),
**re-point** (redirect to a replacement), or **block** (something live still needs it). If
any reference is `block` and `cascade` is false, stop and report `blocked_by` — do not
delete.

## Step 4 — Delete and clean references
Remove the target and apply the cascade/re-point decisions. Delegate residual code edits
(removing call sites, unwiring DI, dropping routes) to the stack's senior-programmer
(`spring-senior-programmer`, `nestjs-senior-programmer`, `django-senior-programmer`,
`typescript-senior-programmer` for nextjs/Tauri, `flutter-senior-programmer`). For schema/data
removal, require `include_data: true`
and emit a reversible migration rather than an ad-hoc drop.

## Step 5 — Verify no dangling references
Confirm the build compiles, no import resolves to a removed symbol, no route/DI points at
nothing, and no FK references a dropped table. Emit the deletion manifest.

## Step 6 — Validate (gate)
Invoke `validation-orchestrator` to confirm the codebase still passes after removal (no
dangling references, tests green). This is the deterministic gate — symmetric with
data/doc/spec-change. Report the verdict; a `fail` blocks completion.

# Rules

- Never delete a target that has live inbound references unless `cascade: true` is set —
  otherwise report `blocked_by` and stop.
- Dead-code only by default: if you cannot prove a symbol is unused, report it, do not
  delete it.
- Always produce a deletion manifest (every reference: deleted / repointed / left).
- Data and schema removal is destructive and requires `include_data: true` plus explicit
  confirmation; prefer a reversible migration over a raw drop.
- Removing a public endpoint or exported symbol also removes/updates its callers and API
  clients in the same pass, or it is blocked.
- Deletion is not refactoring and not modification — if the goal is "replace X with Y",
  that is a modify (repoint) plus a delete, sequenced by the orchestrator.

# Examples

Input:

```yaml
remove_contract:
  target: LegacyCouponService (feature: promo coupons, retired)
  cascade: true
  include_data: false
  stack: spring
```

Output (abridged):

```
▶ reverse-dep scan
  ├ CouponController        → cascade-delete (only serves coupons)
  ├ OrderService.applyCoupon → re-point (inline no-op; orders no longer coupon-aware)
  ├ CouponRepository        → cascade-delete
  ├ coupons table (FK from orders.coupon_id) → include_data=false → emit migration, keep column nullable
  └ CouponServiceTest       → cascade-delete
── removal_result
  deleted: [LegacyCouponService, CouponController, CouponRepository, CouponServiceTest]
  repointed: [OrderService.applyCoupon → removed call, order flow intact]
  blocked_by: []
  deletion_manifest: 5 symbols removed, 1 call site repointed, 1 migration (V9__drop_coupons.sql)
  verification: pass  # build green, no dangling refs
```
