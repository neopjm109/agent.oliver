---
name: changelog-generator
description: Generate a structured CHANGELOG.md (Keep a Changelog / Conventional Commits) from a commit plan or git log — grouped Added/Changed/Fixed with commit references. Mechanical running log, distinct from the editorial release notes.
version: 1.0.0
category: vcs
tags:
  - vcs
  - git
  - changelog
  - conventional-commits
model: inherit
invokes: []
inputs:
  - commit_history
outputs:
  - changelog
---

# Goal

Produce a structured `CHANGELOG.md` from Conventional Commits — grouped by change type under a
version/unreleased heading, with commit references — following the Keep a Changelog format. This
is the **mechanical running log**; the human-facing editorial release announcement is
`docwriting/release-notes-generator`, which may consume this changelog.

# Inputs

```yaml
commit_history:
  version: 1.2.0 | unreleased
  date: 2026-07-07
  commits:
    - { type: feat, scope: order, subject: "add Order aggregate", sha: a1b2 }
    - { type: fix, scope: auth, subject: "reject expired token", sha: c3d4 }
```

# Output

```yaml
changelog:
  path: CHANGELOG.md
  entry: |
    ## [1.2.0] - 2026-07-07
    ### Added
    - order: add Order aggregate (a1b2)
    ### Fixed
    - auth: reject expired token (c3d4)
```

# Workflow

## Step 1 — Map types to sections
`feat`→Added, `fix`→Fixed, `refactor`/`perf`→Changed, etc.; drop non-user-facing types (chore/ci)
unless requested.

## Step 2 — Group and reference
Group commits under their section, keep scope prefix and short sha reference.

## Step 3 — Assemble entry
Prepend the version/date entry to `CHANGELOG.md` (or an `[Unreleased]` section).

# Rules

- Keep a Changelog format; newest entry on top; never rewrite existing released entries.
- Derive strictly from the provided commits; never invent changes.
- This is the structured log — editorial prose/highlights are `release-notes-generator` (which may read this).
- Produce the file/entry only; no git tagging or committing (that is `commit-applier`/`branch-integrator`).

# Examples

Input:

```yaml
commit_history: { version: unreleased, commits: [ { type: feat, scope: order, subject: "cancel order", sha: 9f2a } ] }
```

Output:

```yaml
changelog:
  path: CHANGELOG.md
  entry: |
    ## [Unreleased]
    ### Added
    - order: cancel order (9f2a)
```
