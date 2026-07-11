---
name: docwriting-orchestrator
description: Coordinate the end-to-end document-writing pipeline that turns source material (code, requirements, changesets, decisions) into human-readable deliverables such as guides, manuals, release notes, and ADRs. Use when the goal is prose documentation, not runtime code. Entrypoint of the docwriting domain.
version: 1.0.0
category: docwriting
tags:
  - docwriting
  - orchestrator
  - documentation
  - pipeline
  - entrypoint
model: inherit
invokes:
  - docs-analyze-docx
  - docs-analyze-pptx
  - docs-analyze-xlsx
  - docs-analyze-markdown
  - docs-analyze-pdf
  - doc-outline-generator
  - doc-draft-generator
  - api-guide-generator
  - release-notes-generator
  - adr-generator
  - doc-style-checker
  - doc-translator
inputs:
  - doc_request
  - sources
  - options
outputs:
  - document
---

# Goal

Produce a finished, human-readable document by orchestrating specialized docwriting
skills. This skill **never writes document content directly** — it selects the document
type, sequences the pipeline, delegates each stage, and returns the assembled result.
It produces prose deliverables (guides, manuals, release notes, ADRs), never runtime code.

# Inputs

```yaml
doc_request:
  doc_type: user-guide     # user-guide | api-guide | release-notes | adr | reference
  audience: end-user       # end-user | developer | operator | stakeholder
  title: "Payment Module User Guide"
sources:                   # optional; any mix
  code_paths: [backend/payment/**]
  documents: [requirements.docx]
  changeset: "v1.3.0..v1.4.0"
  decisions: [{ topic: "Adopt event-driven ledger", ... }]
options:
  language: ko             # optional target language
  output_format: markdown  # optional
  style_guide: default     # optional terminology/tone profile
```

# Output

```yaml
document:
  doc_type: <resolved type>
  title: <title>
  content: <assembled document>
  sections: [<section title>, ...]
  style_report: <pass/fail + notes from doc-style-checker>
  language: <language of returned content>
```

# Workflow

## Step 1 — Analyze the request
Determine `doc_type`, audience, and which sources are available. This drives which
generators run.

## Step 2 — Ingest sources (if any documents provided)
For each document in `sources.documents`, invoke the matching `docs-analyze-*` skill by
extension. Merge extracted material. Code/changeset/decision sources are passed downstream
as-is (no docs-analyze needed).

## Step 3 — Build the outline
Invoke `doc-outline-generator` to produce a section structure appropriate to the
`doc_type` and audience.

## Step 4 — Generate body content
Route by `doc_type` (one primary generator; others may supplement):
- `user-guide` / `reference` → `doc-draft-generator`
- `api-guide` → `api-guide-generator`
- `release-notes` → `release-notes-generator`
- `adr` → `adr-generator`

## Step 5 — Style & consistency check
Normalize the chosen generator's output into `drafted_sections` (`{ id, heading, body, todos }`)
— mapping `api_guide_sections`, `release_notes`, or `adr` onto that shape — then invoke
`doc-style-checker` against it. If it fails, return the draft back to the responsible generator
once with the checker's notes, then re-check.

## Step 6 — Translate (optional)
If `options.language` differs from the drafted language, invoke `doc-translator`.

## Step 7 — Assemble & return
Combine outline + sections + style report into `document`. The pipeline ends here.

# Rules

- This skill only coordinates. Delegate every stage; never outline, draft, check, or
  translate directly.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Never generate runtime code. For code artifacts use the app-generation pipeline.
- Boundary: `api-guide-generator` writes human-readable API usage prose from existing
  code/spec — use it instead of `api-docs-generator` (backend springdoc annotations) or
  `api-spec-generator` (blueprint design contract).
- Boundary: `doc-style-checker` validates prose (tone/terminology/consistency) — use it
  instead of `validator/*`, which validate code artifacts.
- Never invent facts not present in sources; if a section lacks source material, mark it
  `TODO: source needed` rather than fabricating content.
- Error handling: if a `docs-analyze-*` skill fails, continue with remaining sources and
  note the gap. If a downstream generator fails, return the partial document and report
  the incomplete stage.

# Examples

Input:

```yaml
doc_request: { doc_type: api-guide, audience: developer, title: "Payment API Guide" }
sources: { code_paths: [backend/payment/**], documents: [api-spec.xlsx] }
options: { language: ko, output_format: markdown }
```

Output (abridged):

```
✔ analyze   → api-spec.xlsx → 8 endpoints extracted
✔ outline   → 5 sections (overview, auth, endpoints, errors, examples)
✔ api-guide → 8 endpoints documented with request/response samples
✔ style     → pass (2 terminology fixes applied)
✔ translate → ko

Document: "Payment API Guide" (ko, markdown)
Sections: Overview · Authentication · Endpoints · Error Handling · Examples
```
