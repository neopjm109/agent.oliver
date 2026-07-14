---
name: web
description: Short entry point for the web category. Orchestrates the Next.js frontend implementation for a feature by coordinating page, layout, component, form, table, dialog, chart, hook, state, data, API-client, auth, i18n, middleware, theme, toast, realtime-client, feature, and test generators. Invoke as '/web'; delegates to frontend-orchestrator.
version: 1.0.0
category: web
tags:
  - web
  - entrypoint
model: inherit
invokes:
  - frontend-orchestrator
---

# Goal

This is the **short entry point for the `web` category**. Start here, but let
`frontend-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `frontend-orchestrator` needs.
2. Run `frontend-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
