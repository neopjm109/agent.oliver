---
name: quiz-forge-orchestrator
description: Coordinate the end-to-end quiz-building pipeline that turns a topic and difficulty into a complete quiz — structured blueprint, questions, distractors, and an answer key — validated for fairness. Use for trivia/quizzes, not code. Entrypoint of the quiz-forge domain.
version: 1.0.0
category: quiz-forge
tags:
  - quiz-forge
  - orchestrator
  - quiz
  - trivia
  - pipeline
  - entrypoint
model: inherit
invokes:
  - quiz-blueprint-planner
  - question-generator
  - distractor-designer
  - answer-key-builder
  - quiz-fairness-validator
inputs:
  - quiz_request
  - options
outputs:
  - quiz
---

# Goal

Produce a complete, fair quiz by orchestrating specialized quiz-forge skills. This skill
**never writes questions directly** — it plans the blueprint, delegates question and
distractor creation, builds the answer key, validates fairness, and returns the quiz. Text
content only, no code.

# Inputs

```yaml
quiz_request:
  topic: "세계 지리"
  count: 10
  format: multiple-choice   # multiple-choice | true-false | short-answer | mixed
  difficulty: medium        # easy | medium | hard | mixed
  audience: 일반
options:
  language: ko
```

# Output

```yaml
quiz:
  questions: [ { id, prompt, choices?, difficulty, topic_tag } ]
  answer_key: [ { id, answer, explanation } ]
  fairness: <pass/fail report>
```

# Workflow

## Step 1 — Blueprint
Invoke `quiz-blueprint-planner` to plan question count, type mix, difficulty spread, and
topic coverage.

## Step 2 — Questions
Invoke `question-generator` to write question prompts per the blueprint.

## Step 3 — Distractors (if MCQ)
Invoke `distractor-designer` to create plausible wrong options for multiple-choice items.

## Step 4 — Answer key
Invoke `answer-key-builder` for correct answers and explanations.

## Step 5 — Validate fairness
Invoke `quiz-fairness-validator`; if it fails, return flagged items to the responsible skill
once, then re-check.

## Step 6 — Return
Return `quiz`. The pipeline ends here.

# Rules

- This skill only coordinates. Delegate every stage; never write questions, distractors, or
  the key directly.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Every question must have exactly one defensible correct answer (validated downstream).
- Never generate code; this domain produces quiz content.
- Error handling: if a stage fails, return the partial quiz and mark the incomplete stage.

# Examples

Input:

```yaml
quiz_request: { topic: "세계 지리", count: 3, format: multiple-choice, difficulty: medium, audience: 일반 }
options: { language: ko }
```

Output (abridged):

```
✔ blueprint → 3문항, MCQ, medium, 대륙/수도/지형 커버
✔ questions → 3
✔ distractors → 각 3 오답
✔ key       → 정답+해설
✔ fairness  → pass (단일 정답, 난이도 균형)

Quiz: 세계 지리 3문항 (MCQ) — 게임나잇 준비 완료.
```
