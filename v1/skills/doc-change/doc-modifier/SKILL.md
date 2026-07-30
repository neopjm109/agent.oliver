---
name: doc-modifier
description: Revise the sections of an existing prose document that a changed source affects — locate the stale sections, regenerate only those via the doc-type generator, preserve every accurate section and its reviewed wording, then re-run doc-style-checker. Not a re-author — it never rewrites sections the change did not touch.
version: 1.0.0
category: doc-change
tags:
  - doc-change
  - modify
  - revise
  - documentation
model: inherit
invokes:
  - doc-outline-generator
  - doc-draft-generator
  - api-guide-generator
  - release-notes-generator
  - adr-generator
  - doc-style-checker
  - scope-definer
  - effort-estimator
  - pricing-generator
  - proposal-drafter
  - proposal-validator
inputs:
  - doc_modify_contract
outputs:
  - doc_modify_result
---

# Goal

Bring an existing document up to date with a changed source, revising only the sections that
went stale. A full re-author would discard accurate sections and their reviewed wording; this
skill finds the affected sections, regenerates just those via the doc-type generator, keeps
the rest verbatim, and re-runs `doc-style-checker` so consistency stays a deterministic
pass/fail.

# Inputs

```yaml
doc_modify_contract:
  doc_domain: docwriting     # docwriting | proposal
  doc_type: user-guide       # docwriting: user-guide|api-guide|release-notes|adr|reference; proposal: proposal
  target: <section(s) / heading(s) / scope-item affected>
  new_source: <the changed code / requirements / changeset / decision / RFP>
  existing_document: <the current document with its sections>
  style_guide: default       # carried to doc-style-checker
```

# Output

```yaml
doc_modify_result:
  revised: [<sections regenerated>]
  preserved: <count of untouched sections>
  references_updated: [<TOC entries / cross-links adjusted for changed headings>]
  gate: pass | fail          # doc-style-checker (+ proposal-validator for proposals)
  notes: <anything the caller should know>
```

# Workflow

## Step 1 — Locate stale sections
Read the existing document and map which sections the `new_source` affects. Sections the
change does not touch are out of scope and must be preserved verbatim, including their
already-reviewed wording.

## Step 2 — Plan the minimal revision
Scope the rewrite to the affected sections only. If a heading changes or a section splits,
note the structural impact for Step 4 (TOC/cross-references). Do not "improve" untouched
prose — that is out of scope.

## Step 3 — Regenerate the changed sections
- **docwriting** — invoke the `doc_type`'s generator for the affected sections only:
  `doc-draft-generator` (user-guide/reference), `api-guide-generator`,
  `release-notes-generator`, or `adr-generator`. Feed it the new source plus the surrounding
  sections as context so tone and terminology match.
- **proposal** — when the RFP/scope changed, re-scope the affected items via `scope-definer`,
  re-size them via `effort-estimator`, re-price via `pricing-generator`, then re-assemble only
  the affected sections via `proposal-drafter`; untouched scope items, estimates, and prices
  are preserved.

## Step 4 — Reconcile structure
If headings changed, invoke `doc-outline-generator` to update the table of contents and fix
cross-references that point at renamed/moved sections. Otherwise leave structure intact.

## Step 5 — Gate
Re-run the domain gate: **docwriting** → `doc-style-checker` on the revised sections (with the
full document for terminology context). **proposal** → `proposal-validator` (RFP coverage,
scope↔estimate↔pricing consistency, arithmetic) plus `doc-style-checker` on the prose. Report
the verdict; a `fail` blocks completion.

# Rules

- Revise only the stale sections — never regenerate sections the change did not touch.
- Preserve reviewed wording and terminology of untouched sections verbatim.
- Match the document's existing tone, terminology, and heading style, not the generator's
  defaults; pass surrounding sections as context.
- If a heading changes, update the TOC and every inbound cross-reference in the same pass.
- Sections that should be removed are **not** deleted here — route them to `doc-remover`.
- For proposals, preserve untouched scope items, estimates, and prices; re-scope/estimate/price
  only the items the change affects.
- Every run ends with the domain gate (`doc-style-checker`; proposals also `proposal-validator`);
  complete only on `pass`.

# Examples

Input:

```yaml
doc_modify_contract:
  doc_type: user-guide
  target: "Requesting a Refund"
  new_source: "v1.5: refund window 14 → 30 days; adds partial refunds."
  existing_document: <12-section payment guide>
  style_guide: default
```

Output (abridged):

```
▶ locate   → 1 stale section ("Requesting a Refund"); 11 preserved
▶ regen    → doc-draft-generator revises the section (30-day window, partial refunds)
▶ structure→ no heading change; TOC intact
▶ style    → doc-style-checker: pass (terminology consistent, 0 open TODO)
── doc_modify_result
  revised: ["Requesting a Refund"]
  preserved: 11
  references_updated: []
  gate: pass
  notes: "Partial-refund subsection added under the same heading; no TOC change."
```
