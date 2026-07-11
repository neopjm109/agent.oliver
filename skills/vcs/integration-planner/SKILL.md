---
name: integration-planner
description: Plan how a work branch reaches a target branch — choose merge vs cherry-pick, select and order the commits, flag conflict risk, and decide PR vs direct — without running any git. Feeds branch-integrator.
version: 1.0.0
category: vcs
tags:
  - vcs
  - git
  - cherry-pick
  - merge
  - integration
model: inherit
invokes: []
inputs:
  - integration_request
outputs:
  - integration_plan
---

# Goal

Decide **how** commits from a work branch should land on a target branch: full merge or a
selective cherry-pick of specific commits, in what order, with conflict-risk notes and a PR-vs-direct
decision. Produces a plan only; `branch-integrator` executes it under the branch-safe contract.

# Inputs

```yaml
integration_request:
  source_branch: feat/FEAT-ORDER
  target_branch: develop
  commits: [ { sha: a1b2, subject: "feat(order): add aggregate" }, { sha: c3d4, subject: "feat(order): endpoint" } ]
  select: all | [a1b2, c3d4]        # which commits to take (cherry-pick subset)
  strategy: auto | merge | cherry-pick
  integration_via: pr | direct
```

# Output

```yaml
integration_plan:
  mode: merge | cherry-pick
  commits: [a1b2, c3d4]             # ordered; for cherry-pick, exactly the selected subset
  order_rationale: <why this order>
  conflict_risk: [ { path: <file>, reason: <overlap/likely divergence> } ]
  via: pr | direct
  post: <tag/no-op>
```

# Workflow

## Step 1 — Choose mode
Full history forward → `merge`; a selective subset of commits → `cherry-pick`. Resolve `auto` from
whether `select` is a subset (cherry-pick) or all (merge).

## Step 2 — Order and assess
Order commits to minimize breakage; flag files likely to conflict (shared/edited on target).

## Step 3 — Decide delivery
PR when a remote/host is configured; otherwise a direct (fast-forward-preferred) integration.

# Rules

- Target is a protected branch reached only via merge/cherry-pick — never a rebase/force onto it.
- For cherry-pick, the plan lists exactly the selected commits in a safe order.
- Surface conflict risk; the plan must let `branch-integrator` abort cleanly rather than force.
- Plan only — never checkout, cherry-pick, merge, or push.

# Examples

Input:

```yaml
integration_request: { source_branch: feat/FEAT-ORDER, target_branch: develop, commits: [ { sha: a1b2 }, { sha: c3d4 }, { sha: e5f6 } ], select: [a1b2, c3d4], integration_via: pr }
```

Output:

```yaml
integration_plan:
  mode: cherry-pick
  commits: [a1b2, c3d4]
  order_rationale: "entity (a1b2) before endpoint (c3d4); e5f6 excluded (WIP)"
  conflict_risk: []
  via: pr
  post: no-op
```
