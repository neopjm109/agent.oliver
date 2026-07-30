---
name: quiz-blueprint-planner
description: Plan a quiz's structure — question count, type mix, difficulty distribution, and topic-coverage map — before any questions are written. First stage of the quiz-forge pipeline.
version: 1.0.0
category: quiz-forge
tags:
  - quiz-forge
  - blueprint
  - structure
model: inherit
invokes: []
inputs:
  - quiz_request
outputs:
  - quiz_blueprint
---

# Goal

Design the quiz's skeleton so questions are balanced and cover the topic: how many of each
type, at what difficulty, over which subtopics. This skill plans structure; it does not write
questions.

# Inputs

```yaml
quiz_request: { topic, count, format, difficulty, audience }
```

# Output

```yaml
quiz_blueprint:
  slots:
    - { id: Q1, type: multiple-choice, difficulty: easy, subtopic: <coverage area> }
  coverage: [<subtopic>, ...]
  difficulty_spread: { easy: <n>, medium: <n>, hard: <n> }
```

# Workflow

## Step 1 — Allocate types
Split `count` across question types per `format` (or a sensible mix for `mixed`).

## Step 2 — Distribute difficulty
Spread difficulty per the request (or a fair curve for `mixed`).

## Step 3 — Map coverage
Assign each slot a subtopic so the quiz covers the topic breadth for the `audience`.

## Step 4 — Return
Return `quiz_blueprint`. Stop.

# Rules

- Plan structure only; never write actual questions or answers.
- Total slots must equal `count`; difficulty spread must sum to `count`.
- Spread subtopics so the quiz isn't lopsided.
- Match difficulty and framing to the stated `audience`.

# Examples

Input:

```yaml
quiz_request: { topic: "세계 지리", count: 3, format: multiple-choice, difficulty: medium, audience: 일반 }
```

Output:

```yaml
quiz_blueprint:
  slots:
    - { id: Q1, type: multiple-choice, difficulty: medium, subtopic: 수도 }
    - { id: Q2, type: multiple-choice, difficulty: medium, subtopic: 대륙 }
    - { id: Q3, type: multiple-choice, difficulty: medium, subtopic: 지형 }
  coverage: [수도, 대륙, 지형]
  difficulty_spread: { easy: 0, medium: 3, hard: 0 }
```
