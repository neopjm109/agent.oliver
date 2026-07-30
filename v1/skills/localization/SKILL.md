---
name: localization
description: Short entry point for the localization category. Coordinate the end-to-end localization pipeline that extracts translatable strings from a source, translates them into target locales with plural/format handling, and validates the resulting catalogs. Use for product string/message localization, not prose documents. Entrypoint of the localization domain. Invoke as '/localization'; delegates to localization-orchestrator.
version: 1.0.0
category: localization
tags:
  - localization
  - entrypoint
model: inherit
invokes:
  - localization-orchestrator
---

# Goal

This is the **short entry point for the `localization` category**. Start here, but let
`localization-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `localization-orchestrator` needs.
2. Run `localization-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
