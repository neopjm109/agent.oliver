---
name: release-notes-generator
description: Generate human-readable release notes grouped by change type (features, fixes, breaking changes, deprecations) from a changeset, commit log, or feature list. Prose deliverable for a release.
version: 1.0.0
category: docwriting
tags:
  - docwriting
  - release-notes
  - changelog
model: inherit
invokes: []
inputs:
  - changeset
  - options
outputs:
  - release_notes
---

# Goal

Produce clear, audience-appropriate release notes for a version from a provided changeset,
commit log, or feature list. Groups and phrases changes for readers; it does not compute
diffs itself.

# Inputs

```yaml
changeset:
  version: "v1.4.0"
  entries:
    - { type: feature, summary: "Add card registration", refs: ["#123"] }
    - { type: fix, summary: "Fix rounding in totals", refs: ["#130"] }
    - { type: breaking, summary: "Rename /pay to /payments" }
options:
  audience: end-user      # end-user | developer
  language: en
  output_format: markdown
```

# Output

```yaml
release_notes:
  version: <version>
  highlights: [<top user-facing change>, ...]
  sections:
    - { title: "New Features", items: [<phrased change>, ...] }
    - { title: "Fixes", items: [...] }
    - { title: "Breaking Changes", items: [...] }
    - { title: "Deprecations", items: [...] }
  upgrade_notes: [<action a reader must take>, ...]  # or []
```

# Workflow

## Step 1 — Group by type
Bucket changeset entries into features / fixes / breaking / deprecations.

## Step 2 — Rephrase for the audience
Rewrite each entry as a reader-facing statement (user benefit for end-users, technical
detail for developers). Preserve issue/PR refs where provided.

## Step 3 — Extract highlights & upgrade notes
Promote the most significant user-facing changes to `highlights`; derive `upgrade_notes`
from breaking changes and deprecations.

## Step 4 — Return
Return `release_notes`. Stop.

# Rules

- Only include changes present in the changeset; never infer unlisted changes.
- Every breaking change must produce a corresponding upgrade note.
- Keep each item to a single, concrete sentence; no marketing language.
- Do not compute the diff or read git history — operate on the provided changeset.

# Examples

Input:

```yaml
changeset:
  version: "v1.4.0"
  entries:
    - { type: feature, summary: "Add card registration", refs: ["#123"] }
    - { type: breaking, summary: "Rename /pay to /payments" }
options: { audience: developer, language: en }
```

Output:

```yaml
release_notes:
  version: "v1.4.0"
  highlights: ["You can now register payment cards."]
  sections:
    - { title: "New Features", items: ["Add card registration (#123)"] }
    - { title: "Fixes", items: [] }
    - { title: "Breaking Changes", items: ["The `/pay` endpoint is renamed to `/payments`."] }
    - { title: "Deprecations", items: [] }
  upgrade_notes: ["Update clients to call `/payments` instead of `/pay`."]
```
