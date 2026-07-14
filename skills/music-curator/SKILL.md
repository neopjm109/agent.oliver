---
name: music-curator
description: Short entry point for the music-curator category. Coordinate the end-to-end playlist-curation pipeline that turns a mood/occasion and taste into a sequenced playlist of real tracks with an energy arc, validated for flow and duration. Reuses the research domain for real tracks. Entrypoint of the music-curator domain. Invoke as '/music-curator'; delegates to music-curator-orchestrator.
version: 1.0.0
category: music-curator
tags:
  - music-curator
  - entrypoint
model: inherit
invokes:
  - music-curator-orchestrator
---

# Goal

This is the **short entry point for the `music-curator` category**. Start here, but let
`music-curator-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `music-curator-orchestrator` needs.
2. Run `music-curator-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
