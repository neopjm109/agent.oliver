---
name: quiz-forge
description: Short entry point for the quiz-forge category. Coordinate the end-to-end quiz-building pipeline that turns a topic and difficulty into a complete quiz — structured blueprint, questions, distractors, and an answer key — validated for fairness. Use for trivia/quizzes, not code. Entrypoint of the quiz-forge domain. Invoke as '/quiz-forge'; delegates to quiz-forge-orchestrator.
version: 1.0.0
category: quiz-forge
tags:
  - quiz-forge
  - entrypoint
model: inherit
invokes:
  - quiz-forge-orchestrator
---

# Goal

This is the **short entry point for the `quiz-forge` category**. Start here, but let
`quiz-forge-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `quiz-forge-orchestrator` needs.
2. Run `quiz-forge-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
