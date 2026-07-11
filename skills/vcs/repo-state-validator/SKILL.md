---
name: repo-state-validator
description: Preflight gate for every vcs operation — verifies the working tree is clean or stashable, the current branch is a work branch (not protected), the target is reachable, and no history rewrite is required — returning a deterministic pass/fail report. Runs before any git mutation.
version: 1.0.0
category: vcs
tags:
  - vcs
  - git
  - validation
  - preflight
  - branch-safe
model: inherit
invokes: []
inputs:
  - repo_state
  - vcs_request
outputs:
  - validation_result
---

# Goal

Verify a git repository is safe to operate on before any `vcs` operator mutates it, returning a
deterministic pass/fail verdict with specific violations. This is the branch-safe **preflight
gate**; it only inspects state and never mutates the repository.

# Scope

- Tree cleanliness (working tree clean, or dirty-but-stashable so changes can be preserved)
- Branch safety (the current/target-of-commit branch is a work branch, never a protected branch)
- Target reachability (the integration target branch exists and is checked-out-able)
- No-rewrite (target has not diverged in a way that would require rebase/force to integrate)
- Remote readiness (when a push is intended, the remote is configured and reachable)
- Delivery safety (a protected integration target with a remote is delivered via PR, never a direct push)
- Setup safety (a setup intent runs only when the directory is not already a git repository)

Out of scope: content/code correctness, commit-message quality (see `commit-message-generator`).

# Inputs

```yaml
repo_state:
  current_branch: feat/FEAT-ORDER
  dirty: true                 # uncommitted changes present
  stashable: true             # changes can be safely stashed/restored
  branches: [main, develop, feat/FEAT-ORDER]
  remote: origin              # or null
vcs_request: { intent: integrate, target_branch: develop, protected: [main, develop], via: direct | pr }
# repo_state also carries `already_repo: bool` for a setup intent
```

# Checks

1. Working tree is clean, or `dirty` with `stashable: true` (so a stash can preserve it).
2. For a commit intent, `current_branch` is not in `protected`.
3. For an integrate intent, `target_branch` exists in `branches`.
4. The target does not require a history rewrite (no `--force`/rebase needed to integrate).
5. If a push is intended, `remote` is non-null and reachable.
6. For an integrate intent whose `target_branch` is in `protected`, when a remote exists the delivery is `via: pr` — a direct push to a protected remote branch fails.
7. For a setup intent, the directory is not already a git repository (`already_repo` is false).

# Pass/Fail Criteria

- **pass**: all applicable checks succeed.
- **fail**: dirty and not stashable, a commit targeting a protected branch, a missing target
  branch, a rewrite-requiring divergence, an intended push with no reachable remote, a direct
  push to a protected remote branch (must be PR), or a setup intent on an existing repository.

# Output Schema

```yaml
validation_result:
  result: pass | fail
  violations:
    - { area: tree | branch | target | rewrite | remote | delivery | setup, ref: <name>, issue: <what failed> }
  stats: { dirty: <bool>, stashable: <bool>, on_protected: <bool> }
```

# Rules

- Report violations only; never stash, checkout, commit, or push.
- Deterministic verdict: any single violation forces `fail`.
- Treat every branch in `protected` as write-forbidden for commits/force operations.

# Examples

Input:

```yaml
repo_state: { current_branch: main, dirty: false, branches: [main, develop], remote: origin }
vcs_request: { intent: commit, protected: [main, develop] }
```

Output:

```yaml
validation_result:
  result: fail
  violations:
    - { area: branch, ref: main, issue: "commit intent targets protected branch 'main'; switch to a work branch" }
  stats: { dirty: false, stashable: true, on_protected: true }
```
