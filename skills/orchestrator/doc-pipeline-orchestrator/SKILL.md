---
name: doc-pipeline-orchestrator
description: Top-level pipeline over prose documentation — generates the requested documents (user guide, API guide, release notes, ADR, reference via docwriting; or a proposal) and, when the domain gate (doc-style-checker / proposal-validator) fails, self-heals via doc-remediation until each document passes or the budget is exhausted. The document-side analog of app-orchestrator / data-pipeline-orchestrator; the upper entry that exposes doc-remediation.
version: 1.0.0
category: orchestrator
tags:
  - orchestrator
  - documentation
  - pipeline
  - entrypoint
  - self-healing
model: inherit
invokes:
  - docwriting-orchestrator
  - proposal-orchestrator
  - doc-remediation-orchestrator
inputs:
  - doc_requests
  - options
outputs:
  - documents
  - doc_validation_report
  - remaining_fixes
---

# Goal

Generate one or more prose documents as a single pipeline and return **style-passing**
deliverables. `docwriting-orchestrator` already ends with `doc-style-checker`; this pipeline
collects those verdicts and, for any document that failed, invokes
`doc-remediation-orchestrator` to self-heal — routing each style fix to a surgical
`doc-change` revision or a full re-author, then re-checking. This skill **never writes or
edits documents directly**; it only sequences docwriting and the remediation loop. It is the
document-side counterpart of `data-pipeline-orchestrator` and the natural upper home of
`doc-remediation-orchestrator`.

# Inputs

```yaml
doc_requests:
  - { doc_type: api-guide,     sources: { code_paths: [backend/**] } }
  - { doc_type: release-notes, sources: { changeset: "v1.4..v1.5" } }
  - { doc_type: user-guide,    sources: { documents: [requirements.docx] } }   # optional
options:
  language: ko
  style_guide: default
  max_remediation_iterations: 2
```

# Output

```yaml
documents:
  api-guide: <document>          # one per requested doc_type
  release-notes: <document>
doc_validation_report:
  - { doc_type: api-guide, result: pass | fail, fixes: [...] }
remaining_fixes: [...]           # unresolved after remediation
```

# Workflow

## Step 1 — Generate requested documents
For each entry in `doc_requests`, invoke the domain's generator: `docwriting-orchestrator` for
docwriting types (with its `doc_type` and `sources`), or `proposal-orchestrator` for a proposal
(with the RFP). Each returns a document plus its gate verdict (`doc-style-checker`, and
`proposal-validator` for proposals).

## Step 2 — Remediate failures (conditional)
For every document whose verdict is `fail`, invoke `doc-remediation-orchestrator` with that
style report, the produced document, and its source — bounded by
`options.max_remediation_iterations`. Documents that already passed are left untouched.

## Step 3 — Assemble
Merge the (healed) documents into `documents`, collect the final per-document verdicts into
`doc_validation_report`, and promote anything still failing into `remaining_fixes`.

# Rules

- Never write or edit documents directly; only delegate to `docwriting-orchestrator`,
  `doc-remediation-orchestrator`, and `proposal-orchestrator`.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Documents are independent — a failure in one does not block generating the others.
- Remediate only documents that failed; never re-author a passing document.
- Remediation is bounded by `max_remediation_iterations`; unresolved fixes are promoted, not
  retried indefinitely.
- Boundary: this produces prose docs. App code is `app-orchestrator`; data is `data-pipeline-orchestrator`.

# Examples

Input:

```yaml
doc_requests:
  - { doc_type: api-guide, sources: { code_paths: [backend/payment/**] } }
  - { doc_type: release-notes, sources: { changeset: "v1.4..v1.5" } }
options: { language: ko, max_remediation_iterations: 2 }
```

Output (abridged):

```
✔ api-guide     → 8 sections; style → fail (2 terminology fixes)
✔ release-notes → 1 doc; style → pass
↻ remediate api-guide (1/2) → doc-change revises 2 sections → style → pass
── documents: { api-guide, release-notes }
   doc_validation_report: [api-guide: pass, release-notes: pass]
   remaining_fixes: []
```
