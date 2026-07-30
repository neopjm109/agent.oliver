---
name: seed-data
description: Short entry point for the seed-data category. Coordinate the end-to-end seed/mock data pipeline that turns a data model (domain model, DB schema, or entity list) into realistic, referentially-consistent sample records exported as SQL/JSON/CSV fixtures. Use to populate a generated app for demos and tests. Entrypoint of the seed-data domain. Invoke as '/seed-data'; delegates to seed-data-orchestrator.
version: 1.0.0
category: seed-data
tags:
  - seed-data
  - entrypoint
model: inherit
invokes:
  - seed-data-orchestrator
---

# Goal

This is the **short entry point for the `seed-data` category**. Start here, but let
`seed-data-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `seed-data-orchestrator` needs.
2. Run `seed-data-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
