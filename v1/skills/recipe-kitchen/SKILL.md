---
name: recipe-kitchen
description: Short entry point for the recipe-kitchen category. Coordinate the end-to-end home-cooking pipeline that turns available ingredients and dietary constraints into recipes, a meal plan, and a consolidated shopping list, checked for nutritional balance. Use for meal planning and cooking, not code. Entrypoint of the recipe-kitchen domain. Invoke as '/recipe-kitchen'; delegates to recipe-kitchen-orchestrator.
version: 1.0.0
category: recipe-kitchen
tags:
  - recipe-kitchen
  - entrypoint
model: inherit
invokes:
  - recipe-kitchen-orchestrator
---

# Goal

This is the **short entry point for the `recipe-kitchen` category**. Start here, but let
`recipe-kitchen-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `recipe-kitchen-orchestrator` needs.
2. Run `recipe-kitchen-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
