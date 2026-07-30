---
name: code-change
description: Short entry point for the code-change category. Routes a change request against an existing codebase to the right operation — modify (behavior change), refactor (behavior-preserving cleanup), or delete (removal + reference cleanup) — and delegates to code-modifier / code-refactorer / code-remover. Use when editing code that already exists, not when generating new code from scratch. Invoke as '/code-change'; delegates to code-change-orchestrator.
version: 1.0.0
category: code-change
tags:
  - code-change
  - entrypoint
model: inherit
invokes:
  - code-change-orchestrator
---

# Goal

This is the **short entry point for the `code-change` category**. Start here, but let
`code-change-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `code-change-orchestrator` needs.
2. Run `code-change-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
