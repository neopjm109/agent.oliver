---
name: desktop
description: Short entry point for the desktop category. Entry point for the desktop domain — turns an application blueprint into a Tauri desktop app by wrapping the existing React/Next.js frontend with a native shell; delegates to every desktop sub-skill and never generates code itself. Invoke as '/desktop'; delegates to desktop-orchestrator.
version: 1.0.0
category: desktop
tags:
  - desktop
  - entrypoint
model: inherit
invokes:
  - desktop-orchestrator
---

# Goal

This is the **short entry point for the `desktop` category**. Start here, but let
`desktop-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `desktop-orchestrator` needs.
2. Run `desktop-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
