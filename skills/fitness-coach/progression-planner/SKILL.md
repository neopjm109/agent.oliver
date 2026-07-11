---
name: progression-planner
description: Plan week-over-week progression and deloads — how to add load, reps, or sets over a training block — matched to level and recovery. Progression stage of the fitness-coach pipeline.
version: 1.0.0
category: fitness-coach
tags:
  - fitness-coach
  - progression
  - periodization
model: inherit
invokes: []
inputs:
  - workouts
  - fitness_spec
  - options
outputs:
  - progression
---

# Goal

Define how the trainee advances over a training block: progressive overload rules and when to
deload, matched to level and recovery capacity. This skill plans progression; it does not
build the sessions themselves.

# Inputs

```yaml
workouts: [ { day, exercises } ]
fitness_spec: { level, goal }
options:
  block_weeks: 4
```

# Output

```yaml
progression:
  rule: <how to advance (load/reps/sets) each week>
  weekly: [ { week, adjustment } ]
  deload: <when and how to deload>
  autoregulation: <how to adjust if fatigued/underrecovered>
```

# Workflow

## Step 1 — Pick a progression model
Choose a model for the level (beginner → linear load/rep increases).

## Step 2 — Lay out the block
Specify each week's adjustment over `block_weeks`, including a deload.

## Step 3 — Add autoregulation
Give simple rules to scale back on bad-recovery days.

## Step 4 — Return
Return `progression`. Stop.

# Rules

- Match the progression rate to level (beginners progress faster, then slow).
- Always include a deload/recovery guidance within the block.
- Keep autoregulation simple and safety-oriented.
- Do not redesign sessions or the split (upstream stages own those).

# Examples

Input:

```yaml
workouts: [ { day: 월 } ]
fitness_spec: { level: 초급, goal: 근비대 }
options: { block_weeks: 4 }
```

Output:

```yaml
progression:
  rule: "반복이 목표 상단(12회) 도달 시 다음 세션 중량 소폭 증가"
  weekly:
    - { week: 1, adjustment: "기준 중량 설정" }
    - { week: 2, adjustment: "가능 종목 중량 +2.5kg 또는 +1~2회" }
    - { week: 3, adjustment: "볼륨 유지, 폼 강화" }
    - { week: 4, adjustment: "디로드: 세트/강도 40% 감량" }
  deload: "4주차 디로드 후 새 블록 시작"
  autoregulation: "수면/피로 나쁜 날 세트 1개 감량 또는 중량 유지"
```
