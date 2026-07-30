---
name: quiz-fairness-validator
description: Validate the quiz for fairness and quality — single defensible answer, no ambiguity, plausible (non-trivializing) distractors, difficulty balance versus blueprint, and no answer-position bias — returning a pass/fail report. Final check of the quiz-forge pipeline.
version: 1.0.0
category: quiz-forge
tags:
  - quiz-forge
  - fairness
  - validation
model: inherit
invokes: []
inputs:
  - questions
  - choice_sets
  - answer_key
  - quiz_blueprint
outputs:
  - fairness_report
---

# Goal

Check the assembled quiz for fairness problems before use, returning a deterministic
pass/fail verdict with fixes. This validates the quiz; it does not rewrite it.

# Inputs

Validated inputs (produced upstream): `questions`, `choice_sets`, `answer_key`, `quiz_blueprint`.

# Scope

- Single-answer integrity (exactly one defensible correct option/answer)
- Ambiguity (prompts are clear and unambiguous)
- Distractor plausibility (wrong options are same-category, plausible, non-trivializing)
- Difficulty balance (matches the blueprint's spread)
- Position bias (correct MCQ answers not clustered in one position)

Out of scope: subjective "interestingness", niche factual disputes.

# Checks

1. Each question has exactly one defensible correct answer (no second-correct distractor).
2. No prompt is ambiguous or answerable multiple ways.
3. Distractors are plausible: each wrong option is of the same category/type as the correct
   answer (e.g. a real city for a capital question) and could believably tempt someone who does
   not know the fact. An absurd/off-category distractor (e.g. "달나라"/"바나나" for a capital
   question) trivializes the item — it shrinks the effective answer space and telegraphs the
   correct option — so a question with one or more implausible distractors is a fairness failure.
   (Threshold: flag only clearly off-category/absurd options, not merely "easier" plausible ones.)
4. Difficulty distribution matches `quiz_blueprint.difficulty_spread`.
5. Correct-answer positions are reasonably spread across MCQ items.

# Pass/Fail Criteria

- **pass**: all checks succeed.
- **fail**: any multi-answer/ambiguous item, implausible/trivializing distractor, difficulty
  mismatch, or strong position bias.

# Output Schema

```yaml
fairness_report:
  result: pass | fail
  issues:
    - { id: <question id or "-">, area: single-answer | ambiguity | distractor-plausibility | difficulty | position-bias, detail: <what>, fix: <suggestion> }
  stats: { questions: <n>, issues: <n> }
```

# Rules

- Report issues and fixes only; never rewrite questions or the key.
- Deterministic verdict: any multi-answer, ambiguous, or implausibly-distracted item forces `fail`.
- Judge difficulty against the blueprint, not assumptions.
- Judge distractor plausibility by category/type match, not taste — flag clearly absurd or
  off-category options, not options that are merely a bit easier to rule out.
- Do not assess subjective quality; only the checkable properties above.

# Examples

Input:

```yaml
questions: [ { id: Q1, prompt: "호주에서 큰 도시는?" } ]   # 모호: 여러 답 가능
choice_sets: [ { id: Q1, choices: ["시드니","멜버른","브리즈번","퍼스"], correct_index: 0 } ]
quiz_blueprint: { difficulty_spread: { medium: 1 } }
```

Output:

```yaml
fairness_report:
  result: fail
  issues:
    - { id: Q1, area: single-answer, detail: "'큰 도시'는 다수 정답 가능(시드니/멜버른)", fix: "'가장 인구가 많은 도시'로 한정" }
  stats: { questions: 1, issues: 1 }
```

Distractor plausibility (check 3) — an absurd option trivializes the item:

```yaml
questions: [ { id: Q2, prompt: "호주의 수도는?" } ]
choice_sets: [ { id: Q2, choices: ["캔버라","시드니","달나라","바나나"], correct_index: 0 } ]
quiz_blueprint: { difficulty_spread: { medium: 1 } }
```

```yaml
fairness_report:
  result: fail
  issues:
    - { id: Q2, area: distractor-plausibility, detail: "'달나라'·'바나나'는 도시가 아닌 off-category 오답 — 문제를 자명하게 만듦", fix: "같은 범주의 실제 도시(멜버른/브리즈번)로 교체" }
  stats: { questions: 1, issues: 1 }
```
