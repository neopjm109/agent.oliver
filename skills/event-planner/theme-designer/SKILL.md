---
name: theme-designer
description: Design an event theme — concept, color palette, decor, and ambiance (lighting/music mood) — fitting the occasion, vibe, and budget. Theme stage of the event-planner pipeline.
version: 1.0.0
category: event-planner
tags:
  - event-planner
  - theme
  - decor
model: inherit
invokes: []
inputs:
  - event_spec
outputs:
  - theme
---

# Goal

Create a cohesive theme that ties the event together: a concept, palette, decor items, and
ambiance guidance suited to the occasion, vibe, and budget. This skill designs the theme; it
does not plan menu, activities, or timeline.

# Inputs

```yaml
event_spec: { occasion, vibe, budget: { per_head }, venue }
```

# Output

```yaml
theme:
  concept: <one-line theme>
  palette: [<color>, ...]
  decor: [ { item, budget_tier: low|mid, diy: true|false } ]
  est_decor_cost: <amount>          # rough decor estimate, rolled into the feasibility budget check
  ambiance: { lighting, music_mood, scent }
```

# Workflow

## Step 1 — Set the concept
Derive a concept from occasion + vibe.

## Step 2 — Palette & decor
Choose a palette and decor items scaled to budget (favor DIY when tight).

## Step 3 — Ambiance
Specify lighting, music mood, and optional scent for the atmosphere.

## Step 4 — Return
Return `theme`. Stop.

# Rules

- Fit decor cost to the budget tier; flag DIY options when budget is tight.
- Respect venue constraints (e.g. no open flame if restricted).
- Keep the theme cohesive; palette and decor should align.
- Do not plan menu, activities, or run-of-show.

# Examples

Input:

```yaml
event_spec: { occasion: 생일 파티, vibe: [캐주얼, 아늑한], budget: { per_head: 25000 }, venue: { place: 집 } }
```

Output:

```yaml
theme:
  concept: "따뜻한 홈파티"
  palette: ["크림", "테라코타", "골드"]
  decor: [ { item: 종이 가랜드, budget_tier: low, diy: true }, { item: LED 캔들, budget_tier: low, diy: false } ]
  est_decor_cost: 20000
  ambiance: { lighting: "웜톤 간접등", music_mood: "어쿠스틱 플레이리스트", scent: "바닐라 캔들" }
```
