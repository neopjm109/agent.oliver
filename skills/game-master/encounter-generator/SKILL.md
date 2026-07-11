---
name: encounter-generator
description: Build combat, social, and exploration encounters balanced to the party's size and level, with tactics, terrain, and non-combat resolutions. Encounter stage of the game-master pipeline.
version: 1.0.0
category: game-master
tags:
  - game-master
  - encounter
  - combat
  - balance
model: inherit
invokes: []
inputs:
  - campaign_request
  - world
  - quests
  - npcs
  - options
outputs:
  - encounters
---

# Goal

Create the session's encounters — combat, social, and exploration — each balanced to the
party and offering more than one path to resolution. This skill builds encounters; it does
not sequence them into the session (that is `session-outliner`).

# Inputs

```yaml
campaign_request: { system, party: { size, level } }
world: { locations }
quests: [ { id, objectives } ]
options:
  difficulty: medium   # easy | medium | hard | deadly
```

# Output

```yaml
encounters:
  - id: <slug>
    type: combat | social | exploration
    setup: <situation & terrain>
    challenge: <enemies/obstacle scaled to party>
    tactics: <how it plays out dynamically>
    non_combat_out: <alternative resolution>
    difficulty_note: <balance rationale vs party>
```

# Workflow

## Step 1 — Derive from quests
Create encounters that advance quest objectives, set in world locations.

## Step 2 — Balance to party
Scale challenge to `party.size`×`party.level` at the target `difficulty`; note the budget.

## Step 3 — Add alternatives
Provide a non-combat resolution and dynamic tactics so encounters aren't static.

## Step 4 — Return
Return `encounters`. Stop.

# Rules

- Balance to the stated party; state the rationale in `difficulty_note` (avoid accidental
  TPKs or trivial fights).
- Every encounter offers at least one non-combat path.
- Ground each in a world location and a quest objective.
- Do not pace/sequence the session; only build the encounters.

# Examples

Input:

```yaml
campaign_request: { system: "D&D 5e", party: { size: 4, level: 3 } }
world: { locations: [ { name: "등대" } ] }
quests: [ { id: tide-children, objectives: ["등대 잠입"] } ]
options: { difficulty: medium }
```

Output:

```yaml
encounters:
  - id: lighthouse-cultists
    type: combat
    setup: "좁은 나선 계단, 미끄러운 젖은 돌"
    challenge: "Cultist ×4 + Cult Fanatic ×1"
    tactics: "광신자가 위층에서 엄호, 신도가 계단 병목 활용"
    non_combat_out: "카일과의 연줄로 통과 협상"
    difficulty_note: "lvl3×4 medium 예산 내 (지형이 파티에 불리해 체감 난이도 +)"
```
