---
name: shopping-list-generator
description: Consolidate all recipe ingredients across the meal plan, subtract pantry stock, and produce a categorized shopping list with quantities. Shopping stage of the recipe-kitchen pipeline.
version: 1.0.0
category: recipe-kitchen
tags:
  - recipe-kitchen
  - shopping-list
  - groceries
model: inherit
invokes: []
inputs:
  - recipes
  - meal_plan
  - kitchen_spec
outputs:
  - shopping_list
---

# Goal

Turn the plan's recipes into a single shopping list: sum ingredient quantities, subtract what
the pantry already has, and group by store section. This skill consolidates; it does not
create recipes or plan meals.

# Inputs

```yaml
recipes: [ { name, ingredients: [ { item, qty, from_pantry } ] } ]
meal_plan: { slots: [...] }
kitchen_spec: { pantry: [ { item, approx_qty } ] }
```

# Output

```yaml
shopping_list:
  items: [ { item, total_qty, category, for_recipes: [...] } ]
  already_have: [<pantry item skipped>]
```

# Workflow

## Step 1 — Aggregate
Sum quantities for each ingredient across all planned recipes.

## Step 2 — Subtract pantry
Remove or reduce items already in the pantry; list them in `already_have`.

## Step 3 — Categorize
Group remaining items by store section (produce, protein, dairy, pantry).

## Step 4 — Return
Return `shopping_list`. Stop.

# Rules

- Consolidate only from planned recipes; do not add items no recipe needs.
- Subtract pantry stock accurately; don't buy what's on hand.
- Merge duplicate ingredients into one line with summed quantity.
- Keep categories consistent for easy shopping.

# Examples

Input:

```yaml
recipes: [ { name: 닭가슴살 덮밥, ingredients: [ { item: 간장, qty: "1큰술", from_pantry: false }, { item: 밥, qty: "2공기", from_pantry: true } ] } ]
kitchen_spec: { pantry: [ { item: 밥, approx_qty: "2공기" } ] }
```

Output:

```yaml
shopping_list:
  items:
    - { item: 간장, total_qty: "1병", category: pantry, for_recipes: [닭가슴살 덮밥] }
  already_have: [밥]
```
