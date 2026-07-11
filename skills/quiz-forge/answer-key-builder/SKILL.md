---
name: answer-key-builder
description: Assemble the answer key with the correct answer and a concise explanation for each question. Key stage of the quiz-forge pipeline.
version: 1.0.0
category: quiz-forge
tags:
  - quiz-forge
  - answer-key
  - explanation
model: inherit
invokes: []
inputs:
  - questions
  - choice_sets
  - options
outputs:
  - answer_key
---

# Goal

Produce the answer key: the correct answer for each question plus a short explanation that
justifies it (and, for MCQ, why the common distractor is wrong). This skill compiles the key;
it does not write or alter questions.

# Inputs

```yaml
questions: [ { id, prompt, correct, type } ]
choice_sets: [ { id, choices, correct_index } ]   # for MCQ
options:
  language: ko
```

# Output

```yaml
answer_key:
  - id: <question id>
    answer: <correct answer or index>
    explanation: <why it's correct>
```

# Workflow

## Step 1 — Resolve answers
Take each question's `correct` (and `correct_index` for MCQ) as the answer.

## Step 2 — Explain
Write a concise, factual explanation for each; note the tempting distractor when relevant.

## Step 3 — Return
Return `answer_key`. Stop.

# Rules

- Compile only; never change prompts, choices, or the correct answer.
- Explanations must be factually accurate and concise.
- Keep the key consistent with the choice sets (index matches the correct option).
- Do not judge overall fairness (that is `quiz-fairness-validator`).

# Examples

Input:

```yaml
questions: [ { id: Q1, prompt: "호주의 수도는?", correct: "캔버라", type: multiple-choice } ]
choice_sets: [ { id: Q1, choices: ["시드니","캔버라","멜버른","퍼스"], correct_index: 1 } ]
options: { language: ko }
```

Output:

```yaml
answer_key:
  - { id: Q1, answer: "캔버라 (index 1)", explanation: "캔버라가 호주 수도. 시드니는 최대 도시일 뿐 수도가 아니다." }
```
