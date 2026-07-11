---
name: workout-builder
description: Build each training day's session — exercises, sets, reps, rest, and tempo — using available equipment and routing around injury constraints. Session stage of the fitness-coach pipeline.
version: 1.0.0
category: fitness-coach
tags:
  - fitness-coach
  - workout
  - exercises
model: inherit
invokes: []
inputs:
  - program
  - fitness_spec
  - options
outputs:
  - workouts
---

# Goal

Turn each program day into a concrete session: specific exercises with sets, reps, rest, and
tempo, using only available equipment and avoiding contraindicated movements. This skill
builds sessions; it does not plan week-over-week progression.

# Inputs

```yaml
program: { days: [ { day, focus, target_groups } ] }
fitness_spec: { equipment, level, constraints, focus_hint }
options:
  session_length: "45분"
```

# Output

```yaml
workouts:
  - day: <day>
    exercises:
      - { name, target, sets, reps, rest, equipment, note }
    est_time: <minutes>
```

# Workflow

## Step 1 — Select exercises
Choose exercises hitting each day's target groups using available equipment.

## Step 2 — Prescribe sets/reps
Set sets/reps/rest per the goal's `focus_hint` and level; fit within `session_length`.

## Step 3 — Route around constraints
Substitute contraindicated movements (e.g. 허리 주의 → 데드리프트 대신 힙 힌지 변형).

## Step 4 — Return
Return `workouts`. Stop.

# Rules

- Use only available equipment; never prescribe unavailable machines.
- Never include a movement contraindicated by `constraints`; substitute and note it.
- Sets/reps/rest must match the goal and fit the session length.
- Do not plan progression across weeks (that is `progression-planner`).

# Examples

Input:

```yaml
program: { days: [ { day: 월, focus: 전신 A, target_groups: [가슴, 하체] } ] }
fitness_spec: { equipment: [덤벨, 맨몸], level: 초급, constraints: [허리 주의], focus_hint: "8–12회" }
options: { session_length: "45분" }
```

Output:

```yaml
workouts:
  - day: 월
    exercises:
      - { name: 덤벨 벤치프레스, target: 가슴, sets: 3, reps: "10", rest: "90s", equipment: 덤벨, note: "" }
      - { name: 덤벨 고블릿 스쿼트, target: 하체, sets: 3, reps: "12", rest: "90s", equipment: 덤벨, note: "허리 중립 유지(척추 부하↓ 대체 선택)" }
    est_time: "40분"
```
