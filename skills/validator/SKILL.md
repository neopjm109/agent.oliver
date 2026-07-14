---
name: validator
description: Short entry point for the validator category. Validates the generated application by coordinating architecture, backend, frontend, integration, security, performance, dependency/license, and test validators, plus per-client validators (mobile/desktop) selected by target_stack.clients. Read-only; runs before review and gates remediation. Invoke as '/validator'; delegates to validation-orchestrator.
version: 1.0.0
category: validator
tags:
  - validator
  - entrypoint
model: inherit
invokes:
  - validation-orchestrator
---

# Goal

This is the **short entry point for the `validator` category**. Start here, but let
`validation-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `validation-orchestrator` needs.
2. Run `validation-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
