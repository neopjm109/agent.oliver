---
name: asset
description: Short entry point for the asset category. Coordinate the end-to-end visual-asset pipeline that turns an asset brief into concrete 2D assets — SVG icons, sprite sheets, and placeholder images — plus a usage manifest. Never authors assets itself; it resolves the brief into a spec and routes each asset to the right generator (vector/procedural to icon/sprite/placeholder generators, raster/photoreal to a connected image tool or an image-prompt spec). Entrypoint of the asset domain. Invoke as '/asset'; delegates to asset-orchestrator.
version: 1.0.0
category: asset
tags:
  - asset
  - entrypoint
model: inherit
invokes:
  - asset-orchestrator
---

# Goal

This is the **short entry point for the `asset` category**. Start here, but let
`asset-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `asset-orchestrator` needs.
2. Run `asset-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
