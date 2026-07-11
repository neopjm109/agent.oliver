---
name: doc-draft-generator
description: Write finished prose for the sections of a user guide, manual, or reference document from an outline and its source material. General-purpose narrative drafting stage of the docwriting pipeline.
version: 1.0.0
category: docwriting
tags:
  - docwriting
  - draft
  - prose
  - user-guide
model: inherit
invokes: []
inputs:
  - outline
  - source_material
  - options
outputs:
  - drafted_sections
---

# Goal

Turn an outline into finished, source-grounded prose for guides, manuals, and reference
documents. Handles general narrative content; type-specific content (API guides, release
notes, ADRs) is owned by their dedicated generators.

# Inputs

```yaml
outline: { title: ..., sections: [...] }   # from doc-outline-generator
source_material:
  facts: [<extracted fact or code element>, ...]
options:
  audience: end-user      # optional
  tone: neutral           # optional
  output_format: markdown # optional
```

# Output

```yaml
drafted_sections:
  - id: <slug>
    heading: <section title>
    body: <finished prose>
    todos: [<unresolved gap>, ...]  # e.g. "source needed"
```

# Workflow

## Step 1 — Draft each section
For every outline section, write prose that fulfills its `intent` using only the attached
`source_refs` / `source_material`.

## Step 2 — Mark gaps
Where a section has no supporting source, write a placeholder and record
`TODO: source needed` in `todos` — do not fabricate.

## Step 3 — Apply audience & tone
Adjust reading level and voice to `options.audience`; keep tone neutral and instructional.

## Step 4 — Return
Return `drafted_sections`. Stop. Style/terminology consistency is checked later by
`doc-style-checker`.

# Rules

- Use only provided source material; never introduce outside facts or invent behavior.
- Do not restructure the outline; write within the given sections.
- Prefer imperative, step-based phrasing for tasks; concise declarative for reference.
- Do not perform final style checking or translation — those are separate stages.
- For API endpoints, release notes, or decision records, defer to the dedicated generator
  instead of drafting here.

# Examples

Input:

```yaml
outline:
  title: "Payment Module User Guide"
  sections:
    - { id: register-card, heading: "Registering a Card", intent: "Step-by-step card registration", source_refs: ["User can register a card."] }
options: { audience: end-user, output_format: markdown }
```

Output:

```yaml
drafted_sections:
  - id: register-card
    heading: "Registering a Card"
    body: >
      To register a card, open **Settings → Payment Methods** and select **Add Card**.
      Enter your card number, expiry date, and CVC, then choose **Save**. The card
      becomes available for payments immediately after it is verified.
    todos: []
```
