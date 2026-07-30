---
name: fitness-coach
description: Short entry point for the fitness-coach category. Coordinate the end-to-end workout-planning pipeline that turns goals, level, and equipment into a training program — weekly split, individual sessions, and progression — validated for safety and balance. Educational fitness planning, not medical advice. Entrypoint of the fitness-coach domain. Invoke as '/fitness-coach'; delegates to fitness-coach-orchestrator.
version: 1.0.0
category: fitness-coach
tags:
  - fitness-coach
  - entrypoint
model: inherit
invokes:
  - fitness-coach-orchestrator
---

# Goal

This is the **short entry point for the `fitness-coach` category**. Start here, but let
`fitness-coach-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `fitness-coach-orchestrator` needs.
2. Run `fitness-coach-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
