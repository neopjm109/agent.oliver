---
name: doc-change
description: Short entry point for the doc-change category. Routes a change request against an existing prose document (docwriting — user guide, API guide, release notes, ADR, reference; or a proposal) to the right operation — modify (revise the affected sections to reflect a changed source) or delete (remove a section/scope-item and fix cross-references/TOC) — and delegates to doc-modifier / doc-remover. Use when a document must be revised in place, not rewritten from scratch. Invoke as '/doc-change'; delegates to doc-change-orchestrator.
version: 1.0.0
category: doc-change
tags:
  - doc-change
  - entrypoint
model: inherit
invokes:
  - doc-change-orchestrator
---

# Goal

This is the **short entry point for the `doc-change` category**. Start here, but let
`doc-change-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `doc-change-orchestrator` needs.
2. Run `doc-change-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
