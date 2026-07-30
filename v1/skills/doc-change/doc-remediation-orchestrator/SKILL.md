---
name: doc-remediation-orchestrator
description: Closes the document style feedback loop — maps doc-style-checker fixes (terminology, tone, headings, open TODOs, dangling cross-references) to the smallest safe action, applies it via doc-change (surgical section revision) or docwriting-orchestrator (full re-author), re-checks, and repeats until the document passes or the budget is exhausted. The document analog of remediation-orchestrator.
version: 1.0.0
category: doc-change
tags:
  - orchestrator
  - doc-change
  - remediation
  - feedback-loop
  - self-healing
model: inherit
invokes:
  - doc-change-orchestrator
  - docwriting-orchestrator
  - proposal-orchestrator
inputs:
  - doc_validation_report
  - existing_document
  - doc_domain
  - source
  - max_remediation_iterations
outputs:
  - doc_remediation_result
---

# Goal

Turn a failing document style check into a closed self-healing loop. When `doc-style-checker`
reports fixes, map each to the responsible section, apply the smallest safe correction, and
re-check — repeating until the document passes or the budget is exhausted. This skill **never
edits documents directly**; for each fix it picks the cheaper repair: a **surgical section
revision** via `doc-change-orchestrator` (a localized terminology/tone/TODO fix) or a **full
re-author** via `docwriting-orchestrator` (the document is pervasively off-style). It is the
document counterpart of `remediation-orchestrator` (code) and `data-remediation-orchestrator`
(data).

# Inputs

```yaml
doc_domain: docwriting            # docwriting | proposal
doc_validation_report:            # doc-style-checker style_report, or proposal-validator result
  result: fail
  fixes:                          # docwriting: style fixes; proposal: coverage/consistency violations
    - { section: <id>, issue: <what>, suggestion: <how>, severity: high | low }
existing_document: <the current document / proposal>
source: <the source material / RFP, needed only for a full re-author fallback>
max_remediation_iterations: 2
```

# Output

```yaml
doc_remediation_result:
  final_status: passed | unresolved
  iterations_used: 1
  remediated_sections: [...]
  unresolved_fixes: [...]         # promoted when the budget is exhausted
  remediation_log: [...]
```

# Workflow

## Step 1 — Check entry condition
If `doc_validation_report.result == pass`, skip entirely and return `final_status: passed`,
`iterations_used: 0`.

## Step 2 — Map fixes to actions
Group `fixes` by section and choose the operation:
- terminology / tone / readability / open TODO in a section → **modify** that section.
- a dangling cross-reference / orphan TOC entry left by a removed section → **delete** cleanup.
- a section fundamentally off-brief (not just wording) → **regen** via full re-author.
Fixes that require content the `source` never provided are `unmappable` — promote, do not retry.

## Step 3 — Repair (pick the cheaper action)
- **Surgical** — localized fixes on a mostly-correct document. Invoke `doc-change-orchestrator`
  with a `doc_change_request` (operation from Step 2, target = the flagged section). Preferred.
- **Full re-author** — pervasive failure across many sections. Invoke the domain's generator
  against `source`: `docwriting-orchestrator` (docwriting) or `proposal-orchestrator` (proposal).
Preserve all passing sections either way.

## Step 4 — Re-check
Read the verdict returned by the repair step — `doc-change-orchestrator`,
`docwriting-orchestrator`, and `proposal-orchestrator` all end with their domain gate
(`doc-style-checker`, and `proposal-validator` for proposals), so the fresh pass/fail is
already in their output.

## Step 5 — Loop or exit
`pass` → exit `final_status: passed`. Else if `iterations >= max_remediation_iterations` →
exit `unresolved`. Else increment and return to Step 2 with the remaining fixes.

## Step 6 — Promote unresolved
On exit with `unresolved`, collect remaining fixes plus `unmappable` ones into
`unresolved_fixes` for a human to resolve.

# Rules

- Never edit documents directly; only re-invoke `doc-change-orchestrator`, `docwriting-orchestrator`, and `proposal-orchestrator`.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Prefer a surgical `doc-change` revision over full re-author when the document is substantially
  on-style; fall back to `docwriting-orchestrator` only when failures are pervasive.
- Never loop more than `max_remediation_iterations` times.
- Each iteration must reduce the fix set; if it does not, exit as `unresolved`.
- Never retry fixes that need content the source lacks — promote them instead.
- Every iteration ends on a `doc-style-checker` verdict; complete only when it returns `pass`,
  or the budget is exhausted with unresolved fixes promoted and a log recorded.
- Boundary: this heals **prose documents**. Code → `remediation-orchestrator`; data → `data-remediation-orchestrator`.

# Examples

Input:

```yaml
doc_validation_report:
  result: fail
  fixes:
    - { section: register-card, issue: "uses 'log-in' not 'sign in'", suggestion: "replace", severity: high }
    - { section: checkout, issue: "open TODO: pricing table", suggestion: "fill from source", severity: high }
max_remediation_iterations: 2
```

Output (abridged):

```
iteration 1:
  map    → {register-card: terminology → modify}, {checkout: open TODO → modify}
  repair → surgical (doc-change-orchestrator → doc-modifier on 2 sections)
  re-check → doc-style-checker: pass (0 terminology violations, 0 open TODO)
doc_remediation_result: final_status=passed, iterations_used=1, remediated_sections=2, unresolved_fixes=[]
```
