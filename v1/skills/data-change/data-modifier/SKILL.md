---
name: data-modifier
description: Incrementally update an existing data artifact — seed dataset, translation catalog, knowledge-base corpus, data-analysis output, or audit finding set — to reflect a changed source: diff old vs new input, upsert only the added/changed items, preserve everything still valid (existing rows, deterministic seeds, human-reviewed translations), then re-run the domain validator to prove integrity. Not a regenerator — it never re-rolls unaffected data.
version: 1.0.0
category: data-change
tags:
  - data-change
  - modify
  - incremental
  - upsert
model: inherit
invokes:
  - data-schema-analyzer
  - mock-record-generator
  - relationship-linker
  - seed-export-generator
  - seed-data-validator
  - string-extractor
  - catalog-translator
  - plural-format-handler
  - localization-validator
  - content-chunker
  - kb-indexer
  - faq-generator
  - onboarding-generator
  - glossary-generator
  - knowledge-base-validator
  - dataset-profiler
  - data-cleaner
  - data-analyzer
  - chart-spec-generator
  - insight-writer
  - analysis-report-generator
  - data-analysis-validator
  - ruleset-loader
  - clause-extractor
  - conformance-checker
  - gap-analyzer
  - risk-scorer
  - audit-report-generator
  - audit-validator
inputs:
  - data_modify_contract
outputs:
  - data_modify_result
---

# Goal

Bring an existing data artifact up to date with a changed source, touching only what
changed. A full pipeline re-run would discard valid work — existing rows, the deterministic
generation seed, already-reviewed translations — and re-roll everything non-deterministically.
This skill computes the delta, upserts just the affected items via the domain's own
generators, and re-runs the domain validator so integrity stays a deterministic pass/fail.

# Inputs

```yaml
data_modify_contract:
  domain: seed-data          # seed-data | localization | knowledge-base | data-analysis | audit
  target: <entity / key-set / corpus doc / metric affected>
  new_source: <changed schema | source strings | corpus docs | refreshed dataset>
  existing_artifact: <the current seed_bundle | localization_bundle | knowledge_base | analysis_report>
  preserve: { seed: 42, reviewed_translations: true }   # what must survive untouched
```

# Output

```yaml
data_modify_result:
  domain: seed-data | localization | knowledge-base | data-analysis | audit
  added: [...]        # new records / keys
  changed: [...]      # updated records / retranslated keys
  preserved: <count>  # untouched valid items
  references_updated: [...]   # FKs re-linked / plural variants / locale parity
  validation: pass | fail
```

# Workflow

## Step 1 — Diff the source
Compute what actually changed between the existing artifact and `new_source`.
- **seed-data** — invoke `data-schema-analyzer` on old vs new schema: added/changed/removed
  fields, entities, and volume deltas.
- **localization** — invoke `string-extractor` on old vs new source: added keys, changed
  source values (need retranslation), and keys no longer present (flag for `data-remover`,
  do not delete here).
- **knowledge-base** — invoke `content-chunker` on added/changed corpus docs only: which
  chunks are new or changed, and which existing artifacts (FAQ/onboarding/glossary) cite
  chunks that changed. Removed docs flag their chunks for `data-remover`.
- **data-analysis** — invoke `dataset-profiler` on the refreshed dataset (or the added
  metric/dimension): which columns/rows changed and which findings/charts depend on them.
- **audit** — invoke `ruleset-loader` (changed ruleset) or `clause-extractor` (changed target
  document): which rules/clauses changed, and which findings depend on them. Unchanged findings
  are preserved.

## Step 2 — Plan the minimal upsert
Scope the write to the delta only. Existing valid rows and reviewed translations are
`preserve`d and must not be regenerated. A new non-null field on an existing entity means
backfilling existing rows, not recreating them.

## Step 3 — Produce the changed subset
- **seed-data** — invoke `mock-record-generator` for new rows / backfilled fields (reuse the
  original `seed` so existing rows reproduce identically), then `relationship-linker` to wire
  FKs for the new rows into the existing graph.
- **localization** — invoke `catalog-translator` for added/changed keys only (existing
  translations pass through untouched), then `plural-format-handler` for plural/format on the
  new keys.
- **knowledge-base** — re-chunk only changed docs, invoke `kb-indexer` to fold new chunks
  into the existing taxonomy, then regenerate only the affected entries via `faq-generator` /
  `onboarding-generator` / `glossary-generator`; entries citing unchanged chunks are kept.
- **data-analysis** — invoke `data-cleaner` then `data-analyzer` on the affected slice only,
  then `chart-spec-generator` / `insight-writer` to refresh dependent charts/findings.
- **audit** — re-check only the affected rules/clauses via `conformance-checker`, re-run
  `gap-analyzer` and `risk-scorer` on the changed findings, keeping unchanged findings as-is.

## Step 4 — Re-export / reassemble
For seed-data, invoke `seed-export-generator` to rewrite fixtures merging preserved + changed
rows; localization catalogs are emitted per locale; knowledge-base is reassembled via its
`kb-indexer` artifacts, data-analysis via `analysis-report-generator`, and audit via
`audit-report-generator`.

## Step 5 — Validate integrity
Re-run the domain validator: `seed-data-validator` (FK/constraint/uniqueness/volume),
`localization-validator` (key parity/placeholder/untranslated/format), `knowledge-base-validator`
(citation integrity/grounding/term consistency), `data-analysis-validator` (source-trace/chart
validity/numeric reconciliation), or `audit-validator` (rule coverage/traceability/stats/verdict).
Report the verdict; a `fail` blocks completion.

# Rules

- Upsert only the delta — never regenerate rows/translations that did not change.
- Preserve the deterministic seed so existing seed-data rows reproduce byte-identically;
  reusing a different seed re-rolls the whole dataset and is a defect.
- Preserve human-reviewed / glossary-fixed translations; only retranslate keys whose source
  value changed or that are newly added.
- Keys/rows that disappeared from the source are **not** deleted here — flag them and route
  to `data-remover` (deletion needs referential-integrity handling).
- A new NOT NULL field requires a backfill plan for existing rows; do not leave nulls that
  would fail the validator.
- Every run ends with the domain validator; complete only on `pass`.

# Examples

Input:

```yaml
data_modify_contract:
  domain: seed-data
  target: User
  new_source: "User gains NOT NULL `tier` enum{FREE,PRO}; count 50 → 80"
  existing_artifact: <seed_bundle: 50 users, 200 orders>
  preserve: { seed: 42 }
```

Output (abridged):

```
▶ diff (data-schema-analyzer) → +field User.tier (NOT NULL enum), +30 User rows
▶ upsert
  ├ mock-record-generator → backfill tier on 50 existing (seed 42), generate 30 new users
  └ relationship-linker   → wire orders for new users; existing FKs untouched
▶ re-export (seed-export-generator) → users.sql rewritten (80), orders.sql unchanged
▶ validate (seed-data-validator) → pass (0 dangling FK, tier ∈ enum, count=80)
── data_modify_result
  added: [30 User rows]
  changed: [50 User rows (tier backfilled)]
  preserved: 200 Order rows
  references_updated: [Order.userId for new users]
  validation: pass
```
