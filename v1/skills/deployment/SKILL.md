---
name: deployment
description: Short entry point for the deployment category. Orchestrates non-container deployment artifacts — CI/CD pipelines and per-environment configuration — for the selected stack(s) (per target_stack), delegating the deploy target to user infrastructure. Invoke as '/deployment'; delegates to deployment-orchestrator.
version: 1.0.0
category: deployment
tags:
  - deployment
  - entrypoint
model: inherit
invokes:
  - deployment-orchestrator
---

# Goal

This is the **short entry point for the `deployment` category**. Start here, but let
`deployment-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `deployment-orchestrator` needs.
2. Run `deployment-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
