---
name: blueprint
description: Short entry point for the blueprint category. Turns unified requirements into a complete application blueprint by orchestrating architecture, domain-model, database, and API-spec design skills. Use after document analysis, before planning. Invoke as '/blueprint'; delegates to blueprint-orchestrator.
version: 1.0.0
category: blueprint
tags:
  - blueprint
  - entrypoint
model: inherit
invokes:
  - blueprint-orchestrator
---

# Goal

This is the **short entry point for the `blueprint` category**. Start here, but let
`blueprint-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `blueprint-orchestrator` needs.
2. Run `blueprint-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
