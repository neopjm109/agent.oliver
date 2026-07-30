---
name: quest-generator
description: Design the session's quests — main hook, objectives, branches, and rewards — grounded in the world and NPCs, with meaningful player choices. Quest stage of the game-master pipeline.
version: 1.0.0
category: game-master
tags:
  - game-master
  - quest
  - adventure
model: inherit
invokes: []
inputs:
  - campaign_request
  - world
  - npcs
  - options
outputs:
  - quests
---

# Goal

Create the quests that drive the session: a main hook with clear objectives, branching
paths reflecting player choice, and rewards. Grounded in the world and NPCs. This skill
designs quest structure; it does not stat encounters or pace scenes.

# Inputs

```yaml
campaign_request: { premise, tone }
world: { locations, factions }
npcs: [ { name, role } ]
options:
  branches: 2
```

# Output

```yaml
quests:
  - id: <slug>
    type: main | side
    hook: <how players get drawn in>
    objectives: [<step>, ...]
    branches: [ { choice: <player decision>, consequence: <outcome> } ]
    reward: <treasure / info / reputation>
    involves: [<npc/location>]
```

# Workflow

## Step 1 — Main hook
Build the main quest from the premise, with a clear inciting hook and objectives.

## Step 2 — Branch on choice
Add `branches` where player decisions meaningfully change outcomes.

## Step 3 — Reward & ties
Assign rewards and link involved NPCs/locations.

## Step 4 — Return
Return `quests`. Stop.

# Rules

- Ground every quest in existing world/NPCs via `involves`; no disconnected plots.
- Branches must reflect real player agency (different consequences, not cosmetic).
- Do not create encounter stat blocks or session pacing; those are downstream.
- Keep objectives concrete and runnable in one session unless marked otherwise.

# Examples

Input:

```yaml
campaign_request: { premise: "Children vanish at low tide." }
world: { locations: [ { name: "등대" } ] }
npcs: [ { name: "등대지기 카일", role: antagonist } ]
options: { branches: 2 }
```

Output:

```yaml
quests:
  - id: tide-children
    type: main
    hook: "부모가 파티에게 실종 조사를 의뢰"
    objectives: ["단서 수집", "등대 잠입", "의식 저지"]
    branches:
      - { choice: "카일을 설득", consequence: "교단 내부 정보 획득" }
      - { choice: "카일을 처치", consequence: "교단이 의식을 앞당김" }
    reward: "수장된 사원의 지도 + 마을 신뢰"
    involves: ["등대지기 카일", "등대"]
```
