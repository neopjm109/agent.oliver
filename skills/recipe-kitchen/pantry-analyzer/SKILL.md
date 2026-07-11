---
name: pantry-analyzer
description: Normalize available ingredients, dietary constraints/allergies, servings, and the meal grid into a structured cooking spec. First stage of the recipe-kitchen pipeline.
version: 1.0.0
category: recipe-kitchen
tags:
  - recipe-kitchen
  - pantry
  - spec
model: inherit
invokes: []
inputs:
  - kitchen_request
outputs:
  - kitchen_spec
---

# Goal

Turn a loose cooking request into a precise spec downstream skills can execute: categorized
pantry stock, hard dietary constraints, servings, and the meal grid. This skill specifies
only; it does not create recipes.

# Inputs

```yaml
kitchen_request: { pantry: [...], diet: [...], servings, meals: { days, per_day } }
```

# Output

```yaml
kitchen_spec:
  pantry: [ { item, category: protein|veg|grain|dairy|pantry-staple, approx_qty } ]
  constraints: { diet: [...], allergies: [...], exclude: [...] }
  servings: <n>
  grid: [ { day, meal } ]
```

# Workflow

## Step 1 — Categorize pantry
Sort each ingredient by food category and note approximate quantity.

## Step 2 — Capture hard constraints
Separate diet goals, allergies, and hard exclusions.

## Step 3 — Expand the grid
Enumerate each day×meal slot to fill.

## Step 4 — Return
Return `kitchen_spec`. Stop.

# Rules

- Specify only; never create recipes or plans.
- Treat allergies/exclusions as hard limits downstream must honor.
- Do not invent pantry items the user did not list.
- Keep categories consistent so the shopping list can consolidate later.

# Examples

Input:

```yaml
kitchen_request: { pantry: [닭가슴살, 양파, 밥], diet: [고단백], servings: 2, meals: { days: 1, per_day: [저녁] } }
```

Output:

```yaml
kitchen_spec:
  pantry:
    - { item: 닭가슴살, category: protein, approx_qty: "2쪽" }
    - { item: 양파, category: veg, approx_qty: "1개" }
    - { item: 밥, category: grain, approx_qty: "2공기" }
  constraints: { diet: [고단백], allergies: [], exclude: [] }
  servings: 2
  grid: [ { day: 1, meal: 저녁 } ]
```
