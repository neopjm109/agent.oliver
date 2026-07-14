---
name: research
description: Short entry point for the research category. For questions that need an evidence-based, source-cited answer, it coordinates the search → research → validation → comparison → fact-check → summary pipeline by delegating to research-orchestrator. Invoke as '/research'.
version: 1.0.0
category: research
tags:
  - research
  - entrypoint
  - pipeline
model: inherit
invokes:
  - research-orchestrator
---

# Goal

This is the **short entry point for the `research` category**. When the user asks for an
evidence-based answer (`/research [question]`, etc.), start here but let
`research-orchestrator` coordinate the actual pipeline.

# How to run

1. Determine the scope of the question and the level of sourcing required.
2. Run `research-orchestrator` as a subagent (see the framework delegation rule) so it
   coordinates the search, research, validation, comparison, fact-check, and summary stages.
3. Return the orchestrator's source-cited answer to the user.
