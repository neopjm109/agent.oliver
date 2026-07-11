---
name: npc-generator
description: Create NPCs with motivations, secrets, mannerisms, and system-appropriate stat blocks, tied to the world and premise. NPC stage of the game-master pipeline.
version: 1.0.0
category: game-master
tags:
  - game-master
  - npc
  - character
model: inherit
invokes: []
inputs:
  - campaign_request
  - world
  - options
outputs:
  - npcs
---

# Goal

Populate the world with NPCs the session needs — each with a motivation, a secret, a
role in the premise, and a stat block appropriate to the `system`. This skill makes
characters; it does not write quests, encounters, or pacing.

# Inputs

```yaml
campaign_request: { system, premise, party: { level } }
world: { locations: [...], factions: [...] }
options:
  count: 4
```

# Output

```yaml
npcs:
  - name: <name>
    role: ally | antagonist | neutral | informant
    motivation: <what they want>
    secret: <hidden truth>
    mannerism: <memorable trait for the GM to voice>
    stats: <system-appropriate block or "non-combatant">
    ties: [<faction/location/other npc>]
```

# Workflow

## Step 1 — Cover the roles
Ensure the premise's needed roles exist (villain, ally, wildcard, informant).

## Step 2 — Give depth
Each NPC gets a motivation, a secret, and a voiceable mannerism.

## Step 3 — Stat to system & level
Provide a stat block scaled to the party level, or mark non-combatants.

## Step 4 — Return
Return `npcs`. Stop.

# Rules

- Tie every NPC to the world/premise via `ties`; no disconnected characters.
- Stats must fit the `system` and be reasonable for the party level.
- Give each a secret and a mannerism so they are playable, not flat.
- Do not write quests or encounters; only the characters.

# Examples

Input:

```yaml
campaign_request: { system: "D&D 5e", premise: "Children vanish at low tide.", party: { level: 3 } }
world: { factions: [ { name: "밀물 교단" } ] }
options: { count: 2 }
```

Output:

```yaml
npcs:
  - { name: "등대지기 카일", role: antagonist, motivation: "교단 승진", secret: "밤마다 아이를 넘긴다", mannerism: "말끝마다 파도 세는 버릇", stats: "Cultist (CR 1/8)", ties: ["밀물 교단", "등대"] }
  - { name: "인어 세라", role: informant, motivation: "동족 보호", secret: "제물 의식 목격자", mannerism: "노래로만 대답", stats: "non-combatant", ties: ["썰물만"] }
```
