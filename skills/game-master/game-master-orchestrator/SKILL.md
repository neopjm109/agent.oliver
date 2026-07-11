---
name: game-master-orchestrator
description: Coordinate the end-to-end tabletop RPG prep pipeline that turns a campaign premise into a runnable session — world, NPCs, quests, encounters, and a session outline — with a lore/balance consistency check. Use for TTRPG game-mastering prep. Entrypoint of the game-master domain.
version: 1.0.0
category: game-master
tags:
  - game-master
  - orchestrator
  - ttrpg
  - tabletop
  - pipeline
  - entrypoint
model: inherit
invokes:
  - docs-analyze-markdown
  - docs-analyze-pdf
  - docs-analyze-docx
  - world-builder
  - npc-generator
  - quest-generator
  - encounter-generator
  - session-outliner
  - lore-consistency-checker
inputs:
  - campaign_request
  - existing_lore
  - options
outputs:
  - session_pack
---

# Goal

Produce a ready-to-run TTRPG session by orchestrating specialized game-master skills. This
skill **never writes content directly** — it sequences worldbuilding, NPCs, quests,
encounters, and pacing, delegates each stage, runs a consistency check, and returns the
pack. It generates prose/structured prep, not software.

# Inputs

```yaml
campaign_request:
  system: "D&D 5e"          # or PF2e, generic, etc.
  tone: "high fantasy, mystery"
  party: { size: 4, level: 3 }
  premise: "A coastal town's children are vanishing at low tide."
existing_lore: [campaign-bible.md]   # optional import
options:
  session_length: "3-4h"
  language: ko
```

# Output

```yaml
session_pack:
  world: <setting facts from world-builder>
  npcs: [<npc>, ...]
  quests: [<quest>, ...]
  encounters: [<encounter, balanced to party>, ...]
  session_outline: <scene-by-scene pacing>
  consistency: <pass/fail report from lore-consistency-checker>
```

# Workflow

## Step 1 — Import existing lore (optional)
If `existing_lore` is provided, invoke the matching `docs-analyze-*` skill and pass the
facts downstream so new content stays consistent with it.

## Step 2 — Build the world
Invoke `world-builder` for the setting, factions, and locations the premise needs.

## Step 3 — Populate
Invoke `npc-generator` (key NPCs with motivations/stats) and `quest-generator` (the main
hook plus branches).

## Step 4 — Challenge
Invoke `encounter-generator` for combat/social/exploration encounters balanced to the
party's size and level.

## Step 5 — Pace the session
Invoke `session-outliner` to sequence everything into a scene-by-scene outline fitting
`session_length`.

## Step 6 — Check consistency
Invoke `lore-consistency-checker`; if it fails, return the flagged items to the responsible
generator once, then re-check.

## Step 7 — Return
Return the `session_pack`. The pipeline ends here.

# Rules

- This skill only coordinates. Delegate every stage; never build world, NPCs, quests,
  encounters, or outline directly.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Respect the chosen `system` conventions; keep new content consistent with `existing_lore`.
- Encounters must be balanced to the stated party; flag lethal/trivial ones via the checker.
- Never generate software/code; this domain produces game-prep content.
- Error handling: if lore import fails, continue and note it. If a generator fails, return
  the partial pack and mark the stage.

# Examples

Input:

```yaml
campaign_request: { system: "D&D 5e", tone: "coastal mystery", party: { size: 4, level: 3 }, premise: "Children vanish at low tide." }
options: { session_length: "3-4h", language: ko }
```

Output (abridged):

```
✔ world     → 항구 마을 '썰물만', 밀수 길드, 물에 잠긴 사원
✔ npcs      → 4 (실종 아이 부모, 수상한 등대지기, 인어 정보원, 흑막 사제)
✔ quests    → 메인(아이 추적) + 분기 2
✔ encounters→ 3 (밸런스: lvl3×4 기준 중간 난이도)
✔ outline   → 5 scene, 3-4h 페이싱
✔ consistency → pass

Session Pack: '썰물의 아이들' — 즉시 실행 가능.
```
