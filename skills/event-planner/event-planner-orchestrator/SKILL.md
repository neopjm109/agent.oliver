---
name: event-planner-orchestrator
description: Coordinate the end-to-end event-planning pipeline that turns an occasion, guest count, and budget into a themed plan — menu, activities, run-of-show, and checklist — validated for feasibility. Use for parties/gatherings, not code. Entrypoint of the event-planner domain.
version: 1.0.0
category: event-planner
tags:
  - event-planner
  - orchestrator
  - party
  - hosting
  - pipeline
  - entrypoint
model: inherit
invokes:
  - event-brief-analyzer
  - theme-designer
  - menu-activity-planner
  - run-of-show-builder
  - event-feasibility-validator
inputs:
  - event_request
  - options
outputs:
  - event_plan
---

# Goal

Produce a runnable event plan by orchestrating specialized event-planner skills. This skill
**never plans directly** — it analyzes the brief, designs a theme, plans menu/activities,
builds a timeline and checklist, validates feasibility, and returns the plan. Planning content
only, no code.

# Inputs

```yaml
event_request:
  occasion: "생일 파티"
  guests: 12
  budget: { amount: 300000, currency: KRW }
  venue: "집"
  duration: "4시간"
  vibe: ["캐주얼", "아늑한"]
options:
  language: ko
```

# Output

```yaml
event_plan:
  theme: <theme & decor>
  menu: [<food/drink>]
  activities: [<activity>]
  run_of_show: [ { time, segment } ]
  checklist: [<prep task>]
  feasibility: <pass/fail report>
```

# Workflow

## Step 1 — Analyze the brief
Invoke `event-brief-analyzer` to normalize occasion, guests, budget, venue, and constraints.

## Step 2 — Design the theme
Invoke `theme-designer` for a theme, decor, and ambiance fitting the vibe and budget.

## Step 3 — Plan menu & activities
Invoke `menu-activity-planner` for food/drinks and activities scaled to guests and budget.

## Step 4 — Build the run-of-show
Invoke `run-of-show-builder` for a timeline and a prep checklist within the duration.

## Step 5 — Validate feasibility
Invoke `event-feasibility-validator`; if it fails, return flagged items to the responsible
skill once, then re-check.

## Step 6 — Return
Return `event_plan`. The pipeline ends here.

# Rules

- This skill only coordinates. Delegate every stage; never design theme, plan menu, or build
  the timeline directly.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Respect budget and guest count as hard limits; flag overruns via the validator.
- Never generate code; this domain produces event-planning content.
- Error handling: if a stage fails, return the partial plan and mark the incomplete stage.

# Examples

Input:

```yaml
event_request: { occasion: "생일 파티", guests: 12, budget: { amount: 300000, currency: KRW }, venue: "집", duration: "4시간", vibe: ["캐주얼"] }
options: { language: ko }
```

Output (abridged):

```
✔ brief    → 생일·12인·30만원·집·4시간·캐주얼
✔ theme    → '따뜻한 홈파티' (가랜드·캔들·플레이리스트)
✔ menu     → 핑거푸드 6종 + 케이크 + 음료
✔ timeline → 4시간 5구간 + 준비 체크리스트
✔ feasibility → pass (예산 내 ₩285,000)

Event Plan: 12인 홈 생일파티 — 예산·시간 내 실행 가능.
```
