---
name: nestjs
description: Short entry point for the nestjs category. Orchestrates the NestJS backend implementation for a feature by coordinating module/domain, API, auth, event, messaging, cache, scheduler, queue, migration, config, observability, notification, file-storage, websocket, api-docs, and test generators. Selected by backend-orchestrator when target_stack.backend is nestjs. Invoke as '/nestjs'; delegates to nestjs-backend-orchestrator.
version: 1.0.0
category: nestjs
tags:
  - nestjs
  - entrypoint
model: inherit
invokes:
  - nestjs-backend-orchestrator
---

# Goal

This is the **short entry point for the `nestjs` category**. Start here, but let
`nestjs-backend-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `nestjs-backend-orchestrator` needs.
2. Run `nestjs-backend-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
