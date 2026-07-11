---
name: nutrition-validator
description: Validate the meal plan for nutritional balance and dietary-constraint compliance — macro spread, variety, and allergy/diet adherence — returning a pass/fail report. Final check of the recipe-kitchen pipeline.
version: 1.0.0
category: recipe-kitchen
tags:
  - recipe-kitchen
  - nutrition
  - validation
model: inherit
invokes: []
inputs:
  - meal_plan
  - recipes
  - kitchen_spec
outputs:
  - nutrition_report
---

# Goal

Check whether the planned meals are reasonably balanced and honor all dietary constraints,
returning a deterministic pass/fail verdict with fixes. This validates the plan; it estimates
nutrition qualitatively and says so — it is not a clinical calculator.

# Scope

- Constraint compliance (no allergen/excluded item appears in any planned meal)
- Macro balance (reasonable protein/carb/veg spread vs stated diet goal)
- Variety (not the same food group every meal)
- Coverage (each planned slot has a dish)

Out of scope: precise calorie/micronutrient counts (needs a nutrition database/tool).

# Checks

1. No planned recipe contains an allergen or excluded ingredient.
2. Macro spread aligns with the diet goal (e.g. 고단백 → adequate protein each day).
3. Meals vary across food groups over the plan.
4. Every grid slot is filled.

# Pass/Fail Criteria

- **pass**: constraints honored, balance/variety reasonable, all slots filled.
- **fail**: any constraint violation, clear macro imbalance vs goal, or empty slot.

# Output Schema

```yaml
nutrition_report:
  result: pass | fail
  issues:
    - { day: <n or "-">, area: constraint | balance | variety | coverage, detail: <what>, fix: <suggestion> }
  note: "정성적 추정 — 정확한 열량/미량영양소는 별도 도구 필요"
  stats: { slots: <n>, issues: <n> }
```

# Rules

- Report issues and fixes only; never rewrite recipes or the plan.
- Deterministic verdict: any constraint violation or empty slot forces `fail`.
- Always mark nutrition as a qualitative estimate; never present exact numbers as measured.
- Judge against the stated diet goal and constraints, not assumptions.

# Examples

Input:

```yaml
kitchen_spec: { constraints: { diet: [고단백], allergies: [땅콩] } }
meal_plan: { slots: [ { day: 1, meal: 저녁, recipe: 땅콩 볶음 } ] }
recipes: [ { name: 땅콩 볶음, ingredients: [ { item: 땅콩 } ] } ]
```

Output:

```yaml
nutrition_report:
  result: fail
  issues:
    - { day: 1, area: constraint, detail: "알레르기 항목 '땅콩' 포함", fix: "다른 단백질원으로 교체" }
  note: "정성적 추정 — 정확한 열량/미량영양소는 별도 도구 필요"
  stats: { slots: 1, issues: 1 }
```
