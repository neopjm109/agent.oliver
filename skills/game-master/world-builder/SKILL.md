---
name: world-builder
description: Build the setting a campaign premise needs — locations, factions, history hooks, and atmosphere — as structured, reusable worldbuilding notes. Worldbuilding stage of the game-master pipeline.
version: 1.0.0
category: game-master
tags:
  - game-master
  - worldbuilding
  - setting
model: inherit
invokes: []
inputs:
  - campaign_request
  - existing_lore
outputs:
  - world
---

# Goal

Create the setting elements a session requires — locations, factions, and history hooks —
consistent with the premise, tone, and any existing lore. This skill builds setting; it does
not create NPCs, quests, or encounters (those are downstream).

# Inputs

```yaml
campaign_request: { tone, premise, system }
existing_lore: { facts: [...] }   # optional; new content must not contradict
```

# Output

```yaml
world:
  locations: [ { name, description, notable_features } ]
  factions: [ { name, goal, methods, relationship_to_premise } ]
  history_hooks: [<past event that fuels the premise>, ...]
  atmosphere: <sensory/tone notes for the GM>
```

# Workflow

## Step 1 — Anchor to premise
Derive only the locations/factions the premise actually needs; avoid unrelated sprawl.

## Step 2 — Add depth hooks
Give each faction a goal and each location notable features that create play opportunities.

## Step 3 — Respect existing lore
Ensure nothing contradicts `existing_lore`; extend it where possible.

## Step 4 — Return
Return `world`. Stop.

# Rules

- Build setting only; do not create NPCs, quests, encounters, or pacing.
- Everything must serve the premise/tone; no unrelated worldbuilding.
- Never contradict `existing_lore`; reference it when extending.
- Keep entries GM-usable (concrete, playable), not encyclopedic.

# Examples

Input:

```yaml
campaign_request: { tone: "coastal mystery", premise: "Children vanish at low tide." }
```

Output:

```yaml
world:
  locations:
    - { name: "썰물만", description: "썰물마다 옛 사원이 드러나는 항구 마을", notable_features: ["조수로 열리는 지하 통로"] }
  factions:
    - { name: "밀물 교단", goal: "잠긴 신을 깨우기", methods: "아이 제물", relationship_to_premise: "실종의 배후" }
  history_hooks: ["100년 전 마을이 신전을 바다에 수장시킴"]
  atmosphere: "짠내, 안개, 종소리, 젖은 돌"
```
