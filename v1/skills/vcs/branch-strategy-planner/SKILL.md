---
name: branch-strategy-planner
description: Define the repository's branching model and protection contract — protected branches, work-branch naming, and integration policy (PR vs direct, merge vs cherry-pick default) — as the source of truth every other vcs skill honors. Produces a spec, not git operations.
version: 1.0.0
category: vcs
tags:
  - vcs
  - git
  - branching
  - strategy
  - branch-safe
model: inherit
invokes: []
inputs:
  - branch_requirements
outputs:
  - branch_strategy
---

# Goal

Produce the branching model and **branch-safe protection contract** for the repository: which
branches are protected, how work branches are named, and how work reaches protected branches.
This is a design artifact consumed by the other vcs skills and by `deployment/cicd-generator`
(which triggers on the resulting branches); it performs no git operations.

# Inputs

```yaml
branch_requirements:
  model: trunk-based | gitflow      # default trunk-based
  protected: [main]                 # + develop for gitflow
  integration: pr | direct          # PR when a remote/host exists, else direct merge/cherry-pick
  release: tag | branch             # how releases are cut
```

# Output

```yaml
branch_strategy:
  protected: [main]                          # never committed to / force-pushed directly
  work_branch_pattern: "feat/<feature-id>"   # also chore/, fix/, spec/
  default_integration: merge | cherry-pick
  integration_via: pr | direct
  release_scheme: tag | branch
  rules: [<the branch-safe operating contract, restated for this repo>]
```

# Workflow

## Step 1 — Choose the model
Pick trunk-based (single protected `main`) or gitflow (`main` + `develop`) from requirements.

## Step 2 — Define naming and protection
Set the work-branch pattern and mark protected branches write-forbidden for direct commits/force.

## Step 3 — Set integration policy
Decide merge vs cherry-pick default and PR-vs-direct (PR when a remote/host is configured).

# Rules

- Protected branches are never the direct target of commits or force operations — encode this explicitly.
- Every generated/changed artifact lands on a work branch matching `work_branch_pattern`.
- Output a spec only; branch creation/switching is `repo-initializer`/`commit-applier`, integration is `branch-integrator`.
- Keep the contract consistent with what `cicd-generator` expects to trigger on.

# Examples

Input:

```yaml
branch_requirements: { model: gitflow, integration: pr, release: tag }
```

Output:

```yaml
branch_strategy:
  protected: [main, develop]
  work_branch_pattern: "feat/<feature-id>"
  default_integration: cherry-pick
  integration_via: pr
  release_scheme: tag
  rules:
    - "No direct commit or force-push to main/develop."
    - "All work on feat/<id>; integrate to develop via PR (cherry-pick); release-tag from main."
```
