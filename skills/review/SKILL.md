---
name: review
description: Short entry point for the review category. Reviews an actual code change (a diff, a set of files, or a module) for real defects — correctness bugs, security/perf footguns, maintainability, and weak tests — by delegating to code-review-orchestrator, which detects the languages present, routes to the matching language reviewer, and aggregates severity-ranked findings with a verdict. Invoke as '/review'. Read-only; never edits code. Distinct from a whole-generation-run summary (orchestrator/review-orchestrator) and from blueprint conformance checks (validation).
version: 1.0.0
category: review
tags:
  - review
  - code-review
  - entrypoint
model: inherit
invokes:
  - code-review-orchestrator
---

# Goal

This is the **short entry point for the `review` category**. When the user asks for a
code review (`/review [target]`, etc.), start here but let `code-review-orchestrator`
do the actual review work.

# How to run

1. Determine the review target (diff / files / module) and the target stack from the user's request.
2. Run `code-review-orchestrator` as a subagent (see the framework delegation rule) so it
   handles language detection → per-language reviewer delegation → severity-ranked aggregation.
3. Return the review report (severity-ranked findings + final verdict) to the user as-is.

Read-only — never modify the code directly.
