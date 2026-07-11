---
name: meal-planner
description: Assign developed recipes to the day×meal grid, balancing variety, leftovers, and prep effort across the plan. Planning stage of the recipe-kitchen pipeline.
version: 1.0.0
category: recipe-kitchen
tags:
  - recipe-kitchen
  - meal-plan
  - scheduling
model: inherit
invokes: []
inputs:
  - recipes
  - kitchen_spec
  - options
outputs:
  - meal_plan
---

# Goal

Place recipes into the meal grid so the week is varied, uses leftovers sensibly, and spreads
prep effort. This skill schedules recipes; it does not create them or shop.

# Inputs

```yaml
recipes: [ { name, servings, time } ]
kitchen_spec: { grid: [ { day, meal } ], servings }
options:
  variety: high   # high | relaxed
```

# Output

```yaml
meal_plan:
  slots: [ { day, meal, recipe, note } ]
  leftovers: [ { from, to } ]
  prep_notes: [<make-ahead / batch tip>]
```

# Workflow

## Step 1 — Fill the grid
Assign a recipe to each slot, avoiding repeats per `variety`.

## Step 2 — Route leftovers
Where a recipe yields extra servings, schedule it into a later slot.

## Step 3 — Balance effort
Spread high-effort recipes so no single day is overloaded; add make-ahead notes.

## Step 4 — Return
Return `meal_plan`. Stop.

# Rules

- Fill every grid slot; never leave a meal unassigned without a note.
- Only schedule provided recipes; do not invent dishes.
- Respect servings when routing leftovers (don't over-promise portions).
- Do not build the shopping list or check nutrition (downstream).

# Examples

Input:

```yaml
recipes: [ { name: 닭가슴살 덮밥, servings: 2 }, { name: 양파 계란국, servings: 2 } ]
kitchen_spec: { grid: [ { day: 1, meal: 저녁 }, { day: 2, meal: 저녁 } ] }
options: { variety: high }
```

Output:

```yaml
meal_plan:
  slots:
    - { day: 1, meal: 저녁, recipe: 닭가슴살 덮밥, note: "" }
    - { day: 2, meal: 저녁, recipe: 양파 계란국, note: "1일차 남은 밥 활용" }
  leftovers: [ { from: "D1 밥", to: "D2 계란국" } ]
  prep_notes: ["양파는 첫날 함께 손질"]
```
