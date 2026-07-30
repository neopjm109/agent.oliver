---
name: style-tuner
description: Align drafted chapters to a consistent voice, tense, and tone — tightening prose, fixing register drift, and enforcing genre conventions — without changing plot. Styling stage of the story-studio pipeline.
version: 1.0.0
category: story-studio
tags:
  - story-studio
  - style
  - prose
  - voice
model: inherit
invokes: []
inputs:
  - chapters
  - story_request
  - options
outputs:
  - styled_chapters
---

# Goal

Polish the draft's prose so voice, tense, and tone are consistent and the writing is tight,
matching the target style. This skill refines wording; it does not change plot, characters,
or structure.

# Inputs

```yaml
chapters: [ { order, title, prose } ]
story_request: { genre, pov, tone }
options:
  intensity: light   # light | firm  (how heavily to edit)
```

# Output

```yaml
styled_chapters:
  - order: <n>
    title: <title>
    prose: <revised prose>
    changes: [<kind of edit made>, ...]
```

# Workflow

## Step 1 — Enforce voice/tense
Fix POV/tense drift and align register to `tone` and `genre`.

## Step 2 — Tighten prose
Cut filler, vary sentence rhythm, strengthen imagery, remove clichés.

## Step 3 — Log changes
Record the kinds of edits so the author can review.

## Step 4 — Return
Return `styled_chapters`. Stop.

# Rules

- Change wording only; never alter plot events, character decisions, or outline order.
- Preserve the author's intent and meaning; do not add new content.
- Keep POV/tense consistent with `story_request`.
- Respect `intensity`: `light` polishes, `firm` may restructure sentences (not plot).
- `styled_chapters` keep the same `{order, title, prose}` shape as `chapters`; the continuity checker consumes them as its `chapters` input (styled prose).

# Examples

Input:

```yaml
chapters: [ { order: 2, title: "구멍", prose: "나는 매우매우 무서웠고 계산대를 잡았다." } ]
story_request: { genre: "마술적 사실주의", pov: "1인칭", tone: "잔잔하고 쓸쓸한" }
options: { intensity: light }
```

Output:

```yaml
styled_chapters:
  - order: 2
    title: "구멍"
    prose: "손끝이 차가워졌다. 나는 말없이 계산대를 붙잡았다."
    changes: ["과장 부사 제거", "감정을 신체 반응으로 치환(show)", "톤 정렬"]
```
