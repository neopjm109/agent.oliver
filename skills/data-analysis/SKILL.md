---
name: data-analysis
description: Short entry point for the data-analysis category. Coordinate the end-to-end data-analysis pipeline that turns a dataset into a profiled, cleaned, analyzed result with chart specs and a written insight report. Use for exploratory/analytical reporting on tabular data, not code generation. Entrypoint of the data-analysis domain. Invoke as '/data-analysis'; delegates to data-analysis-orchestrator.
version: 1.0.0
category: data-analysis
tags:
  - data-analysis
  - entrypoint
model: inherit
invokes:
  - data-analysis-orchestrator
---

# Goal

This is the **short entry point for the `data-analysis` category**. Start here, but let
`data-analysis-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `data-analysis-orchestrator` needs.
2. Run `data-analysis-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
