---
name: clause-extractor
description: Extract the target document's clauses and statements into a flat, referenceable list so each can be matched against rules. Prepares the audited document for conformance checking.
version: 1.0.0
category: audit
tags:
  - audit
  - extraction
  - clauses
model: inherit
invokes: []
inputs:
  - target_material
  - options
outputs:
  - clauses
---

# Goal

Convert the target document into a flat list of clauses/statements, each with a stable
reference so downstream conformance checks can cite exact evidence. This skill extracts
only; it does not judge compliance.

# Inputs

```yaml
target_material:
  facts: [<extracted statement from the target document>, ...]  # from docs-analyze
options:
  granularity: sentence   # sentence | paragraph | section
```

# Output

```yaml
clauses:
  - id: <stable ref, e.g. C-012>
    text: <the clause verbatim or lightly normalized>
    location: <section/page pointer if available>
    topic: <short topic tag>
```

# Workflow

## Step 1 — Segment
Split the target material at the requested `granularity`.

## Step 2 — Assign references
Give each clause a stable ID and, where available, a location pointer.

## Step 3 — Tag topics
Attach a short topic tag to aid rule matching (e.g. retention, consent, encryption).

## Step 4 — Return
Return the `clauses` list. Stop.

# Rules

- Extract faithfully; do not paraphrase in a way that changes meaning.
- Do not evaluate compliance or attach rules — that is the checker's job.
- Preserve location metadata when the source provides it.
- Do not drop clauses that seem irrelevant; the checker decides applicability.

# Examples

Input:

```yaml
target_material:
  facts:
    - "Collected data is retained for 5 years."
    - "Users may request deletion at any time."
options: { granularity: sentence }
```

Output:

```yaml
clauses:
  - { id: C-001, text: "Collected data is retained for 5 years.", location: "§4.1", topic: retention }
  - { id: C-002, text: "Users may request deletion at any time.", location: "§4.2", topic: deletion }
```
