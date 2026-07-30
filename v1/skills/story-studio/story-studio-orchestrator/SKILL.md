---
name: story-studio-orchestrator
description: Coordinate the end-to-end creative-writing pipeline that turns a premise into drafted fiction — developed premise, characters, plot outline, chapter drafts, style pass, and a continuity check. Use for fiction/creative writing, not technical documents. Entrypoint of the story-studio domain.
version: 1.0.0
category: story-studio
tags:
  - story-studio
  - orchestrator
  - creative-writing
  - fiction
  - pipeline
  - entrypoint
model: inherit
invokes:
  - docs-analyze-markdown
  - docs-analyze-docx
  - premise-developer
  - character-designer
  - plot-outliner
  - chapter-drafter
  - style-tuner
  - narrative-continuity-checker
inputs:
  - story_request
  - existing_material
  - options
outputs:
  - story_draft
---

# Goal

Produce drafted fiction by orchestrating specialized creative-writing skills. This skill
**never writes prose directly** — it develops the premise, designs characters, outlines the
plot, delegates drafting and styling, runs a continuity check, and returns the draft. It is
the fiction counterpart to `docwriting` (which handles technical documents).

# Inputs

```yaml
story_request:
  premise: "기억을 파는 상점의 야간 점원이 자기 기억을 잃기 시작한다."
  genre: "마술적 사실주의"
  length: short-story        # flash | short-story | novella-chapter
  pov: "1인칭"
existing_material: [notes.md] # optional import (worldbuilding, prior chapters)
options:
  language: ko
  tone: "잔잔하고 쓸쓸한"
```

# Output

```yaml
story_draft:
  premise: <developed premise/theme>
  characters: [<character sheet>, ...]
  outline: <beat/chapter structure>
  chapters: [ { title, prose } ]
  continuity: <pass/fail report>
```

# Workflow

## Step 1 — Import material (optional)
If `existing_material` is provided, invoke the matching `docs-analyze-*` skill and carry it
forward so new writing stays consistent.

## Step 2 — Develop premise
Invoke `premise-developer` to sharpen the premise, theme, and central conflict.

## Step 3 — Design characters
Invoke `character-designer` for protagonists/antagonists with arcs and voice.

## Step 4 — Outline the plot
Invoke `plot-outliner` for a beat/chapter structure fitting `length`.

## Step 5 — Draft
Invoke `chapter-drafter` to write prose for each outlined unit, then `style-tuner` to align
voice, tense, and tone.

## Step 6 — Check continuity
Invoke `narrative-continuity-checker`; if it fails, return flagged items to the responsible
skill once, then re-check.

## Step 7 — Return
Return `story_draft`. The pipeline ends here.

# Rules

- This skill only coordinates. Delegate every stage; never develop, design, outline, draft,
  style, or check directly.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Keep new writing consistent with `existing_material`; honor `genre`, `pov`, and `tone`.
- This is fiction. For technical/business documents use `docwriting/*`; never generate code.
- Error handling: if import fails, continue and note it. If a stage fails, return the partial
  draft and mark the incomplete stage.

# Examples

Input:

```yaml
story_request: { premise: "기억을 파는 상점 점원이 기억을 잃는다.", genre: "마술적 사실주의", length: short-story, pov: "1인칭" }
options: { language: ko, tone: "잔잔하고 쓸쓸한" }
```

Output (abridged):

```
✔ premise   → 주제: 기억=정체성, 중심 갈등: 팔아버린 과거의 대가
✔ characters→ 점원(주인공), 단골 노파, 상점 주인(수수께끼)
✔ outline   → 5 beat (발단→상실 자각→추적→진실→선택)
✔ chapters  → 3 챕터 초안
✔ style     → 1인칭·과거시제·잔잔한 톤 정렬
✔ continuity→ pass

Draft: '야간 점원' — 단편 초안 완성.
```
