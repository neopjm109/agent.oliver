---
name: fitness-coach-orchestrator
description: Coordinate the end-to-end workout-planning pipeline that turns goals, level, and equipment into a training program — weekly split, individual sessions, and progression — validated for safety and balance. Educational fitness planning, not medical advice. Entrypoint of the fitness-coach domain.
version: 1.0.0
category: fitness-coach
tags:
  - fitness-coach
  - orchestrator
  - workout
  - training
  - pipeline
  - entrypoint
model: inherit
invokes:
  - fitness-profiler
  - program-designer
  - workout-builder
  - progression-planner
  - training-safety-validator
inputs:
  - fitness_request
  - options
outputs:
  - training_plan
---

# Goal

Produce a structured training plan by orchestrating specialized fitness-coach skills. This
skill **never prescribes directly** — it profiles the trainee, designs the program, builds
sessions, plans progression, and validates safety/balance. General educational planning; not
a substitute for medical/professional advice.

# Inputs

```yaml
fitness_request:
  goal: 근비대            # 근비대 | 근력 | 지구력 | 체중감량 | 일반 건강
  level: 초급             # 초급 | 중급 | 상급
  equipment: [덤벨, 맨몸]
  days_per_week: 3
  constraints: [허리 주의]  # optional injuries/limits
options:
  language: ko
  session_length: "45분"
```

# Output

```yaml
training_plan:
  program: <weekly split & focus>
  workouts: [<session with exercises/sets/reps>]
  progression: <how to advance week over week>
  safety: <pass/fail report>
```

# Workflow

## Step 1 — Profile
Invoke `fitness-profiler` to normalize goal, level, equipment, availability, and constraints.

## Step 2 — Design the program
Invoke `program-designer` for the weekly split and per-day focus matched to the goal.

## Step 3 — Build sessions
Invoke `workout-builder` for each day's exercises, sets, reps, and rest using available
equipment.

## Step 4 — Plan progression
Invoke `progression-planner` for week-over-week overload and deload guidance.

## Step 5 — Validate safety
Invoke `training-safety-validator`; if it fails, return flagged items to the responsible
skill once, then re-check.

## Step 6 — Return
Return `training_plan`. The pipeline ends here.

# Rules

- This skill only coordinates. Delegate every stage; never design programs, build sessions,
  or plan progression directly.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Honor `constraints`/injuries as hard limits; route around contraindicated movements.
- Educational only — include a note to consult a professional for medical concerns; never
  diagnose or treat.
- Error handling: if a stage fails, return the partial plan and mark the incomplete stage.

# Examples

Input:

```yaml
fitness_request: { goal: 근비대, level: 초급, equipment: [덤벨, 맨몸], days_per_week: 3, constraints: [허리 주의] }
options: { language: ko, session_length: "45분" }
```

Output (abridged):

```
✔ profile   → 초급·근비대·주3·덤벨/맨몸·허리 주의
✔ program   → 전신 3분할 (월/수/금)
✔ workouts  → 세션별 5~6종목, 3세트
✔ progression → 2주마다 중량/반복 증가, 4주차 디로드
✔ safety    → pass (허리 부담 종목 대체 적용)

Training Plan: 초급 근비대 주3 전신 — 안전 검증 통과. (의료 우려 시 전문가 상담)
```
