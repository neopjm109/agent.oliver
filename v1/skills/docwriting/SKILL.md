---
name: docwriting
description: Short entry point for the docwriting category. Coordinate the end-to-end document-writing pipeline that turns source material (code, requirements, changesets, decisions) into human-readable deliverables such as guides, manuals, release notes, and ADRs. Use when the goal is prose documentation, not runtime code. Entrypoint of the docwriting domain. Invoke as '/docwriting'; delegates to docwriting-orchestrator.
version: 1.0.0
category: docwriting
tags:
  - docwriting
  - entrypoint
model: inherit
invokes:
  - docwriting-orchestrator
---

# Goal

This is the **short entry point for the `docwriting` category**. Start here, but let
`docwriting-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `docwriting-orchestrator` needs.
2. Run `docwriting-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
