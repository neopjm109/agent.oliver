---
name: proposal
description: Short entry point for the proposal category. Coordinate the end-to-end proposal pipeline that turns an RFP (request for proposal) into a scoped, estimated, priced proposal document. Use when the goal is a pre-sales proposal, not runtime code or project execution planning. Entrypoint of the proposal domain. Invoke as '/proposal'; delegates to proposal-orchestrator.
version: 1.0.0
category: proposal
tags:
  - proposal
  - entrypoint
model: inherit
invokes:
  - proposal-orchestrator
---

# Goal

This is the **short entry point for the `proposal` category**. Start here, but let
`proposal-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `proposal-orchestrator` needs.
2. Run `proposal-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
