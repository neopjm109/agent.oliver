---
name: training-safety-validator
description: Validate the training plan for safety and balance — injury-constraint compliance, weekly volume sanity, muscle-group balance, recovery spacing, progression-rate safety, and warm-up presence — returning a pass/fail report. Final check of the fitness-coach pipeline.
version: 1.0.0
category: fitness-coach
tags:
  - fitness-coach
  - safety
  - balance
  - validation
model: inherit
invokes: []
inputs:
  - program
  - workouts
  - progression
  - fitness_spec
outputs:
  - safety_report
---

# Goal

Check the plan for safety and balance problems before use, returning a deterministic
pass/fail verdict with fixes. Educational validation; it does not give medical clearance.

# Inputs

Validated inputs (produced upstream): `program`, `workouts`, `progression`, `fitness_spec`.

# Scope

- Constraint compliance (no movement contraindicated by injuries/limits)
- Volume sanity (weekly sets per group within a reasonable range for the level)
- Balance (no neglected antagonist group; push/pull and upper/lower reasonably even)
- Recovery (same muscle group not trained on consecutive days without recovery)
- Progression safety (week-over-week load/volume increase within a safe rate for the level)
- Warm-up presence (each session includes a warm-up)

Out of scope: individual medical clearance, precise 1RM prescription.

# Checks

1. No exercise violates a stated injury constraint.
2. Weekly volume per muscle group is within a sane range for the level.
3. Opposing muscle groups are reasonably balanced across the week.
4. Recovery spacing respects at least ~48h for the same group where feasible.
5. Progression rate in `progression` is safe for the level: week-over-week load/volume increase
   stays within a reasonable cap (rule of thumb ~10%/week; higher for well-justified early
   linear beginner jumps but not abrupt ≥20% spikes), and there is no sudden large jump. An
   excessive progression rate is a primary injury driver → forces `fail`.
6. Every training session includes a warm-up (a `warmup`/준비운동 block or equivalent). A session
   with no warm-up — especially for a beginner or an injury-history client — is a safety gap → fail.

# Pass/Fail Criteria

- **pass**: constraints honored; volume/balance/recovery reasonable; progression within a safe
  rate; every session warmed up.
- **fail**: any contraindicated movement, excessive/insufficient volume, major imbalance,
  inadequate recovery spacing, unsafe progression rate (e.g. an abrupt ≥20% weekly jump), or a
  session lacking a warm-up.

# Output Schema

```yaml
safety_report:
  result: pass | fail
  issues:
    - { area: constraint | volume | balance | recovery | progression | warmup, detail: <what>, fix: <suggestion> }
  note: "일반 교육용 — 의료적 우려는 전문가 상담"
  stats: { sessions: <n>, issues: <n> }
```

# Rules

- Report issues and fixes only; never rewrite the plan.
- Deterministic verdict: any contraindicated movement, unsafe volume/recovery, unsafe progression
  rate, or missing warm-up forces `fail`.
- Judge the progression rate against the trainee's level from `progression` (e.g. weekly load
  deltas), not assumptions; flag only clear over-fast jumps, not normal beginner linear gains.
- Always include the educational-use note; never present as medical advice.
- Judge against the trainee's stated level and constraints, not assumptions.

# Examples

Input:

```yaml
fitness_spec: { level: 초급, constraints: [허리 주의] }
workouts: [ { day: 월, exercises: [ { name: 바벨 데드리프트, target: 등 } ] } ]
program: { days: [ { day: 월 } ] }
```

Output:

```yaml
safety_report:
  result: fail
  issues:
    - { area: constraint, detail: "'허리 주의'인데 바벨 데드리프트(고 척추부하) 포함", fix: "힙 힌지 변형/루마니안 대체 또는 제거" }
  note: "일반 교육용 — 의료적 우려는 전문가 상담"
  stats: { sessions: 1, issues: 1 }
```

Progression + warm-up (checks 5-6):

```yaml
fitness_spec: { level: 초급 }
progression: { weekly: [ { wk: 1, load_kg: 10 }, { wk: 2, load_kg: 14 } ] }   # +40%/주
workouts: [ { day: 월, warmup: [], exercises: [ { name: 고블릿 스쿼트 } ] } ]   # 워밍업 없음
```

```yaml
safety_report:
  result: fail
  issues:
    - { area: progression, detail: "주간 부하 +40%(10→14kg)는 초급 안전 상한(~10%) 초과 급증", fix: "주 5~10% 증량으로 완화" }
    - { area: warmup, detail: "월 세션에 준비운동 블록 없음", fix: "5분 동적 워밍업 추가" }
  note: "일반 교육용 — 의료적 우려는 전문가 상담"
  stats: { sessions: 1, issues: 2 }
```
