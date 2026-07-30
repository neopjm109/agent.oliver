---
name: data-change-orchestrator
description: Routes a change request against an existing generated data artifact (seed dataset, translation catalog, knowledge base, analysis report, or audit report) to the right operation — modify (incremental upsert to reflect changed input) or delete (referential-integrity removal) — and delegates to data-modifier / data-remover. Use when the source changed and the artifact must be updated in place, not regenerated from scratch.
version: 1.0.0
category: data-change
tags:
  - orchestrator
  - data-change
  - modify
  - delete
  - referential-integrity
model: inherit
invokes:
  - data-modifier
  - data-remover
inputs:
  - data_change_request
  - target_domain
outputs:
  - data_change_summary
---

# Goal

Turn a change request against an **existing** data artifact — a seed dataset (SQL/JSON/CSV
fixtures), a translation catalog, a knowledge base (FAQ/onboarding/glossary), an analysis
report, or an audit report — into the correct operation and route it. This skill **never edits data directly**;
it classifies the request, picks the operation, passes a change contract to the worker, and
reports the result. It is the counterpart of the generation pipelines
(`seed-data-orchestrator`, `localization-orchestrator`, `knowledge-base-orchestrator`,
`data-analysis-orchestrator`, `audit-orchestrator`), which produce artifacts from scratch; this one *changes* what
is already there while preserving the parts that are still valid.

Data artifacts are not refactored (there is no behavior to preserve), so only two operations
exist:

- **modify** — the source input changed; upsert only the affected items and keep the rest
  (new schema field, new/changed strings, adjusted volume). → `data-modifier`
- **delete** — an entity / rows / keys should be removed, and everything that referenced
  them (foreign keys, plural variants, catalog parity) must stay consistent. → `data-remover`

Every operation ends by re-running the domain's own validator (`seed-data-validator` / `localization-validator` / `knowledge-base-validator` / `data-analysis-validator` / `audit-validator`) so integrity is a deterministic pass/fail, not an assumption.

# Inputs

```yaml
data_change_request:
  intent: <free-text; e.g. "add a `tier` column to User and backfill 50 rows">
  target: <entity / table / key-set affected>
  operation: modify | delete    # optional hint; classified if absent
  new_source: <the changed schema / string set / corpus / dataset, when modifying>
target_domain: seed-data        # seed-data | localization | knowledge-base | data-analysis | audit
```

# Output

```yaml
data_change_summary:
  operation: modify | delete
  worker: data-modifier | data-remover
  domain: seed-data | localization | knowledge-base | data-analysis | audit
  items_touched: [<records / keys upserted or removed>]
  references_updated: [<FKs re-linked / locales synced / plural variants>]
  validation: pass | fail    # from the domain validator
```

# Workflow

## Step 1 — Classify operation
If items are being removed → delete. If the source changed and the artifact must catch up
(add/change/adjust) → modify. A "rename a key" or "replace an entity" is a modify (upsert
new) plus a delete (drop old), sequenced delete-last so nothing references a removed item.

## Step 2 — Resolve domain routing
Map `target_domain` to its delegates (generators for the changed subset + the domain
validator that gates every change):
- `seed-data → {data-schema-analyzer, mock-record-generator, relationship-linker,
  seed-export-generator, seed-data-validator}`
- `localization → {string-extractor, catalog-translator, plural-format-handler,
  localization-validator}`
- `knowledge-base → {content-chunker, kb-indexer, faq-generator, onboarding-generator,
  glossary-generator, knowledge-base-validator}`
- `data-analysis → {dataset-profiler, data-cleaner, data-analyzer, chart-spec-generator,
  insight-writer, analysis-report-generator, data-analysis-validator}`
- `audit → {ruleset-loader, clause-extractor, conformance-checker, gap-analyzer, risk-scorer,
  audit-report-generator, audit-validator}`

All five domains now carry a deterministic validator, so every change ends with a pass/fail
gate. For `data-analysis` note that artifacts are fully derived: "modify" re-analyzes only
the affected slice (refreshed rows, added dimension) and "delete" drops a metric/finding/chart
plus its dependent charts/insights — there are no human-authored parts to preserve.

## Step 3 — Delegate
Invoke the chosen worker with a change contract (`operation`, `domain`, `target`,
`new_source`). The worker touches only the affected items and re-runs the domain validator.

## Step 4 — Assemble summary
Merge the worker output into `data_change_summary`, including the validator verdict.

# Rules

- Never edit data directly; always delegate to a worker.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Do not fall back to the generation orchestrator for changes — a full re-run discards
  existing valid records/translations and non-deterministically re-rolls data. Changes go
  through a worker that preserves unaffected items.
- Data is not refactored — there is no `refactor` operation here (that concept is code-only,
  see `code-change/*`).
- Every change must end with the domain validator returning `pass`; a `fail` is reported,
  not hidden.
- Destructive removals (dropping rows/keys) require an explicit delete intent in the request.

# Examples

Input:

```yaml
data_change_request:
  intent: "Add locale `de` to the catalog; source keys are unchanged."
  operation: modify
target_domain: localization
```

Output (abridged):

```
▶ classify   → modify (new target locale, source keys unchanged)
▶ route      → data-modifier (localization delegates)
✔ modifier   → string-extractor: 0 new source keys; catalog-translator: de = 214 keys
             → plural-format-handler: de plural rules applied
✔ validate   → localization-validator: pass (parity across ko/en/ja/zh-CN/de)
── data_change_summary
  operation: modify
  domain: localization
  items_touched: [de.json (214 keys)]
  references_updated: [locale set +de]
  validation: pass
```
