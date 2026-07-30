---
name: story-studio
description: Short entry point for the story-studio category. Coordinate the end-to-end creative-writing pipeline that turns a premise into drafted fiction — developed premise, characters, plot outline, chapter drafts, style pass, and a continuity check. Use for fiction/creative writing, not technical documents. Entrypoint of the story-studio domain. Invoke as '/story-studio'; delegates to story-studio-orchestrator.
version: 1.0.0
category: story-studio
tags:
  - story-studio
  - entrypoint
model: inherit
invokes:
  - story-studio-orchestrator
---

# Goal

This is the **short entry point for the `story-studio` category**. Start here, but let
`story-studio-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `story-studio-orchestrator` needs.
2. Run `story-studio-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
