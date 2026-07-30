---
name: vcs
description: Short entry point for the vcs category. Orchestrate the branch-safe version-control layer for the generated app — repository setup, commit application, work-branch integration (merge/cherry-pick), and release artifacts — never touching a protected branch directly. Optional operational stage after review. Invoke as '/vcs'; delegates to vcs-orchestrator.
version: 1.0.0
category: vcs
tags:
  - vcs
  - entrypoint
model: inherit
invokes:
  - vcs-orchestrator
---

# Goal

This is the **short entry point for the `vcs` category**. Start here, but let
`vcs-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `vcs-orchestrator` needs.
2. Run `vcs-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
