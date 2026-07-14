---
name: knowledge-base
description: Short entry point for the knowledge-base category. Coordinate the end-to-end knowledge-base pipeline that turns a document corpus into organized, reusable knowledge artifacts — a chunked/indexed knowledge base plus FAQ, onboarding path, and glossary. Use to structure internal knowledge, not to generate code. Entrypoint of the knowledge-base domain. Invoke as '/knowledge-base'; delegates to knowledge-base-orchestrator.
version: 1.0.0
category: knowledge-base
tags:
  - knowledge-base
  - entrypoint
model: inherit
invokes:
  - knowledge-base-orchestrator
---

# Goal

This is the **short entry point for the `knowledge-base` category**. Start here, but let
`knowledge-base-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `knowledge-base-orchestrator` needs.
2. Run `knowledge-base-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
