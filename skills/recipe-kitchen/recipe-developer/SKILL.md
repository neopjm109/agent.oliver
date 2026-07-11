---
name: recipe-developer
description: Create recipes (ingredients, quantities, steps, time) that use the available pantry and honor dietary constraints, scaled to servings. Recipe stage of the recipe-kitchen pipeline.
version: 1.0.0
category: recipe-kitchen
tags:
  - recipe-kitchen
  - recipe
  - cooking
model: inherit
invokes: []
inputs:
  - kitchen_spec
  - options
outputs:
  - recipes
---

# Goal

Develop recipes that make the most of the pantry, respect all constraints, and match the
cook's skill level and servings. This skill creates recipes; it does not plan the week or
build the shopping list.

# Inputs

```yaml
kitchen_spec: { pantry: [...], constraints: {...}, servings }
options:
  skill_level: 초급
```

# Output

```yaml
recipes:
  - name: <dish>
    servings: <n>
    ingredients: [ { item, qty, from_pantry: true|false } ]
    steps: [<step>, ...]
    time: { prep, cook }
    uses_pantry: [<pantry item>]
    honors: [<constraint satisfied>]
```

# Workflow

## Step 1 — Anchor to pantry
Build recipes around available proteins/grains/veg first; mark which ingredients must be
bought (`from_pantry: false`).

## Step 2 — Honor constraints
Ensure every recipe satisfies diet/allergy constraints; note which in `honors`.

## Step 3 — Scale & step
Scale quantities to `servings`; write steps matched to `skill_level` with prep/cook time.

## Step 4 — Return
Return `recipes`. Stop.

# Rules

- Never include an allergen or excluded item; constraints are hard limits.
- Prefer pantry ingredients; flag anything that must be purchased.
- Steps and time must suit the stated skill level.
- Do not plan meals across days or build the shopping list (downstream).

# Examples

Input:

```yaml
kitchen_spec: { pantry: [ {item: 닭가슴살, category: protein}, {item: 밥, category: grain} ], constraints: { diet: [고단백], allergies: [] }, servings: 2 }
options: { skill_level: 초급 }
```

Output:

```yaml
recipes:
  - name: 닭가슴살 덮밥
    servings: 2
    ingredients: [ { item: 닭가슴살, qty: "2쪽", from_pantry: true }, { item: 밥, qty: "2공기", from_pantry: true }, { item: 간장, qty: "1큰술", from_pantry: false } ]
    steps: ["닭가슴살을 굽는다", "간장으로 간한다", "밥 위에 올린다"]
    time: { prep: "10분", cook: "15분" }
    uses_pantry: [닭가슴살, 밥]
    honors: [고단백]
```
