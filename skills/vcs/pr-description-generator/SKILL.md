---
name: pr-description-generator
description: Generate a pull-request title, body, checklist, and suggested reviewers/labels from a work branch's commits and diff summary — VCS metadata for review, distinct from product documentation.
version: 1.0.0
category: vcs
tags:
  - vcs
  - git
  - pull-request
  - review
model: inherit
invokes: []
inputs:
  - pr_request
outputs:
  - pr_description
---

# Goal

Produce a review-ready pull-request description (title, summary, change list, test notes,
checklist, suggested reviewers/labels) from the work branch's commits and a diff summary. This is
VCS review metadata; product prose docs are `docwriting/*` and the mechanical log is
`changelog-generator`.

# Inputs

```yaml
pr_request:
  source_branch: feat/FEAT-ORDER
  target_branch: develop
  commits: [ { type: feat, scope: order, subject: "add Order aggregate" }, { type: feat, scope: order, subject: "endpoint" } ]
  diff_summary: { files_changed: 8, insertions: 240, deletions: 4 }
  feature: { id: FEAT-ORDER, requirement: "Users can place orders" }
```

# Output

```yaml
pr_description:
  title: "feat(order): place-order feature"
  body: <summary + change list + test notes + traceability to requirement>
  checklist: [tests added, docs updated, no direct commit to protected branch]
  reviewers: [<suggested from touched areas>]
  labels: [feature, backend, web]
```

# Workflow

## Step 1 — Title
Derive a Conventional-Commit-style title from the dominant change type/scope.

## Step 2 — Body
Summarize what/why, list grouped changes, add test notes, and reference the source requirement.

## Step 3 — Checklist and metadata
Add a review checklist (incl. "no direct commit to protected branch") and suggest reviewers/labels
from the touched areas.

# Rules

- Never invent changes not present in the commits/diff summary.
- Always assert the branch-safe contract in the checklist (work branch → target via PR).
- VCS review metadata only — product documentation is `docwriting/*`; the running log is `changelog-generator`.
- Produce text only; opening the PR against a host is a runtime/remote action, not this skill.

# Examples

Input:

```yaml
pr_request: { source_branch: feat/FEAT-LOGIN, target_branch: develop, commits: [ { type: feat, scope: auth, subject: "login" } ], diff_summary: { files_changed: 4 }, feature: { id: FEAT-LOGIN } }
```

Output:

```yaml
pr_description:
  title: "feat(auth): email/password login"
  body: "Adds login service + form for FEAT-LOGIN. 4 files. Unit + e2e tests included."
  checklist: [tests added, no direct commit to protected branch]
  reviewers: [auth-owner]
  labels: [feature, auth]
```
