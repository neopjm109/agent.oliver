---
name: game-master
description: Short entry point for the game-master category. Coordinate the end-to-end tabletop RPG prep pipeline that turns a campaign premise into a runnable session — world, NPCs, quests, encounters, and a session outline — with a lore/balance consistency check. Use for TTRPG game-mastering prep. Entrypoint of the game-master domain. Invoke as '/game-master'; delegates to game-master-orchestrator.
version: 1.0.0
category: game-master
tags:
  - game-master
  - entrypoint
model: inherit
invokes:
  - game-master-orchestrator
---

# Goal

This is the **short entry point for the `game-master` category**. Start here, but let
`game-master-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `game-master-orchestrator` needs.
2. Run `game-master-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
