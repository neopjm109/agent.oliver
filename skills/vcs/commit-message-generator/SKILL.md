---
name: commit-message-generator
description: Turn a changeset into a Conventional Commits plan — logically grouped commits with type/scope/subject/body and traceability footers — for application onto a work branch. Produces messages and grouping, not the commits themselves.
version: 1.0.0
category: vcs
tags:
  - vcs
  - git
  - conventional-commits
  - commit-message
model: inherit
invokes: []
inputs:
  - changeset
outputs:
  - commit_plan
---

# Goal

Convert a changeset (files produced by generation or by `code-change`/`spec-change`) into a
Conventional Commits **plan**: a logical grouping of the changes into commits, each with a
well-formed message. This produces the plan only; `commit-applier` executes it onto a work branch.

# Inputs

```yaml
changeset:
  features: [FEAT-ORDER]
  files:
    - { path: src/.../Order.java, feature: FEAT-ORDER, change: add }
    - { path: src/.../OrderController.java, feature: FEAT-ORDER, change: add }
    - { path: web/features/order/api.ts, feature: FEAT-ORDER, change: add }
```

# Output

```yaml
commit_plan:
  commits:
    - { type: feat, scope: order, subject: "add Order aggregate and repository",
        files: [src/.../Order.java], footers: ["Refs: FEAT-ORDER"] }
    - { type: feat, scope: order, subject: "expose POST /orders endpoint",
        files: [src/.../OrderController.java] }
```

# Workflow

## Step 1 — Group changes
Group files into cohesive commits by feature and layer (domain, api, web slice), smallest
coherent unit first.

## Step 2 — Compose messages
Write each as Conventional Commits: `type(scope): subject`, imperative mood, optional body, and a
traceability footer referencing the feature/requirement id.

## Step 3 — Order commits
Order so each commit is buildable in isolation where possible (entity before controller, etc.).

# Rules

- Conventional Commits only: `feat|fix|chore|refactor|docs|test|build|ci(scope): subject`.
- One logical change per commit; never one giant commit for the whole feature.
- Every commit carries a traceability footer to its feature/requirement id.
- Produce the plan only — never stage, commit, or touch the repository (that is `commit-applier`).
- Aggregating commits into human-facing release prose is `docwriting/release-notes-generator`, not this skill.

# Examples

Input:

```yaml
changeset: { features: [FEAT-LOGIN], files: [ { path: auth/LoginService.java, change: add }, { path: web/features/login/form.tsx, change: add } ] }
```

Output:

```yaml
commit_plan:
  commits:
    - { type: feat, scope: auth, subject: "add email/password login service", files: [auth/LoginService.java], footers: ["Refs: FEAT-LOGIN"] }
    - { type: feat, scope: auth, subject: "add login form UI", files: [web/features/login/form.tsx], footers: ["Refs: FEAT-LOGIN"] }
```
