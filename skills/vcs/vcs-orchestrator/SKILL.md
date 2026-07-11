---
name: vcs-orchestrator
description: Orchestrate the branch-safe version-control layer for the generated app — repository setup, commit application, work-branch integration (merge/cherry-pick), and release artifacts — never touching a protected branch directly. Optional operational stage after review.
version: 1.0.0
category: vcs
tags:
  - vcs
  - git
  - orchestrator
  - branch-safe
  - operational
model: inherit
invokes:
  - repo-state-validator
  - branch-strategy-planner
  - repo-initializer
  - branch-operator
  - commit-message-generator
  - commit-applier
  - commit-lint-validator
  - integration-planner
  - branch-integrator
  - changelog-generator
  - pr-description-generator
  - git-hooks-generator
inputs:
  - vcs_request
  - changeset
  - target_stack
outputs:
  - vcs_result
---

# Goal

Coordinate version-control operations for the generated/changed application on a real git
repository while keeping protected branches (main/develop) untouched: all work lands on a work
branch and reaches protected branches only via merge/cherry-pick (PR when a remote exists). This
skill **never runs git itself** — it sequences planners (which produce plans/artifacts) and
operators (which execute git under the branch-safe operating contract) and reports the result.

# Inputs

```yaml
vcs_request:
  intent: setup | commit | integrate | release   # what to do
  work_branch: feat/FEAT-ORDER                    # created/switched if absent; never a protected branch
  target_branch: develop                          # for integrate/release
  strategy: cherry-pick | merge                   # for integrate (else planned)
  protected: [main, develop]
changeset: { files: [...], features: [...] }      # produced by generation / code-change
target_stack: { backend: spring, clients: [web] }
```

# Output

```yaml
vcs_result:
  branch: <work branch operated on>
  commits: [<sha + message>]
  integration: <merge/cherry-pick outcome + target>
  changelog: <CHANGELOG.md path, if release>
  pr: <PR description, if requested>
  preflight: <pass/fail from repo-state-validator>
  aborted: <reason + recovery plan, if a conflict stopped the run>
```

# Workflow

## Step 1 — Preflight
Invoke `repo-state-validator`. If it fails (dirty tree not stashable, currently on a protected
branch, target diverged needing rewrite), stop with its report before any mutation.

## Step 2 — Strategy
Invoke `branch-strategy-planner` (once per repo) to resolve protected branches + work-branch
naming; every later step honors that contract.

## Step 3 — Setup (intent: setup)
Invoke `repo-initializer` → `git init`, stack `.gitignore`, initial commit on `main`, first work
branch, protection config. Optionally invoke `git-hooks-generator`.

## Step 4 — Commit (intent: commit)
Use `branch-operator` to create/switch to the work branch when needed, invoke
`commit-message-generator` (changeset → `commit_plan`), then `commit-applier` to commit the plan
onto the work branch (never a protected branch). Optionally run `commit-lint-validator` to gate
message/branch-name conformance before integration.

## Step 5 — Integrate (intent: integrate)
Invoke `integration-planner` (source→target → merge/cherry-pick plan), then `branch-integrator` to
execute it stash-safely, aborting cleanly on conflict.

## Step 6 — Release (intent: release)
Invoke `changelog-generator` and, if a remote/host is configured, `pr-description-generator`.

## Step 7 — Report
Merge outputs into `vcs_result`, including the branch returned to and any abort/recovery note.

# Rules

- Never run git directly; delegate to operators. Never target a protected branch for commits or force operations.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Always run `repo-state-validator` before any operator; abort the whole run on a failed preflight.
- Uncommitted work is stashed and restored by the operators; the run ends on the original work branch.
- No history rewrite, no force-push; conflicts abort with a recovery plan, never a half-applied state.
- Integration to a protected branch uses a PR when a remote exists — never a direct push to a protected remote branch.

# Examples

Input:

```yaml
vcs_request: { intent: integrate, work_branch: feat/FEAT-ORDER, target_branch: develop, strategy: cherry-pick }
changeset: { features: [FEAT-ORDER] }
```

Output (abridged):

```
✔ preflight   → clean (stashed 2 files)
✔ commit-plan → 3 conventional commits on feat/FEAT-ORDER
✔ integrate   → cherry-pick 3 commits → PR to develop opened (remote present; no direct push)
↩ return      → feat/FEAT-ORDER restored, stash reapplied
```
