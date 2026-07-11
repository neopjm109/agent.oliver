---
name: narrative-continuity-checker
description: Validate the story draft for continuity — timeline order, character trait/name consistency, established facts, and POV/tense stability — returning a pass/fail report. Final check of the story-studio pipeline.
version: 1.0.0
category: story-studio
tags:
  - story-studio
  - continuity
  - consistency
  - validation
model: inherit
invokes: []
inputs:
  - chapters
  - characters
  - outline
  - story_request
outputs:
  - continuity_report
---

# Goal

Check the draft for internal contradictions before it is finalized, returning a deterministic
pass/fail verdict with specific fixes. This validates the narrative; it does not rewrite it.

# Scope

- Timeline (events occur in a consistent order; no impossible sequencing)
- Character consistency (names, traits, established facts stay stable)
- Fact consistency (details established earlier are not contradicted later)
- POV/tense stability (matches `story_request` throughout)

Out of scope: subjective quality, prose taste, plot preference.

# Checks

1. Event order is internally consistent (references to past/future events hold).
2. Character names/traits/relationships match the character sheets throughout.
3. Established facts (setting, objects, rules) are not later contradicted.
4. POV and tense remain consistent across chapters.

# Pass/Fail Criteria

- **pass**: no timeline, character, fact, or POV/tense contradictions.
- **fail**: any contradiction in the above.

# Output Schema

```yaml
continuity_report:
  result: pass | fail
  issues:
    - { chapter: <order>, area: timeline | character | fact | pov-tense, detail: <what>, fix: <suggestion> }
  stats: { chapters: <n>, issues: <n> }
```

# Rules

- Report issues and fixes only; never rewrite prose (the drafter/style-tuner applies fixes).
- Deterministic verdict: any contradiction forces `fail`.
- Judge against the character sheets and outline, not assumptions.
- Do not evaluate subjective quality; only checkable consistency.

# Examples

Input:

```yaml
chapters:
  - { order: 1, prose: "점원은 매일 아침 상점을 연다." }     # 낮 근무로 서술
  - { order: 2, prose: "야간 점원인 나는 자정에 출근했다." }  # 야간으로 서술
characters: [ { name: "점원" } ]
```

Output:

```yaml
continuity_report:
  result: fail
  issues:
    - { chapter: 2, area: fact, detail: "1장은 아침 근무, 2장은 야간 근무로 모순", fix: "근무 시간대를 야간으로 통일" }
    - { chapter: 2, area: pov-tense, detail: "1장 3인칭 서술 vs 2장 1인칭 서술로 시점 불일치", fix: "서술 시점을 하나로 통일" }
  stats: { chapters: 2, issues: 2 }
```
