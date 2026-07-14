---
name: mobile
description: Short entry point for the mobile category. Entry point for the mobile (Flutter) domain; turns an application blueprint into a full Flutter app by delegating to flutter-* generators. Use when the target platform is a native mobile app. Invoke as '/mobile'; delegates to mobile-orchestrator.
version: 1.0.0
category: mobile
tags:
  - mobile
  - entrypoint
model: inherit
invokes:
  - mobile-orchestrator
---

# Goal

This is the **short entry point for the `mobile` category**. Start here, but let
`mobile-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `mobile-orchestrator` needs.
2. Run `mobile-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
