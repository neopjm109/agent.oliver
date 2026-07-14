---
name: trip-planner
description: Short entry point for the trip-planner category. Coordinate the end-to-end trip-planning pipeline that turns a travel request into a day-by-day itinerary with logistics, budget, and packing list, checked for feasibility. Reuses the research domain for real destination facts. Entrypoint of the trip-planner domain. Invoke as '/trip-planner'; delegates to trip-planner-orchestrator.
version: 1.0.0
category: trip-planner
tags:
  - trip-planner
  - entrypoint
model: inherit
invokes:
  - trip-planner-orchestrator
---

# Goal

This is the **short entry point for the `trip-planner` category**. Start here, but let
`trip-planner-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `trip-planner-orchestrator` needs.
2. Run `trip-planner-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
