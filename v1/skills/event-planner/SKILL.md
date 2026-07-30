---
name: event-planner
description: Short entry point for the event-planner category. Coordinate the end-to-end event-planning pipeline that turns an occasion, guest count, and budget into a themed plan — menu, activities, run-of-show, and checklist — validated for feasibility. Use for parties/gatherings, not code. Entrypoint of the event-planner domain. Invoke as '/event-planner'; delegates to event-planner-orchestrator.
version: 1.0.0
category: event-planner
tags:
  - event-planner
  - entrypoint
model: inherit
invokes:
  - event-planner-orchestrator
---

# Goal

This is the **short entry point for the `event-planner` category**. Start here, but let
`event-planner-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `event-planner-orchestrator` needs.
2. Run `event-planner-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
