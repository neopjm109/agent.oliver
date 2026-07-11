---
name: doc-change-orchestrator
description: Routes a change request against an existing prose document (docwriting — user guide, API guide, release notes, ADR, reference; or a proposal) to the right operation — modify (revise the affected sections to reflect a changed source) or delete (remove a section/scope-item and fix cross-references/TOC) — and delegates to doc-modifier / doc-remover. Use when a document must be revised in place, not rewritten from scratch.
version: 1.0.0
category: doc-change
tags:
  - orchestrator
  - doc-change
  - modify
  - delete
  - documentation
model: inherit
invokes:
  - doc-modifier
  - doc-remover
inputs:
  - doc_change_request
  - doc_domain
  - doc_type
outputs:
  - doc_change_summary
---

# Goal

Turn a change request against an **existing** prose document into the correct operation and
route it. This skill **never edits documents directly**; it classifies the request, picks the
operation, passes a change contract to the worker, and reports the result. It is the
counterpart of `docwriting-orchestrator` / `proposal-orchestrator`, which author a document
from scratch; this one *revises* what is already written while preserving the sections that
are still accurate.

Prose is not refactored (there is no behavior to preserve), so only two operations exist:

- **modify** — the source (code, requirements, changeset, decision) changed; revise only the
  affected sections and keep the rest. → `doc-modifier`
- **delete** — a section should be removed, and everything referring to it (TOC, cross-links,
  "see section X") must stay consistent. → `doc-remover`

Every operation ends by re-running `doc-style-checker` so quality/consistency is a
deterministic pass/fail, not an assumption.

# Inputs

```yaml
doc_change_request:
  intent: <free-text; e.g. "the refund flow changed in v1.5 — update the guide">
  target: <section / heading affected>
  operation: modify | delete    # optional hint; classified if absent
  new_source: <the changed code/requirements/changeset/RFP, when modifying>
doc_domain: docwriting          # docwriting | proposal
doc_type: user-guide            # docwriting: user-guide | api-guide | release-notes | adr | reference; proposal: proposal
```

# Output

```yaml
doc_change_summary:
  operation: modify | delete
  worker: doc-modifier | doc-remover
  sections_touched: [...]
  references_updated: [...]   # TOC, cross-links repointed
  gate: pass | fail           # docwriting → doc-style-checker; proposal → proposal-validator + doc-style-checker
```

# Workflow

## Step 1 — Classify operation
If a section is being removed → delete. If the source changed and the document must catch up
→ modify. A "replace section A with B" is a modify (revise into B) plus a delete (drop A),
sequenced delete-last so no cross-reference points at a removed section.

## Step 2 — Resolve delegates
The worker regenerates only the changed sections via the domain's generator and gates on the
domain's checker:
- **docwriting** → `doc-draft-generator` (guides/reference) / `api-guide-generator` /
  `release-notes-generator` / `adr-generator`, structure via `doc-outline-generator`; gate =
  `doc-style-checker`.
- **proposal** → re-scope/estimate/price via `scope-definer` / `effort-estimator` /
  `pricing-generator`, re-assemble via `proposal-drafter`; gate = `proposal-validator`
  (structured consistency) plus `doc-style-checker` (prose).

> Scope: docwriting + proposal — the prose domains with a deterministic gate. Structural
> specs (blueprint/design, which ripple to code) are handled by `code-change` flows, not here.

## Step 3 — Delegate
Invoke the chosen worker with a change contract (`operation`, `doc_type`, `target`,
`new_source`). The worker touches only the affected sections and re-runs the style checker.

## Step 4 — Assemble summary
Merge the worker output into `doc_change_summary`, including the style-check verdict.

# Rules

- Never edit documents directly; always delegate to a worker.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Do not fall back to `docwriting-orchestrator` for changes — a full re-author discards
  accurate existing sections and their reviewed wording. Changes go through a worker that
  preserves unaffected sections.
- Prose is not refactored — there is no `refactor` operation here (that concept is code-only,
  see `code-change/*`).
- Every change must end with the domain gate returning `pass` (docwriting → `doc-style-checker`;
  proposal → `proposal-validator` + `doc-style-checker`); a `fail` is reported, not hidden.
- Deleting a section is destructive to readers who bookmarked it — require an explicit delete
  intent and fix every inbound cross-reference.

# Examples

Input:

```yaml
doc_change_request:
  intent: "Refund window changed from 14 to 30 days in v1.5 — update the guide."
  target: "Requesting a Refund"
  operation: modify
doc_type: user-guide
```

Output (abridged):

```
▶ classify   → modify (source changed, one section affected)
▶ route      → doc-modifier (delegate = doc-draft-generator)
✔ modifier   → revised "Requesting a Refund" (14→30 days); other 11 sections untouched
✔ style      → doc-style-checker: pass (terminology consistent, 0 open TODO)
── doc_change_summary
  operation: modify
  sections_touched: ["Requesting a Refund"]
  references_updated: []
  gate: pass
```
