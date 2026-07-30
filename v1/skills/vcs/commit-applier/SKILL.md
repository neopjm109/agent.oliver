---
name: commit-applier
description: Apply a commit plan onto a work branch — ensure the work branch (create/switch off base, stash-safe), then stage each group and commit with its Conventional Commit message. Never commits to a protected branch. Operational (runs git).
version: 1.0.0
category: vcs
tags:
  - vcs
  - git
  - commit
  - branch-safe
  - operational
model: inherit
invokes: []
inputs:
  - commit_plan
  - apply_context
outputs:
  - apply_result
---

# Goal

Execute a `commit_plan` by staging each commit group and committing it onto the **work branch**
with its generated message. **Operational** — it runs git — under the branch-safe contract: it
refuses to commit to a protected branch and preserves any unrelated uncommitted work via stash.

# Inputs

```yaml
commit_plan:                      # shape as emitted by commit-message-generator
  commits:
    - { type: feat, scope: order, subject: "add Order aggregate", files: [src/.../Order.java], footers: ["Refs: FEAT-ORDER"] }
    - { type: feat, scope: order, subject: "expose POST /orders", files: [src/.../OrderController.java] }
apply_context:
  work_branch: feat/FEAT-ORDER
  base: main                      # branch off base if work_branch is absent
  protected: [main, develop]
```

# Output

```yaml
apply_result:
  branch: feat/FEAT-ORDER
  commits: [ { sha: a1b2, subject: "feat(order): add Order aggregate" }, { sha: c3d4, subject: "feat(order): expose POST /orders" } ]
  stashed: <true if unrelated changes were stashed/restored>
```

# Workflow

## Step 1 — Ensure the work branch
If `work_branch` is protected → abort. If the current branch is not `work_branch`, stash the
working-tree changeset, switch (creating off `base` when absent), and restore the stash onto the
work branch — the changeset belongs there. If already on `work_branch`, no stash/switch is needed.

## Step 2 — Apply commits
For each plan entry: `git add` its files, then `git commit` with the composed Conventional Commit
message `type(scope): subject` plus the entry's `footers`. Keep commits in plan order.

## Step 3 — Report
Return the resulting branch (the run ends on `work_branch`) and commit shas.

# Rules

- Never commit to a branch in `protected`; abort with a report if asked to.
- Compose each message as `type(scope): subject` and append the entry's `footers` (traceability).
- Stage only the files named in each commit entry; never `git add -A` blindly across groups.
- Stash-safe: when a branch switch is needed, the changeset is stashed and restored on the work branch; the run ends on `work_branch`.
- No force, no history rewrite; on any commit failure, stop and report (leave prior commits intact).
- Runs git for staging/commit/branch only; integration to a protected branch is `branch-integrator`.

# Examples

Input:

```yaml
commit_plan: { commits: [ { type: feat, scope: auth, subject: "login service", files: [auth/LoginService.java], footers: ["Refs: FEAT-LOGIN"] } ] }
apply_context: { work_branch: feat/FEAT-LOGIN, base: develop, protected: [main, develop] }
```

Output (abridged):

```bash
# working tree holds the generated changeset
git switch -c feat/FEAT-LOGIN develop  # create off base (work branch, not protected); stash-safe if the switch is blocked
git add auth/LoginService.java && git commit -m "feat(auth): login service" -m "Refs: FEAT-LOGIN"
# → apply_result: branch feat/FEAT-LOGIN, 1 commit; run ends on the work branch
```
