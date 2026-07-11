---
name: premise-developer
description: Sharpen a raw premise into a developed concept — theme, central conflict, stakes, and a one-line logline — that anchors the rest of the story. First stage of the story-studio pipeline.
version: 1.0.0
category: story-studio
tags:
  - story-studio
  - premise
  - theme
  - concept
model: inherit
invokes: []
inputs:
  - story_request
  - existing_material
outputs:
  - developed_premise
---

# Goal

Turn a rough premise into a workable concept: a clear theme, central conflict, stakes, and
logline. This skill develops the concept; it does not design characters or outline plot.

# Inputs

```yaml
story_request: { premise, genre, tone }
existing_material: { facts: [...] }   # optional
```

# Output

```yaml
developed_premise:
  logline: <one sentence>
  theme: <what the story is really about>
  central_conflict: <core tension>
  stakes: <what is won/lost>
  questions: [<dramatic question the story must answer>, ...]
```

# Workflow

## Step 1 — Extract the theme
Identify what the premise is really about beneath the surface events.

## Step 2 — Define conflict & stakes
State the central tension and what hangs on it.

## Step 3 — Logline & questions
Compress to a logline; list the dramatic questions the story must answer.

## Step 4 — Return
Return `developed_premise`. Stop.

# Rules

- Develop the given premise; do not swap it for a different story.
- Honor `genre`/`tone`; keep the concept coherent with `existing_material`.
- Do not design characters or outline plot — those are downstream.
- One theme and one central conflict; avoid diluting focus.

# Examples

Input:

```yaml
story_request: { premise: "기억을 파는 상점 점원이 기억을 잃는다.", genre: "마술적 사실주의", tone: "쓸쓸한" }
```

Output:

```yaml
developed_premise:
  logline: "타인의 기억을 파는 점원이 대가로 자기 기억을 잃어가며 자신이 누구였는지 되찾으려 한다."
  theme: "기억이 곧 정체성이라면, 잊는다는 것은 사라지는 것인가"
  central_conflict: "생계(기억 판매) vs 자기 보존(기억 상실)"
  stakes: "자신이 누구였는지에 대한 기억 전체"
  questions: ["점원은 마지막 기억을 팔 것인가 지킬 것인가?"]
```
