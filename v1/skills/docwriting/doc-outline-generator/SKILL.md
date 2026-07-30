---
name: doc-outline-generator
description: Produce a section outline (structure only, no prose) for a document given its type, audience, and available source material. Use as the first content stage of the docwriting pipeline.
version: 1.0.0
category: docwriting
tags:
  - docwriting
  - outline
  - structure
model: inherit
invokes: []
inputs:
  - doc_request
  - source_material
outputs:
  - outline
---

# Goal

Generate an ordered section structure for a document. This skill produces **structure
only** — section titles, ordering, and a one-line intent per section — never finished
prose. Drafting is delegated to `doc-draft-generator` and the type-specific generators.

# Inputs

```yaml
doc_request:
  doc_type: user-guide
  audience: end-user
  title: "Payment Module User Guide"
source_material:
  facts: [<extracted fact or code element>, ...]  # from docs-analyze / code sources
```

# Output

```yaml
outline:
  title: <title>
  sections:
    - id: <slug>
      heading: <section title>
      intent: <one line: what this section must cover>
      source_refs: [<pointer into source_material>, ...]  # or [] if none
```

# Workflow

## Step 1 — Select a template shape
Choose a conventional structure for the `doc_type` (e.g. guide → overview → prerequisites
→ tasks → troubleshooting; api-guide → overview → auth → endpoints → errors → examples).

## Step 2 — Map sources to sections
Attach available source material to the sections it supports via `source_refs`.

## Step 3 — Flag gaps
Sections with no supporting source get an empty `source_refs` so downstream drafting can
mark them `TODO: source needed`.

## Step 4 — Return
Return the ordered outline. Stop.

# Rules

- Produce structure only; never write section prose.
- Order sections for the stated audience (task-first for end-users, reference-first for
  developers).
- Do not invent sources; `source_refs` must point to provided `source_material` only.
- Keep headings concise and parallel in phrasing.

# Examples

Input:

```yaml
doc_request: { doc_type: user-guide, audience: end-user, title: "Payment Module User Guide" }
source_material:
  facts:
    - "User can register a card."
    - "User can view payment history."
```

Output:

```yaml
outline:
  title: "Payment Module User Guide"
  sections:
    - { id: overview, heading: "Overview", intent: "What the payment module does", source_refs: [] }
    - { id: register-card, heading: "Registering a Card", intent: "Step-by-step card registration", source_refs: ["User can register a card."] }
    - { id: history, heading: "Viewing Payment History", intent: "How to review past payments", source_refs: ["User can view payment history."] }
    - { id: troubleshooting, heading: "Troubleshooting", intent: "Common issues and fixes", source_refs: [] }
```
