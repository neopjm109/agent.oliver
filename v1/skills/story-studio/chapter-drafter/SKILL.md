---
name: chapter-drafter
description: Write finished prose for each outlined unit, in the story's POV and tense, rendering events through scene and character voice. Drafting stage of the story-studio pipeline.
version: 1.0.0
category: story-studio
tags:
  - story-studio
  - draft
  - prose
  - chapter
model: inherit
invokes: []
inputs:
  - outline
  - characters
  - story_request
  - options
outputs:
  - chapters
---

# Goal

Turn each outline unit into finished prose — scenes with action, dialogue, and interiority —
in the requested POV and tense. This skill writes the draft; final voice/tone alignment is
`style-tuner`, and consistency is checked downstream.

# Inputs

```yaml
outline: { units: [ { order, title, events, arc_progress } ] }
characters: [ { name, voice } ]
story_request: { pov, genre }
options:
  language: ko
```

# Output

```yaml
chapters:
  - order: <n>
    title: <title>
    prose: <finished scene prose>
```

# Workflow

## Step 1 — Render each unit
Dramatize the unit's events as scenes (show, don't summarize), using character voices.

## Step 2 — Hold POV & tense
Write consistently in the requested `pov` and tense.

## Step 3 — Advance the arc
Ensure each chapter's prose delivers the unit's `arc_progress`.

## Step 4 — Return
Return `chapters`. Stop.

# Rules

- Follow the outline; do not add new plot units or resolve the arc early.
- Maintain the requested POV/tense throughout; keep character voices distinct.
- Render scenes rather than narrating summaries; honor `genre`.
- Do not do the final style/tone pass (that is `style-tuner`).

# Examples

Input:

```yaml
outline: { units: [ { order: 2, title: "구멍", events: ["자기 기억 결손 발견"], arc_progress: "불안 시작" } ] }
characters: [ { name: "점원", voice: "담담한 1인칭 독백" } ]
story_request: { pov: "1인칭", genre: "마술적 사실주의" }
options: { language: ko }
```

Output:

```yaml
chapters:
  - order: 2
    title: "구멍"
    prose: >
      계산을 마치고 손님이 나간 뒤, 나는 내 어린 시절 여름을 떠올리려 했다. 그런데 거기,
      매미 소리가 있어야 할 자리에 아무것도 없었다. 소리도, 색도, 냄새도. 마치 누군가 그
      칸만 도려내 판 것처럼. 나는 계산대를 붙잡았다. 언제부터였을까.
```
