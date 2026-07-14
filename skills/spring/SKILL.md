---
name: spring
description: Short entry point for the spring category. Orchestrates the Spring Boot backend implementation for a feature by coordinating its specialized generators — domain, API, security, event, messaging, Redis, scheduler, batch, migration, config-properties, observability, notification, file-storage, WebSocket, API-docs, and test. Selected by backend-orchestrator when target_stack.backend is spring. Invoke as '/spring'; delegates to spring-backend-orchestrator.
version: 1.0.0
category: spring
tags:
  - spring
  - entrypoint
model: inherit
invokes:
  - spring-backend-orchestrator
---

# Goal

This is the **short entry point for the `spring` category**. Start here, but let
`spring-backend-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `spring-backend-orchestrator` needs.
2. Run `spring-backend-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
