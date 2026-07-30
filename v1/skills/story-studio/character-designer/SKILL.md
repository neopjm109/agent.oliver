---
name: character-designer
description: Create character sheets — motivation, flaw, arc, voice, and relationships — for the story's principals, grounded in the developed premise. Character stage of the story-studio pipeline.
version: 1.0.0
category: story-studio
tags:
  - story-studio
  - character
  - arc
model: inherit
invokes: []
inputs:
  - developed_premise
  - story_request
  - options
outputs:
  - characters
---

# Goal

Design the story's principal characters so they can carry the theme and conflict — each with
a want, a flaw, an arc, and a distinct voice. This skill designs characters; it does not
outline plot or write prose.

# Inputs

```yaml
developed_premise: { theme, central_conflict }
story_request: { genre, pov }
options:
  count: 3
```

# Output

```yaml
characters:
  - name: <name>
    role: protagonist | antagonist | supporting
    want: <external goal>
    need: <internal truth they must learn>
    flaw: <what holds them back>
    arc: <how they change, or fail to>
    voice: <speech/interiority notes>
    relationships: [<to other characters>]
```

# Workflow

## Step 1 — Anchor to theme
Give the protagonist a want/need that embodies the central conflict and theme.

## Step 2 — Build the cast
Add antagonist and supporting characters who pressure the protagonist's flaw.

## Step 3 — Voice & relationships
Give each a distinct voice and define key relationships.

## Step 4 — Return
Return `characters`. Stop.

# Rules

- Every principal must connect to the theme/conflict; no decorative characters.
- Protagonist needs both an external want and an internal need in tension.
- Give distinct voices so dialogue won't blur; honor `pov`.
- Do not outline plot or draft prose.

# Examples

Input:

```yaml
developed_premise: { theme: "기억=정체성", central_conflict: "생계 vs 자기 보존" }
story_request: { genre: "마술적 사실주의", pov: "1인칭" }
options: { count: 2 }
```

Output:

```yaml
characters:
  - { name: "야간 점원 '나'", role: protagonist, want: "월세를 벌다", need: "자신의 과거를 마주하기", flaw: "고통스러운 기억을 회피", arc: "회피→직면", voice: "담담한 1인칭 독백", relationships: ["단골 노파"] }
  - { name: "단골 노파", role: supporting, want: "죽은 아들의 기억을 되사기", need: "상실을 받아들이기", flaw: "집착", arc: "집착→작별", voice: "느리고 다정한", relationships: ["점원"] }
```
