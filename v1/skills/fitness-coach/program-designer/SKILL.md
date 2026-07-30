---
name: program-designer
description: Design the weekly training split and per-day focus (muscle groups / movement patterns) matched to the goal, level, and available days. Program stage of the fitness-coach pipeline.
version: 1.0.0
category: fitness-coach
tags:
  - fitness-coach
  - program
  - split
model: inherit
invokes: []
inputs:
  - fitness_spec
outputs:
  - program
---

# Goal

Lay out the training week: how many days, what split (full-body / upper-lower / PPL), and
each day's focus, appropriate to the goal and level. This skill designs the structure; it
does not select specific exercises (that is `workout-builder`).

# Inputs

```yaml
fitness_spec: { goal, level, availability: { days_per_week }, constraints }
```

# Output

```yaml
program:
  split: full-body | upper-lower | push-pull-legs
  days: [ { day, focus, target_groups: [...] } ]
  weekly_volume_note: <sets per muscle group guidance>
  rationale: <why this split fits goal/level/days>
```

# Workflow

## Step 1 — Choose a split
Pick a split matched to `days_per_week` and level (beginners → full-body; more days → split).

## Step 2 — Assign focus
Give each training day a focus and target muscle groups; balance the week.

## Step 3 — Set volume guidance
Note target weekly sets per muscle group for the goal.

## Step 4 — Return
Return `program`. Stop.

# Rules

- Match the split to available days and level; don't over-split a beginner.
- Balance push/pull and upper/lower across the week; avoid neglected groups.
- Respect constraints when assigning focus (e.g. limit direct spinal loading).
- Do not select specific exercises or set/rep schemes (downstream).

# Examples

Input:

```yaml
fitness_spec: { goal: 근비대, level: 초급, availability: { days_per_week: 3 }, constraints: [허리 주의] }
```

Output:

```yaml
program:
  split: full-body
  days:
    - { day: 월, focus: 전신 A, target_groups: [가슴, 등, 하체] }
    - { day: 수, focus: 전신 B, target_groups: [어깨, 팔, 코어] }
    - { day: 금, focus: 전신 C, target_groups: [하체, 등, 가슴] }
  weekly_volume_note: "근육군당 주 10~14세트"
  rationale: "초급·주3에는 전신 3회가 빈도·회복 균형에 유리"
```
