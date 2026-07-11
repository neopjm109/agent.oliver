---
name: session-outliner
description: Sequence world, NPCs, quests, and encounters into a scene-by-scene session outline with pacing, hooks, and fallback beats that fit the target play time. Pacing stage of the game-master pipeline.
version: 1.0.0
category: game-master
tags:
  - game-master
  - session
  - pacing
  - outline
model: inherit
invokes: []
inputs:
  - quests
  - encounters
  - npcs
  - options
outputs:
  - session_outline
---

# Goal

Arrange the prepared elements into a runnable session: an ordered set of scenes with
pacing, transitions, and fallback beats sized to the target play time. This skill sequences
existing content; it does not create new world/NPCs/quests/encounters.

# Inputs

```yaml
quests: [ { id, objectives, branches } ]
encounters: [ { id, type } ]
npcs: [ { name, role } ]
options:
  session_length: "3-4h"
```

# Output

```yaml
session_outline:
  scenes:
    - order: <n>
      title: <scene title>
      goal: <what this scene accomplishes>
      elements: [<quest/encounter/npc ids used>]
      est_time: <minutes>
      transition: <how it leads to the next scene>
  fallbacks: [<beat to add/cut if running long/short>]
  total_est: <time>
```

# Workflow

## Step 1 — Order scenes
Sequence from hook → investigation → climax, placing encounters to control pacing.

## Step 2 — Budget time
Estimate each scene's time to fit `session_length`; sum to `total_est`.

## Step 3 — Add fallbacks
Provide beats to trim or expand if the table runs fast or slow.

## Step 4 — Return
Return `session_outline`. Stop.

# Rules

- Only sequence provided elements; never invent new content here.
- Total estimate must fit `session_length`; note where to cut/pad via `fallbacks`.
- Vary scene types (avoid back-to-back combat) for pacing.
- Reference elements by id so the pack stays consistent.

# Examples

Input:

```yaml
quests: [ { id: tide-children } ]
encounters: [ { id: lighthouse-cultists, type: combat } ]
npcs: [ { name: "인어 세라", role: informant } ]
options: { session_length: "3-4h" }
```

Output:

```yaml
session_outline:
  scenes:
    - { order: 1, title: "의뢰와 소문", goal: "훅 제시·정보 수집", elements: [tide-children, "인어 세라"], est_time: 45, transition: "세라가 등대를 지목" }
    - { order: 2, title: "등대 잠입", goal: "클라이맥스 전투", elements: [lighthouse-cultists], est_time: 60, transition: "카일 심문으로 사원 위치 확보" }
  fallbacks: ["시간 부족 시 소문 장면 축소", "여유 시 밀수 길드 서브 장면 추가"]
  total_est: "3h"
```
