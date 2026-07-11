---
name: spec-remover
description: Remove a design-spec element and cascade-remove the code generated from it — reverse-dependency scan across the spec set (tables, endpoints, events, components referencing the target) and the downstream code, cascade or block, gate the spec, then delete the dependent code via code-change and gate the code. Refuses to remove a spec element other elements still depend on unless cascade is explicit.
version: 1.0.0
category: spec-change
tags:
  - spec-change
  - delete
  - cascade
  - blueprint
  - design
model: inherit
invokes:
  - database-generator
  - api-spec-generator
  - design-system-generator
  - blueprint-validator
  - design-validator
  - code-change-orchestrator
  - validation-orchestrator
inputs:
  - spec_remove_contract
outputs:
  - spec_remove_result
---

# Goal

Remove a spec element and the code generated from it **without leaving either side dangling**.
A spec is a contract, so dropping an entity or token orphans its tables, endpoints, events,
and every code artifact built from it. This skill maps the reference graph across the spec set
and the downstream code, removes only what is safe, cascades or blocks the rest, gates the
spec, then deletes the dependent code via `code-change` and gates the code.

# Inputs

```yaml
spec_remove_contract:
  spec_domain: blueprint     # blueprint | design
  target: <spec element to remove — entity / endpoint / event / token / component>
  cascade: false             # true = also remove dependents; false = block if live refs
  existing_blueprint: <current spec set>
  existing_design_system: <current design specs>
  target_stack: { backend: spring, frontend: nextjs }
```

# Output

```yaml
spec_remove_result:
  spec_removed: [<spec elements removed>]
  cascaded: [<spec/code dependents removed>]
  blocked_by: [<live references that prevented removal, if any>]
  spec_gate: pass | fail
  code_removed: [<code artifacts deleted via code-change>]
  code_gate: pass | fail
```

# Workflow

## Step 1 — Resolve the target
Pin the exact spec element to remove (entity, endpoint, event, token, component).

## Step 2 — Reverse-dependency scan (the danger zone)
Find every reference across two levels:
- **within the spec set** — a domain entity is referenced by its database table, api-spec
  resources, and events; a token is referenced by design-system components and screens.
- **downstream code** — the code generated from the element (entity → entity/DTO/mapper/
  migration/repository; endpoint → controller/API client; token → theme/component styles).

## Step 3 — Classify each dependent
For each reference: **cascade-delete** (exists only for the target), **re-point** (redirect to
a survivor), or **block** (something live still needs it). If any is `block` and `cascade` is
false, stop and report `blocked_by` — remove nothing.

## Step 4 — Remove from the spec and reconcile
Drop the element and apply cascade/re-point, using `database-generator` / `api-spec-generator`
(blueprint) or `design-system-generator` (design) to rebuild any references that survive.

## Step 5 — Spec gate
Run `blueprint-validator` / `design-validator` — no orphan table, no endpoint on a removed
entity, no component on a removed token. A `fail` blocks propagation.

## Step 6 — Ripple deletion to code and gate
Invoke `code-change-orchestrator` (operation `delete`) to remove the dependent code with its
own reference cleanup, then `validation-orchestrator` to confirm nothing dangles. Report the
verdict; a `fail` blocks completion.

# Rules

- Never remove a spec element other elements still depend on unless `cascade: true` — otherwise
  report `blocked_by` and stop.
- Removing a spec element removes its in-spec dependents (table/endpoint/event) and its
  downstream code in the same operation; leaving orphan code or tables is a defect.
- Delegate all code deletion to `code-change` (which handles import/DI/route/FK cleanup); never
  edit code directly.
- Both gates must pass (spec then code); complete only when the code gate is `pass`.
- Deletion is not modification — "replace entity X with Y" is a `spec-modifier` add of Y plus a
  `spec-remover` delete of X, sequenced delete-last by the orchestrator.

# Examples

Input:

```yaml
spec_remove_contract:
  spec_domain: blueprint
  target: Coupon (entity, feature retired)
  cascade: true
  target_stack: { backend: spring }
```

Output (abridged):

```
▶ reverse-dep scan
  ├ spec: coupons table, /coupons endpoints, CouponApplied event, Order.couponId ref
  └ code: Coupon.java, CouponController, CouponRepository, migration, OrderService.applyCoupon
▶ remove  → drop Coupon from domain/db/api/events; api-spec rebuilds Order DTO without couponId
▶ spec gate → blueprint-validator: pass (no orphan table/endpoint/event)
▶ ripple  → code-change (delete): removes Coupon.* , re-points OrderService; emits drop migration
▶ code gate → validation-orchestrator: pass (no dangling refs)
── spec_remove_result
  spec_removed: [domain_model.Coupon, database_schema.coupons, api_specification./coupons, event_topology.CouponApplied]
  cascaded: [Coupon.java, CouponController, CouponRepository, OrderService.applyCoupon]
  blocked_by: []
  spec_gate: pass
  code_gate: pass
```
