---
name: data-remover
description: Remove entities / rows / translation keys / KB corpus docs / analysis metrics / audit findings from an existing data artifact (seed dataset, catalog, knowledge-base, data-analysis output, or audit result) without breaking referential integrity — reverse-dependency scan (foreign keys, plural variants, locale parity), cascade or block, then re-run the domain validator to prove nothing dangles. Refuses to remove a parent with live child references unless cascade is explicit.
version: 1.0.0
category: data-change
tags:
  - data-change
  - delete
  - referential-integrity
  - cascade
model: inherit
invokes:
  - relationship-linker
  - seed-export-generator
  - seed-data-validator
  - plural-format-handler
  - localization-validator
  - kb-indexer
  - knowledge-base-validator
  - analysis-report-generator
  - data-analysis-validator
  - risk-scorer
  - audit-report-generator
  - audit-validator
inputs:
  - data_remove_contract
outputs:
  - data_remove_result
---

# Goal

Remove data that already exists — an entity, rows, or a set of translation keys — **without
leaving dangling references**. In a linked dataset a deleted parent orphans its children's
foreign keys; in a catalog a deleted key must vanish from every locale or parity breaks.
This skill maps the reference graph first, removes only what is safe, cascades or blocks the
rest, and re-runs the domain validator so the result is a deterministic pass.

# Inputs

```yaml
data_remove_contract:
  domain: seed-data          # seed-data | localization | knowledge-base | data-analysis | audit
  target: <entity/rows | key-set | corpus doc/chunks | metric/finding/chart to remove>
  cascade: false             # true = also remove dependents; false = block if live refs
  existing_artifact: <seed_bundle | localization_bundle | knowledge_base | analysis_report>
```

# Output

```yaml
data_remove_result:
  domain: seed-data | localization | knowledge-base | data-analysis | audit
  removed: [...]
  cascaded: [...]            # dependents removed because target went away
  blocked_by: [...]          # live references that prevented removal, if any
  references_updated: [...]  # FKs re-checked / locales synced / plural variants dropped
  validation: pass | fail
```

# Workflow

## Step 1 — Resolve the target
Pin exactly what is removed: a whole entity/table, a filtered set of rows, or a key-set
across the catalog.

## Step 2 — Reverse-dependency scan (the danger zone)
Find every reference to the target. Where it lives is domain-specific:

| reference | seed-data | localization |
|-----------|-----------|--------------|
| direct dependents | child rows whose FK points at the target row/entity | plural/select variants of the key |
| structural parity | join rows, unique/index assumptions | the key in **every** target locale + the source locale |
| derived | requested volume/count expectations | glossary entries, ICU sub-messages referencing the key |

- **knowledge-base** — direct: chunks belonging to the removed corpus doc; dependents: FAQ /
  onboarding / glossary entries that cite those chunks (cascade-delete if they cite *only*
  removed chunks, re-source via `data-modifier` if they also cite survivors, block otherwise);
  structural: index topics that would become empty.
- **data-analysis** — direct: the removed metric/dimension/finding; dependents: charts and
  insights that reference it (a chart on a dropped metric must go too); structural: request
  coverage — note the removed item so the validator's coverage check stays honest.
- **audit** — direct: the removed rule and its finding; dependents: its gap and risk score;
  structural: the report stats and verdict, which must be recomputed after removal.

## Step 3 — Classify each dependent
For each reference: **cascade-delete** (dependent exists only for the target),
**re-point** (redirect an FK to a surviving parent), or **block** (something live still needs
it). If any is `block` and `cascade` is false, stop and report `blocked_by` — remove nothing.

## Step 4 — Remove and reconcile
- **seed-data** — drop the target rows, apply cascade/re-point, then invoke
  `relationship-linker` to confirm no FK dangles, and `seed-export-generator` to rewrite the
  affected fixtures. Adjust requested counts so the volume check still holds.
- **localization** — drop the key from the source and all target locales together; invoke
  `plural-format-handler` to remove its plural/select variants so no partial forms remain.
- **knowledge-base** — drop the target chunks; cascade-delete entries citing only removed
  chunks (re-source shared-citation entries via `data-modifier`, or block); invoke `kb-indexer`
  to rebuild the taxonomy so no topic dangles.
- **data-analysis** — drop the target metric/finding and its dependent charts/insights, then
  invoke `analysis-report-generator` to reassemble the report without them.
- **audit** — drop the target rule's finding/gap, invoke `risk-scorer` to recompute affected
  scores, then `audit-report-generator` to recompute stats/verdict and reassemble the report.

## Step 5 — Validate integrity
Re-run the domain validator: `seed-data-validator` (0 orphaned FKs, counts consistent),
`localization-validator` (parity holds, no missing/orphan keys), `knowledge-base-validator`
(no dangling citations, no empty topics), `data-analysis-validator` (no chart/finding
references a removed item), or `audit-validator` (stats/verdict reconcile after removal).
Report the verdict; a `fail` blocks completion.

# Rules

- Never remove a target with live inbound references unless `cascade: true` — otherwise
  report `blocked_by` and stop.
- Deleting a catalog key removes it from **every** locale plus the source in the same pass —
  a key left in some locales fails parity.
- Deleting seed rows must leave zero dangling foreign keys: cascade to children or re-point
  them to a surviving parent, never leave orphans.
- Removing rows updates the requested volume/count expectation so the validator's count check
  still passes.
- Always produce the reference reconciliation list (removed / cascaded / re-pointed / blocked).
- Deletion is not modification — "replace X with Y" is a `data-modifier` upsert of Y plus a
  `data-remover` delete of X, sequenced delete-last by the orchestrator.
- Every run ends with the domain validator; complete only on `pass`.

# Examples

Input:

```yaml
data_remove_contract:
  domain: seed-data
  target: "entity Coupon (retired feature)"
  cascade: true
  existing_artifact: <seed_bundle: 50 users, 200 orders, 30 coupons, orders.couponId FK>
```

Output (abridged):

```
▶ reverse-dep scan
  ├ Order.couponId → 40 orders reference a coupon
  └ decision: cascade=true → re-point (set couponId = null; column nullable)
▶ remove → 30 Coupon rows dropped
▶ reconcile (relationship-linker) → 0 dangling FK; (seed-export-generator) coupons.sql removed, orders.sql rewritten
▶ validate (seed-data-validator) → pass (no orphan FK, counts consistent)
── data_remove_result
  removed: [30 Coupon rows, coupons fixture]
  cascaded: []
  blocked_by: []
  references_updated: [Order.couponId → null on 40 rows]
  validation: pass
```
