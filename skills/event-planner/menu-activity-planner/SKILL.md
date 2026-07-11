---
name: menu-activity-planner
description: Plan the event's food/drinks and activities/entertainment, scaled to guest count and budget and fitting the theme, honoring dietary needs. Menu/activity stage of the event-planner pipeline.
version: 1.0.0
category: event-planner
tags:
  - event-planner
  - menu
  - activities
model: inherit
invokes: []
inputs:
  - event_spec
  - theme
  - options
outputs:
  - menu_activities
---

# Goal

Decide what guests eat, drink, and do: a menu and an activity set scaled to headcount and
budget, matching the theme and honoring dietary needs. This skill plans content; it does not
build the timeline (that is `run-of-show-builder`).

# Inputs

```yaml
event_spec: { guests, budget: { per_head }, needs, occasion }
theme: { concept }
options:
  self_catered: true
```

# Output

```yaml
menu_activities:
  menu: [ { item, type: food|drink, servings, est_cost, honors_needs } ]
  activities: [ { name, when_hint, materials, guests_involved } ]
  est_total_cost: <amount>
```

# Workflow

## Step 1 — Plan the menu
Choose dishes/drinks scaled to `guests`, within per-head budget, fitting the theme; respect
dietary `needs`.

## Step 2 — Plan activities
Select activities suited to the occasion and group size; list materials.

## Step 3 — Estimate cost
Sum estimated menu + activity costs.

## Step 4 — Return
Return `menu_activities`. Stop.

# Rules

- Scale servings to guest count; never plan for the wrong headcount.
- Honor dietary needs as hard limits (at least one safe option per need).
- Keep estimated cost within budget; flag if tight (validator confirms).
- Do not build the timeline or checklist.

# Examples

Input:

```yaml
event_spec: { guests: 12, budget: { per_head: 25000 }, needs: [], occasion: 생일 파티 }
theme: { concept: "따뜻한 홈파티" }
options: { self_catered: true }
```

Output:

```yaml
menu_activities:
  menu:
    - { item: 핑거푸드 6종, type: food, servings: 12, est_cost: 120000, honors_needs: [] }
    - { item: 생일 케이크, type: food, servings: 12, est_cost: 45000, honors_needs: [] }
    - { item: 논알콜 펀치 + 맥주, type: drink, servings: 12, est_cost: 60000, honors_needs: [] }
  activities:
    - { name: "폴라로이드 포토존", when_hint: "초반", materials: [즉석카메라, 소품], guests_involved: 전체 }
    - { name: "케이크 & 축하", when_hint: "중반", materials: [초, 라이터], guests_involved: 전체 }
  est_total_cost: 225000
```
