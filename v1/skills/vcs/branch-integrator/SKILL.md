---
name: branch-integrator
description: Execute an integration plan — cherry-pick or merge work-branch commits onto a target branch, stash-safe, aborting cleanly on conflict with a recovery report, never force-pushing or rewriting history, and returning to the original work branch. Operational (runs git).
version: 1.0.0
category: vcs
tags:
  - vcs
  - git
  - cherry-pick
  - merge
  - operational
model: inherit
invokes: []
inputs:
  - integration_plan
  - integrate_context
outputs:
  - integration_result
---

# Goal

Execute an `integration_plan` produced by `integration-planner`: cherry-pick a selected commit
subset, or merge a work branch, onto a target branch. **Operational** — it runs git — under the
branch-safe contract: stash-safe, conflict → clean abort + recovery report (never a half-applied
state), no force-push, no history rewrite, and always returns to the original work branch. This is
the in-pipeline analogue of the standalone `jmpark-git-cherry-picker` safety pattern.

# Inputs

```yaml
integration_plan:
  mode: cherry-pick | merge
  commits: [a1b2, c3d4]            # ordered; the selected subset for cherry-pick
  via: pr | direct
integrate_context:
  source_branch: feat/FEAT-ORDER
  target_branch: develop
  protected: [main, develop]
  remote: origin                   # or null
```

# Output

```yaml
integration_result:
  target: develop
  mode: cherry-pick
  applied: [a1b2, c3d4]
  pushed: <true if via=direct and remote present>
  pr: <opened/prepared, if via=pr>
  returned_to: feat/FEAT-ORDER
  aborted: <conflicting commit + files + recovery steps, if stopped>
```

# Workflow

## Step 1 — Preflight and stash
Confirm the target exists and no rewrite is required. Stash uncommitted work on the source branch.

## Step 2 — Switch and apply
`git switch <target>`; then per `mode`: `git cherry-pick <sha>...` for the ordered subset, or
`git merge --no-ff <source>`. Apply commits in plan order.

## Step 3 — Handle conflict
On any conflict: `git cherry-pick --abort` / `git merge --abort`, do NOT force — return a recovery
report (which commit, which files, suggested resolution) and stop.

## Step 4 — Deliver
When the target is protected **and** a remote exists, delivery MUST be `via: pr` → prepare/open a
PR (pairs with `pr-description-generator`); never push directly to a protected remote branch.
`via: direct` is only for a local-only repo (no remote) or a non-protected target → integrate
locally / push a non-protected branch, never with force.

## Step 5 — Return
Switch back to `source_branch` and reapply the stash; report the outcome.

# Rules

- Never force-push and never rewrite history (no rebase/reset on shared branches).
- On conflict, abort cleanly and report — never leave a partially integrated state.
- Stash-safe: uncommitted work is stashed before switching and restored after; always return to the source branch.
- Reach the protected target only by cherry-pick/merge — never a direct commit. When a remote exists, protected targets are delivered via PR; **direct push to a protected remote branch is forbidden** (`direct` is for local-only repos or non-protected targets).
- Runs git for cherry-pick/merge/push only; commit creation is `commit-applier`.

# Examples

Input:

```yaml
integration_plan: { mode: cherry-pick, commits: [a1b2, c3d4], via: direct }
integrate_context: { source_branch: feat/FEAT-ORDER, target_branch: develop, protected: [main, develop], remote: null }
```

Output (abridged):

```bash
git stash push -m vcs-autostash          # if source has uncommitted work
git switch develop
git cherry-pick a1b2 c3d4                 # ordered subset; on conflict → git cherry-pick --abort + report
# local-only (remote: null) → no push. With a remote, a protected target would be delivered via PR instead.
git switch feat/FEAT-ORDER && git stash pop
# → integration_result: target develop, applied [a1b2, c3d4], pushed false, returned_to feat/FEAT-ORDER
```
