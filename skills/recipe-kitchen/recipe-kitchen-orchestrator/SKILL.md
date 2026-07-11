---
name: recipe-kitchen-orchestrator
description: Coordinate the end-to-end home-cooking pipeline that turns available ingredients and dietary constraints into recipes, a meal plan, and a consolidated shopping list, checked for nutritional balance. Use for meal planning and cooking, not code. Entrypoint of the recipe-kitchen domain.
version: 1.0.0
category: recipe-kitchen
tags:
  - recipe-kitchen
  - orchestrator
  - cooking
  - meal-plan
  - pipeline
  - entrypoint
model: inherit
invokes:
  - pantry-analyzer
  - recipe-developer
  - meal-planner
  - shopping-list-generator
  - nutrition-validator
inputs:
  - kitchen_request
  - options
outputs:
  - meal_kit
---

# Goal

Produce a cookable meal plan by orchestrating specialized recipe-kitchen skills. This skill
**never writes recipes directly** — it profiles the pantry/constraints, sequences recipe
development, planning, and shopping, checks nutrition, and returns the kit. It produces
cooking content, not software.

# Inputs

```yaml
kitchen_request:
  pantry: [닭가슴살, 양파, 계란, 밥]
  diet: [고단백]              # optional constraints/allergies
  servings: 2
  meals: { days: 3, per_day: [점심, 저녁] }
options:
  language: ko
  skill_level: 초급
```

# Output

```yaml
meal_kit:
  recipes: [<recipe>, ...]
  meal_plan: <day×meal grid>
  shopping_list: [<item + qty>, ...]
  nutrition: <pass/fail balance report>
```

# Workflow

## Step 1 — Profile pantry & constraints
Invoke `pantry-analyzer` to normalize available ingredients, diet/allergies, servings, and
the meal grid into a spec.

## Step 2 — Develop recipes
Invoke `recipe-developer` to create recipes that use the pantry and honor constraints.

## Step 3 — Plan meals
Invoke `meal-planner` to assign recipes to the day×meal grid, balancing variety and leftovers.

## Step 4 — Shopping list
Invoke `shopping-list-generator` to consolidate needed ingredients minus pantry stock.

## Step 5 — Nutrition check
Invoke `nutrition-validator`; if it fails, return flagged meals to `meal-planner` once, then
re-check.

## Step 6 — Return
Return `meal_kit`. The pipeline ends here.

# Rules

- This skill only coordinates. Delegate every stage; never develop recipes, plan, shop, or
  check nutrition directly.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Honor all allergies/diet constraints as hard limits; never plan a meal that violates them.
- Never generate code; this domain produces cooking content.
- Error handling: if a stage fails, return the partial kit and mark the incomplete stage.

# Examples

Input:

```yaml
kitchen_request: { pantry: [닭가슴살, 양파, 계란, 밥], diet: [고단백], servings: 2, meals: { days: 2, per_day: [저녁] } }
options: { language: ko, skill_level: 초급 }
```

Output (abridged):

```
✔ pantry   → 재료 4종, 고단백 제약, 2일×저녁 2끼
✔ recipes  → 닭가슴살 덮밥, 양파 계란국
✔ plan     → D1 덮밥 / D2 국+남은 밥
✔ shopping → 대파, 간장(부족분만)
✔ nutrition→ pass (단백질 목표 충족)

Meal Kit: 2일 저녁 플랜 + 장보기 2품목.
```
