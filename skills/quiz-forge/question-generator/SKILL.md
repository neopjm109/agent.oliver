---
name: question-generator
description: Write clear, unambiguous question prompts for each blueprint slot at the specified difficulty and subtopic. Question stage of the quiz-forge pipeline.
version: 1.0.0
category: quiz-forge
tags:
  - quiz-forge
  - question
  - writing
model: inherit
invokes: []
inputs:
  - quiz_blueprint
  - quiz_request
  - options
outputs:
  - questions
---

# Goal

Write the question prompts the blueprint calls for — each unambiguous, factually sound, and
matched to its difficulty and subtopic. This skill writes prompts; distractors and the key
are downstream.

# Inputs

```yaml
quiz_blueprint: { slots: [ { id, type, difficulty, subtopic } ] }
quiz_request: { topic, audience }
options:
  language: ko
```

# Output

```yaml
questions:
  - id: <slot id>
    type: <type>
    prompt: <question text>
    difficulty: <level>
    topic_tag: <subtopic>
    correct: <the correct answer, for downstream key/distractors>
```

# Workflow

## Step 1 — Write per slot
For each blueprint slot, write a prompt on its subtopic at its difficulty.

## Step 2 — Ensure one clear answer
Frame each so exactly one answer is defensibly correct; record it in `correct`.

## Step 3 — Match audience/level
Tune wording and depth to the audience and difficulty.

## Step 4 — Return
Return `questions`. Stop.

# Rules

- One unambiguous correct answer per question; avoid opinion/ambiguous phrasing.
- Stay factually accurate; do not write questions you cannot answer correctly.
- Match the slot's difficulty and subtopic.
- Do not write distractors or explanations (downstream).

# Examples

Input:

```yaml
quiz_blueprint: { slots: [ { id: Q1, type: multiple-choice, difficulty: medium, subtopic: 수도 } ] }
quiz_request: { topic: "세계 지리", audience: 일반 }
options: { language: ko }
```

Output:

```yaml
questions:
  - { id: Q1, type: multiple-choice, prompt: "호주의 수도는?", difficulty: medium, topic_tag: 수도, correct: "캔버라" }
```
