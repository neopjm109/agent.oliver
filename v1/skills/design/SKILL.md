---
name: design
description: Short entry point for the design category. Orchestrates the design-time UI foundation — design tokens, design system, UX flows, wireframes, and Figma-to-component specs — feeding the frontend generators. Invoke as '/design'; delegates to design-orchestrator.
version: 1.0.0
category: design
tags:
  - design
  - entrypoint
model: inherit
invokes:
  - design-orchestrator
---

# Goal

This is the **short entry point for the `design` category**. Start here, but let
`design-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `design-orchestrator` needs.
2. Run `design-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
