---
name: commit-lint-validator
description: Validate commit messages and branch names against the Conventional Commits spec and the repo's branch-strategy contract — allowed types/scope, subject form, footer format, work-branch naming, and no commit authored on a protected branch — returning a deterministic pass/fail report.
version: 1.0.0
category: vcs
tags:
  - vcs
  - git
  - conventional-commits
  - validation
  - lint
model: inherit
invokes: []
inputs:
  - lint_input
outputs:
  - validation_result
---

# Goal

Verify that commit messages and branch names conform to the Conventional Commits spec and the
`branch_strategy` contract, returning a deterministic pass/fail verdict with specific violations.
This gate is read-only — it never rewrites messages, amends commits, or renames branches.

# Scope

- Commit type (each message is `type(scope): subject` with an allowed `type`)
- Subject form (imperative mood, within length limit, no trailing period)
- Footer format (traceability/`BREAKING CHANGE:` footers well-formed when present)
- Branch naming (each work branch matches `branch_strategy.work_branch_pattern`)
- Protected authorship (no commit was authored directly on a protected branch)

Out of scope: message meaning/accuracy, code correctness, repo state (see `repo-state-validator`).

# Inputs

```yaml
lint_input:
  commits:
    - { sha: a1b2, branch: feat/FEAT-ORDER, message: "feat(order): add Order aggregate\n\nRefs: FEAT-ORDER" }
    - { sha: c3d4, branch: main, message: "quick fix" }
  branch_strategy:
    work_branch_pattern: "feat/<id>"
    protected: [main, develop]
    allowed_types: [feat, fix, chore, refactor, docs, test, build, ci, perf]
```

# Checks

1. Every message matches `type(scope): subject` and `type` is in `allowed_types`.
2. Subject is imperative, within the length limit, and has no trailing period.
3. Any footers are well-formed (`Key: value`, `BREAKING CHANGE:` where applicable).
4. Every non-protected branch name matches `work_branch_pattern`.
5. No commit in the set was authored directly on a branch in `protected`.

# Pass/Fail Criteria

- **pass**: all checks succeed for every commit.
- **fail**: any non-conventional message, disallowed type, malformed subject/footer, off-pattern
  work branch, or a commit authored on a protected branch.

# Output Schema

```yaml
validation_result:
  result: pass | fail
  violations:
    - { sha: <sha>, area: type | subject | footer | branch | protected, issue: <what failed> }
  stats: { commits: <n>, conforming: <n>, on_protected: <n> }
```

# Rules

- Report violations only; never amend, reword, squash, or rename anything.
- Deterministic verdict: any single violation forces `fail`.
- Judge against Conventional Commits + the provided `branch_strategy`, not outside assumptions.

# Examples

Input:

```yaml
lint_input:
  commits:
    - { sha: a1b2, branch: feat/FEAT-ORDER, message: "feat(order): add Order aggregate" }
    - { sha: c3d4, branch: main, message: "quick fix" }
  branch_strategy: { work_branch_pattern: "feat/<id>", protected: [main, develop], allowed_types: [feat, fix, chore] }
```

Output:

```yaml
validation_result:
  result: fail
  violations:
    - { sha: c3d4, area: type, issue: "message 'quick fix' is not Conventional Commits (no type)" }
    - { sha: c3d4, area: protected, issue: "commit authored directly on protected branch 'main'" }
  stats: { commits: 2, conforming: 1, on_protected: 1 }
```
