---
name: distractor-designer
description: Create plausible but clearly incorrect answer options (distractors) for multiple-choice questions, calibrated to difficulty so the correct answer is the only defensible one. Distractor stage of the quiz-forge pipeline.
version: 1.0.0
category: quiz-forge
tags:
  - quiz-forge
  - distractor
  - multiple-choice
model: inherit
invokes: []
inputs:
  - questions
  - options
outputs:
  - choice_sets
---

# Goal

For each multiple-choice question, produce distractors that are plausible enough to test
knowledge but unambiguously wrong, so exactly one option is correct. This skill designs
options; it does not write prompts or explanations.

# Inputs

```yaml
questions: [ { id, type, prompt, correct, difficulty } ]
options:
  choices_per_q: 4
```

# Output

```yaml
choice_sets:
  - id: <question id>
    choices: [<correct + distractors, shuffled>]
    correct_index: <n>
```

# Workflow

## Step 1 — Generate distractors
Create `choices_per_q - 1` wrong options that are topically related and plausible.

## Step 2 — Guard uniqueness
Ensure no distractor is arguably also correct; harder questions get subtler distractors.

## Step 3 — Assemble & mark
Place the correct answer among distractors, shuffle, and record `correct_index`.

## Step 4 — Return
Return `choice_sets`. Stop.

# Rules

- Only for multiple-choice items; skip others.
- Distractors must be clearly incorrect — never include a second defensible answer.
- Keep options parallel in form/length so the answer isn't guessable by shape.
- Calibrate plausibility to difficulty.

# Examples

Input:

```yaml
questions: [ { id: Q1, type: multiple-choice, prompt: "호주의 수도는?", correct: "캔버라", difficulty: medium } ]
options: { choices_per_q: 4 }
```

Output:

```yaml
choice_sets:
  - id: Q1
    choices: ["시드니", "캔버라", "멜버른", "퍼스"]
    correct_index: 1
```
