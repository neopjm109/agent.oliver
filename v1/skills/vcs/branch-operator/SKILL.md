---
name: branch-operator
description: Create, switch, or delete work branches under the branch-safe contract — stash-safe, refusing to mutate or delete a protected branch, and never force-deleting unmerged work — for explicit branch lifecycle operations. Operational (runs git).
version: 1.0.0
category: vcs
tags:
  - vcs
  - git
  - branch
  - lifecycle
  - operational
model: inherit
invokes: []
inputs:
  - branch_op_request
outputs:
  - branch_op_result
---

# Goal

Perform work-branch lifecycle operations — create, switch, or delete — as a reusable primitive
for the vcs pipeline. **Operational** — it runs git — under the branch-safe contract: protected
branches are never renamed/deleted or checked out for mutation, switches are stash-safe, and
unmerged work is never force-deleted.

# Inputs

```yaml
branch_op_request:
  op: create | switch | delete
  branch: feat/FEAT-ORDER            # target work branch
  base: develop                      # for create (branch off base)
  protected: [main, develop]
  require_merged: true               # for delete: refuse if not merged into base/target
```

# Output

```yaml
branch_op_result:
  op: create | switch | delete
  branch: feat/FEAT-ORDER
  current_branch: <branch after the op>
  stashed: <true if a switch stashed/restored work>
  refused: <reason, if the op was blocked by the contract>
```

# Workflow

## Step 1 — Guard the contract
Reject the op if `branch` is in `protected` (no creating-over, switching-to-mutate, or deleting a
protected branch). For `delete`, also reject the branch you are currently on.

## Step 2 — Stash if needed
If the working tree is dirty and the op requires a switch, `git stash` first; restore afterward.

## Step 3 — Execute
- `create`: `git switch -c <branch> <base>` (fails if it already exists — report, do not reset).
- `switch`: `git switch <branch>` (stash-safe).
- `delete`: `git branch -d <branch>` (safe delete). If `require_merged` and it is not merged,
  refuse — never `git branch -D`/force-delete unmerged work.

# Rules

- Never create-over, checkout-to-mutate, rename, or delete a protected branch.
- Never force-delete (`-D`) an unmerged branch; use safe delete (`-d`) and refuse when unmerged.
- Stash-safe: a dirty tree is stashed before a switch and restored after.
- Single-purpose primitive: this owns branch lifecycle only — commits are `commit-applier`, integration is `branch-integrator`.

# Examples

Input:

```yaml
branch_op_request: { op: create, branch: feat/FEAT-ORDER, base: develop, protected: [main, develop] }
```

Output (abridged):

```bash
git stash push -m vcs-autostash   # only if dirty and a switch is required
git switch -c feat/FEAT-ORDER develop   # refuses if feat/FEAT-ORDER exists or target is protected
git stash pop
# → branch_op_result: op create, branch feat/FEAT-ORDER, current_branch feat/FEAT-ORDER
```
