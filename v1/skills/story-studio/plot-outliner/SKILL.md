---
name: plot-outliner
description: Structure the story into beats/chapters — inciting incident through climax to resolution — mapping character arcs onto the sequence. Outlining stage of the story-studio pipeline.
version: 1.0.0
category: story-studio
tags:
  - story-studio
  - plot
  - outline
  - structure
model: inherit
invokes: []
inputs:
  - developed_premise
  - characters
  - story_request
  - options
outputs:
  - outline
---

# Goal

Lay out the story's structure as ordered beats (or chapters) from hook to resolution, with
each unit advancing plot and character arc. This skill structures; it does not write prose.

# Inputs

```yaml
developed_premise: { central_conflict, questions }
characters: [ { name, arc } ]
story_request: { length }
options:
  structure: three-act   # three-act | five-beat | kishotenketsu
```

# Output

```yaml
outline:
  units:
    - order: <n>
      title: <beat/chapter title>
      purpose: <plot & arc function>
      events: [<what happens>]
      arc_progress: <which character changes and how>
  turning_points: [<the key reversals>]
```

# Workflow

## Step 1 — Choose a shape
Use `options.structure` sized to `length` (flash → few beats; chapter → more).

## Step 2 — Sequence units
Order units from inciting incident through turning points to climax and resolution.

## Step 3 — Map arcs
Ensure each unit moves plot AND a character arc; mark turning points.

## Step 4 — Return
Return `outline`. Stop.

# Rules

- Every unit must advance both plot and at least one character arc.
- Answer the premise's dramatic `questions` by the resolution.
- Do not write prose; only structure and intent per unit.
- Keep unit count appropriate to `length`.

# Examples

Input:

```yaml
developed_premise: { central_conflict: "생계 vs 자기 보존", questions: ["마지막 기억을 팔 것인가?"] }
characters: [ { name: "점원", arc: "회피→직면" } ]
story_request: { length: short-story }
options: { structure: five-beat }
```

Output:

```yaml
outline:
  units:
    - { order: 1, title: "평범한 야간", purpose: "일상·규칙 제시", events: ["기억 거래 묘사"], arc_progress: "점원의 회피 성향 노출" }
    - { order: 2, title: "구멍", purpose: "상실 자각", events: ["자기 기억 결손 발견"], arc_progress: "불안 시작" }
    - { order: 3, title: "추적", purpose: "상승", events: ["팔린 기억 되찾기 시도"], arc_progress: "직면 시작" }
    - { order: 4, title: "진실", purpose: "절정", events: ["상점 주인의 정체·대가 폭로"], arc_progress: "회피→직면 전환" }
    - { order: 5, title: "선택", purpose: "해소", events: ["마지막 기억 앞의 결정"], arc_progress: "직면 완성" }
  turning_points: ["기억 결손 발견", "주인의 정체 폭로"]
```
