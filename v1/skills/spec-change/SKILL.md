---
name: spec-change
description: Short entry point for the spec-change category. Routes a change request against an existing design spec (blueprint — architecture/domain/database/API/events; or design — tokens/system/flows) to modify (revise the spec element and ripple it into dependent code) or delete (remove the spec element and cascade-remove dependent code), and delegates to spec-modifier / spec-remover. Use when a contract changed and both the spec and the code generated from it must move together. Invoke as '/spec-change'; delegates to spec-change-orchestrator.
version: 1.0.0
category: spec-change
tags:
  - spec-change
  - entrypoint
model: inherit
invokes:
  - spec-change-orchestrator
---

# Goal

This is the **short entry point for the `spec-change` category**. Start here, but let
`spec-change-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `spec-change-orchestrator` needs.
2. Run `spec-change-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
