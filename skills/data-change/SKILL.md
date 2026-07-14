---
name: data-change
description: Short entry point for the data-change category. Routes a change request against an existing generated data artifact (seed dataset, translation catalog, knowledge base, analysis report, or audit report) to the right operation — modify (incremental upsert to reflect changed input) or delete (referential-integrity removal) — and delegates to data-modifier / data-remover. Use when the source changed and the artifact must be updated in place, not regenerated from scratch. Invoke as '/data-change'; delegates to data-change-orchestrator.
version: 1.0.0
category: data-change
tags:
  - data-change
  - entrypoint
model: inherit
invokes:
  - data-change-orchestrator
---

# Goal

This is the **short entry point for the `data-change` category**. Start here, but let
`data-change-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `data-change-orchestrator` needs.
2. Run `data-change-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
