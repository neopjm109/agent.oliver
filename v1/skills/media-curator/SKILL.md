---
name: media-curator
description: Short entry point for the media-curator category. Coordinate the end-to-end watch/read curation pipeline that turns a taste profile into ranked film/TV/book recommendations with a suggested consumption order, checked against constraints. Reuses the research domain for real titles. Entrypoint of the media-curator domain. Invoke as '/media-curator'; delegates to media-curator-orchestrator.
version: 1.0.0
category: media-curator
tags:
  - media-curator
  - entrypoint
model: inherit
invokes:
  - media-curator-orchestrator
---

# Goal

This is the **short entry point for the `media-curator` category**. Start here, but let
`media-curator-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `media-curator-orchestrator` needs.
2. Run `media-curator-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
