---
name: lore-consistency-checker
description: Validate the session pack for internal consistency — lore contradictions, NPC/faction alignment, stat/system correctness, and encounter balance versus the party — returning a pass/fail report. Final check of the game-master pipeline.
version: 1.0.0
category: game-master
tags:
  - game-master
  - consistency
  - balance
  - validation
model: inherit
invokes: []
inputs:
  - session_pack
  - campaign_request
  - existing_lore
outputs:
  - consistency_report
---

# Goal

Check the assembled pack for contradictions and balance problems before play, returning a
deterministic pass/fail verdict with specific fixes. This validates game-prep content; it
does not rewrite it.

# Scope

- Lore consistency (no contradictions within the pack or against `existing_lore`)
- Reference integrity (NPCs/locations/quests referenced actually exist in the pack)
- System/stat correctness (stat blocks valid for the `system`)
- Encounter balance (difficulty reasonable for the stated party)

Out of scope: subjective quality/fun, rules-lawyering edge cases.

# Checks

1. No fact contradicts another fact or `existing_lore`.
2. Every `elements`/`ties`/`involves` reference resolves to a real pack entry.
3. Stat blocks are valid and level-appropriate for the `system`.
4. Encounter difficulty sits within a sane budget for `party.size`×`party.level`.

# Pass/Fail Criteria

- **pass**: no contradictions, all references resolve, stats valid, no wildly off-balance
  encounters.
- **fail**: any contradiction, dangling reference, invalid stat block, or accidental
  trivial/lethal encounter.

# Output Schema

```yaml
consistency_report:
  result: pass | fail
  issues:
    - { area: lore | reference | stats | balance, detail: <what>, fix: <suggestion> }
  stats: { npcs: <n>, encounters: <n>, issues: <n> }
```

# Rules

- Report issues and fixes only; never rewrite the pack (the generator applies fixes).
- Deterministic verdict: any contradiction, dangling reference, or off-balance encounter
  forces `fail`.
- Balance is judged against the stated party, not an assumed one.
- Do not judge subjective fun/quality; only the checkable properties above.

# Examples

Input:

```yaml
session_pack:
  npcs: [ { name: "등대지기 카일" } ]
  encounters: [ { id: lighthouse-cultists, difficulty_note: "deadly for lvl3×4" } ]
  session_outline: { scenes: [ { elements: ["인어 세라"] } ] }   # 세라 미정의
campaign_request: { party: { size: 4, level: 3 } }
```

Output:

```yaml
consistency_report:
  result: fail
  issues:
    - { area: reference, detail: "outline이 미정의 NPC '인어 세라' 참조", fix: "npc-generator로 세라 추가 또는 참조 제거" }
    - { area: balance, detail: "lighthouse-cultists가 lvl3×4에 deadly", fix: "적 수 감소 또는 지형 완화" }
  stats: { npcs: 1, encounters: 1, issues: 2 }
```
