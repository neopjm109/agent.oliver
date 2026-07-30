---
name: data-pipeline-orchestrator
description: Top-level pipeline over the independent data domains — generates the requested data artifacts (seed data, localization catalogs, knowledge base, analysis report, audit report) and, when a domain validator fails, self-heals via data-remediation until each artifact passes or the budget is exhausted. The data-side analog of app-orchestrator; the upper entry that exposes data-remediation.
version: 1.0.0
category: orchestrator
tags:
  - orchestrator
  - data
  - pipeline
  - entrypoint
  - self-healing
model: inherit
invokes:
  - seed-data-orchestrator
  - localization-orchestrator
  - knowledge-base-orchestrator
  - data-analysis-orchestrator
  - audit-orchestrator
  - data-remediation-orchestrator
inputs:
  - data_requests
  - options
outputs:
  - data_artifacts
  - data_validation_report
  - remaining_violations
---

# Goal

Run one or more independent data domains as a single pipeline and return **validated**
artifacts. Each domain orchestrator already ends with its own validator; this pipeline
collects those verdicts and, for any domain that failed, invokes
`data-remediation-orchestrator` to self-heal — routing each violation to a surgical
`data-change` fix or a full re-generation, then re-validating. This skill **never generates
or edits data directly**; it only sequences the domain orchestrators and the remediation
loop. It is the data-side counterpart of `app-orchestrator` and the natural upper home of
`data-remediation-orchestrator`.

# Inputs

```yaml
data_requests:
  - { domain: seed-data,    request: <seed_request + schema_source> }
  - { domain: localization, request: <l10n_request + source> }
  - { domain: knowledge-base, request: <kb_request + corpus_documents> }   # optional
  - { domain: data-analysis,  request: <analysis_request + dataset> }      # optional
options:
  max_remediation_iterations: 2
```

# Output

```yaml
data_artifacts:
  seed-data: <seed_bundle>            # present per requested domain
  localization: <localization_bundle>
  knowledge-base: <knowledge_base>
  data-analysis: <analysis_report>
data_validation_report:
  - { domain: seed-data, result: pass | fail, violations: [...] }
remaining_violations: [...]           # unresolved after remediation
```

# Workflow

## Step 1 — Generate requested domains
For each entry in `data_requests`, invoke its domain orchestrator
(`seed-data-orchestrator` / `localization-orchestrator` / `knowledge-base-orchestrator` /
`data-analysis-orchestrator` / `audit-orchestrator`). Each returns its artifact plus a validator verdict.

## Step 2 — Remediate failures (conditional)
For every domain whose verdict is `fail`, invoke `data-remediation-orchestrator` with that
`data_validation_report`, the produced artifact, and the source — bounded by
`options.max_remediation_iterations`. Domains that already passed are left untouched.

## Step 3 — Assemble
Merge the (healed) artifacts into `data_artifacts`, collect the final per-domain verdicts
into `data_validation_report`, and promote anything still failing into `remaining_violations`.

# Rules

- Never generate or edit data directly; only delegate to the domain orchestrators and
  `data-remediation-orchestrator`.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Domains are independent — a failure in one does not block generating the others.
- Remediate only domains that failed; never re-run a passing domain.
- Remediation is bounded by `max_remediation_iterations`; unresolved violations are promoted,
  not retried indefinitely.
- Boundary: this heals **data** artifacts. Code generation/validation is `app-orchestrator`.

# Examples

Input:

```yaml
data_requests:
  - { domain: seed-data, request: { entities: [User×50, Order×200], schema_source: <domain_model> } }
  - { domain: localization, request: { target_locales: [en, ja], source: <ko catalog> } }
options: { max_remediation_iterations: 2 }
```

Output (abridged):

```
✔ seed-data     → 250 rows; validate → fail (1 orphan FK)
✔ localization  → en/ja catalogs; validate → pass
↻ remediate seed-data (1/2) → data-change re-points orphan FK → validate → pass
── data_artifacts: { seed-data: seed_bundle(250), localization: bundle(en,ja) }
   data_validation_report: [seed-data: pass, localization: pass]
   remaining_violations: []
```
