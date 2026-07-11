---
name: code-review-orchestrator
description: Reviews an actual code change (a diff, a set of files, or a module) for real defects — correctness bugs, security/perf footguns, maintainability, and weak tests — by detecting the languages present and delegating to the matching language reviewer (typescript / spring / nestjs / django / flutter), then aggregating severity-ranked findings into a single review report with a verdict. Read-only; never edits code. Use to review code that already exists, NOT to summarize a whole generation run (that is orchestrator/review-orchestrator) and NOT to check blueprint conformance (that is validation-orchestrator).
version: 1.0.0
category: review
tags:
  - review
  - code-review
  - orchestrator
  - quality
  - multi-language
model: inherit
invokes:
  - typescript-code-reviewer
  - spring-code-reviewer
  - nestjs-code-reviewer
  - django-code-reviewer
  - flutter-code-reviewer
inputs:
  - review_target
  - target_stack
outputs:
  - code_review_report
---

# Goal

Review real source code for defects the way a senior engineer reviews a pull request:
find correctness bugs, security and performance footguns, error-handling gaps, and
maintainability problems, and rank them by severity. This skill **only analyzes** — it
never edits code. It classifies which languages are present in the change, delegates each
to that language's reviewer, and merges the findings into one `code_review_report` with a
verdict.

## How this differs from the neighbours

- **`validation-orchestrator` / `*-validator`** — check that *generated* code matches the
  blueprint (structural completeness, layer boundaries, API↔DTO shape). That is *conformance*.
  This skill reviews the code itself for defects, with or without a blueprint.
- **`orchestrator/review-orchestrator`** — writes the *final project summary* of a whole
  generation run from a precomputed `validation_report`. That is a *report*, not a review.
- This skill is the counterpart of `code-change-orchestrator`: that one *changes* existing
  code; this one *reviews* existing code.

# Inputs

```yaml
review_target:
  kind: diff | files | module        # what to review
  ref: <git range, e.g. "origin/main...HEAD">   # when kind=diff (optional)
  paths: [<file or dir paths>]       # when kind=files|module
  context: <optional free-text: what the change is supposed to do>
target_stack:                         # optional; used to pick reviewers
  backend: spring | nestjs | django
  frontend: nextjs
  clients: [mobile, desktop]          # flutter / tauri
```

If `target_stack` is absent, detect the language of each changed file by extension and
route accordingly (see Step 2). Code review must work on arbitrary code, not only pipeline
output.

# Output

```yaml
code_review_report:
  verdict: approve | approve-with-comments | request-changes
  languages: [typescript, spring, ...]
  findings:                    # merged, severity-ranked (critical first)
    - { id, severity, category, file, line, message, suggestion, reviewer }
  summary:
    critical: int
    major: int
    minor: int
    nit: int
  notes: [<what was NOT reviewed and why — e.g. "Rust shell not covered">]
```

# Workflow

## Step 1 — Resolve the change set
If `kind: diff`, obtain the changed files and hunks (e.g. `git diff --name-only <ref>` and
`git diff <ref>`). If `kind: files|module`, read the given `paths`. Establish `context`
(what the change is meant to do) so reviewers judge intent, not just syntax.

## Step 2 — Detect languages and route to reviewers
Prefer `target_stack`; otherwise map by file extension. Each reviewer owns its language's
general review too, not only its framework:

| files / stack | reviewer |
|---|---|
| `.ts .tsx .js .jsx` or `frontend: nextjs` | `typescript-code-reviewer` |
| `.java .kt` or `backend: spring` | `spring-code-reviewer` |
| NestJS backend (`.ts` under a Nest app) or `backend: nestjs` | `nestjs-code-reviewer` |
| `.py` (Django) or `backend: django` | `django-code-reviewer` |
| `.dart` or `clients: [mobile]` | `flutter-code-reviewer` |

Route each file to exactly one reviewer. A desktop/Tauri app's React UI goes to
`typescript-code-reviewer`; its Rust shell has no reviewer yet — record that in `notes`
rather than misrouting it (mirrors how `desktop-shell-validator` is scoped).

## Step 3 — Delegate
Invoke each selected reviewer with a `review_request` (`files`/`diff`, `context`, and any
`target_stack` conventions). Reviewers analyze only and return `review_findings`.

## Step 4 — Merge and rank
Concatenate all reviewers' findings. De-duplicate findings that land on the same
`file:line` with the same root cause. Sort by severity: `critical → major → minor → nit`.

## Step 5 — Decide the verdict
- **request-changes** — any `critical`, or any `major` in `correctness`/`security`.
- **approve-with-comments** — only `minor`/`nit`, or non-blocking `major` (perf/maintainability
  the author can weigh).
- **approve** — no findings.

## Step 6 — Emit the report
Assemble `code_review_report`, filling `summary` counts and `notes` (anything not reviewed).

# Rules

- Analysis only: never edit code, never open a fix. Fixes are `code-change-orchestrator` /
  `remediation-orchestrator`.
- Only `invokes` listed in frontmatter may be called; each must exist as a skill.
- Route each file to exactly one language reviewer; do not judge Kotlin with the TS reviewer, etc.
- Judge against `review_target.context` when given — a "bug" that is the intended behavior is not a finding.
- Every finding must carry `file`, `severity`, `category`, and an actionable `message`; include `line` when known.
- Never silently drop coverage: anything not reviewed (unsupported language, Rust shell, generated files) goes in `notes`.
- Deterministic verdict: apply the Step 5 rules exactly; do not soften a `critical` to a comment.
- Continue even when one reviewer finds many issues; collect everything into one report.

# Examples

Input:

```yaml
review_target:
  kind: diff
  ref: "origin/main...HEAD"
  context: "add manager approval for orders over $10k"
target_stack: { backend: spring, frontend: nextjs }
```

Output (abridged):

```
▶ resolve  → 3 files changed (OrderService.java, order-form.tsx, useOrders.ts)
▶ route    → spring-code-reviewer (1), typescript-code-reviewer (2)
✔ spring   → SPR-04 major: approval check uses `>` not `>=`, misses exactly $10,000
✔ ts       → TS-07 minor: useOrders missing error state; TS-12 nit: unused import
── code_review_report
  verdict: request-changes
  languages: [spring, typescript]
  findings:
    - { id: SPR-04, severity: major, category: correctness, file: OrderService.java, line: 88,
        message: "amount > 10_000 excludes exactly 10,000; spec says 'over $10k' — confirm boundary", reviewer: spring-code-reviewer }
    - { id: TS-07, severity: minor, category: maintainability, file: useOrders.ts, line: 24,
        message: "query has no error branch; UI cannot show failure", reviewer: typescript-code-reviewer }
    - { id: TS-12, severity: nit, category: style, file: order-form.tsx, line: 3,
        message: "unused import `useMemo`", reviewer: typescript-code-reviewer }
  summary: { critical: 0, major: 1, minor: 1, nit: 1 }
  notes: []
```
