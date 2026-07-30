---
name: fitness-profiler
description: Normalize a trainee's goal, experience level, available equipment, weekly availability, and injury constraints into a structured training spec. First stage of the fitness-coach pipeline.
version: 1.0.0
category: fitness-coach
tags:
  - fitness-coach
  - profile
  - spec
model: inherit
invokes: []
inputs:
  - fitness_request
outputs:
  - fitness_spec
---

# Goal

Turn a fitness request into a precise spec: goal, level, equipment, availability, and hard
constraints. This skill specifies only; it does not design programs or sessions.

# Inputs

```yaml
fitness_request: { goal, level, equipment: [...], days_per_week, session_length, constraints: [...] }
```

# Output

```yaml
fitness_spec:
  goal: <normalized goal>
  level: 초급 | 중급 | 상급
  equipment: [...]
  availability: { days_per_week, session_length }
  constraints: [<injury/limit as a hard rule>]
  focus_hint: <e.g. hypertrophy rep ranges>
```

# Workflow

## Step 1 — Normalize goal & level
Map the goal to training focus (e.g. 근비대 → 8–12 reps) and confirm the level.

## Step 2 — Capture equipment & availability
Record usable equipment and weekly time budget.

## Step 3 — Flag constraints
Turn injuries/limits into hard rules downstream must respect.

## Step 4 — Return
Return `fitness_spec`. Stop.

# Rules

- Specify only; never prescribe exercises or programs.
- Treat injuries/limits as hard constraints for all downstream stages.
- Do not invent equipment the trainee lacks.
- Keep goal→focus mapping consistent with standard training principles.

# Examples

Input:

```yaml
fitness_request: { goal: 근비대, level: 초급, equipment: [덤벨, 맨몸], days_per_week: 3, session_length: "45분", constraints: [허리 주의] }
```

Output:

```yaml
fitness_spec:
  goal: 근비대
  level: 초급
  equipment: [덤벨, 맨몸]
  availability: { days_per_week: 3, session_length: "45분" }
  constraints: [허리 주의 — 척추 부하 큰 종목 회피]
  focus_hint: "8–12회 반복, 중간 강도"
```
