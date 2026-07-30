---
name: data-remediation-orchestrator
description: Closes the data validation feedback loop — maps a domain validator's violations (seed-data / localization / knowledge-base / data-analysis / audit) to the smallest safe fix, applies it via data-change (surgical) or the domain orchestrator (full regen), re-validates, and repeats until the artifact passes or the remediation budget is exhausted. The data-domain analog of remediation-orchestrator.
version: 1.0.0
category: data-change
tags:
  - orchestrator
  - data-change
  - remediation
  - feedback-loop
  - self-healing
model: inherit
invokes:
  - data-change-orchestrator
  - seed-data-orchestrator
  - localization-orchestrator
  - knowledge-base-orchestrator
  - data-analysis-orchestrator
  - audit-orchestrator
inputs:
  - data_validation_report
  - existing_artifact
  - source
  - max_remediation_iterations
outputs:
  - data_remediation_result
---

# Goal

Turn a failing data validation into a closed self-healing loop. When a domain validator
reports violations, map each one to the responsible item, fix it with the smallest safe
action, and re-validate — repeating until the artifact passes or the budget is exhausted.
This skill **never edits data directly**; for each violation it picks the cheaper repair: a
**surgical change** via `data-change-orchestrator` (upsert a missing item, re-link/drop an
orphan) or a **full re-generation** via the domain orchestrator (artifact broadly broken).
It is the data-domain counterpart of `remediation-orchestrator`, which does the same for code.

# Inputs

```yaml
data_validation_report:          # output of any domain validator
  domain: seed-data              # seed-data | localization | knowledge-base | data-analysis | audit
  result: fail
  violations: [...]              # e.g. dangling FK, missing key, uncited entry, unsourced finding
existing_artifact: <the current seed_bundle | localization_bundle | knowledge_base | analysis_report>
source: <the source input, needed only for a full-regen fallback>
max_remediation_iterations: 2
```

# Output

```yaml
data_remediation_result:
  final_status: passed | unresolved
  iterations_used: 1
  remediated_items: [...]
  unresolved_violations: [...]   # promoted when the budget is exhausted
  remediation_log: [...]
```

# Workflow

## Step 1 — Check entry condition
If `data_validation_report.result == pass`, skip entirely and return `final_status: passed`,
`iterations_used: 0`.

## Step 2 — Map violations to fix actions
For each violation, resolve the responsible item and the operation that repairs it:
- **seed-data** — dangling FK → re-link to a surviving parent (modify) or drop the orphan
  (delete); constraint/uniqueness breach → modify; count shortfall → modify (add rows).
- **localization** — missing key → modify (translate it); placeholder mismatch / untranslated
  → modify (fix entry); orphan key → delete.
- **knowledge-base** — dangling citation → re-source the entry (modify) or drop it (delete);
  duplicate/conflicting term → modify; missing requested artifact → regen that artifact.
- **data-analysis** — unsourced finding → re-derive (modify) or drop (delete); chart on a
  missing column → modify/delete; numeric mismatch → modify (recompute).
- **audit** — uncovered rule → modify (check it); orphan finding → delete; stats/verdict
  mismatch → modify (recompute); missing gap/risk → modify.
Violations that trace to a source/requirement gap (data the input never contained) are
`unmappable` — promote, do not retry.

## Step 3 — Repair (pick the cheaper action)
- **Surgical** — the artifact is substantially valid and violations are localized. Invoke
  `data-change-orchestrator` with a `data_change_request` (operation from Step 2, target =
  the faulty item). Preferred whenever the artifact is mostly correct.
- **Full re-generation** — violations are pervasive or structural. Invoke the domain
  orchestrator (`seed-data-orchestrator` / `localization-orchestrator` /
  `knowledge-base-orchestrator` / `data-analysis-orchestrator` / `audit-orchestrator`) against `source`.
Preserve all unaffected items either way.

## Step 4 — Re-validate
Read the validation verdict returned by the repair step — both `data-change-orchestrator` and
the domain orchestrators end with the domain validator, so the fresh pass/fail is already in
their output.

## Step 5 — Loop or exit
`pass` → exit `final_status: passed`. Else if `iterations >= max_remediation_iterations` →
exit `unresolved`. Else increment and return to Step 2 with the remaining violations.

## Step 6 — Promote unresolved
On exit with `unresolved`, collect remaining violations plus `unmappable` ones into
`unresolved_violations` for a human to resolve.

# Rules

- Never edit data directly; only re-invoke `data-change-orchestrator` and the domain orchestrators.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Prefer a surgical `data-change` fix over full re-generation when the artifact is substantially
  valid; fall back to the domain orchestrator only when violations are pervasive or structural.
- Never loop more than `max_remediation_iterations` times.
- Each iteration must reduce the violation set; if it does not, exit as `unresolved`.
- Never retry violations caused by a source/requirement gap — promote them instead.
- Every iteration ends on a domain-validator verdict; complete only when it returns `pass`,
  or the budget is exhausted with unresolved violations promoted and a log recorded.
- Boundary: this heals **data** artifacts. Code validation failures go to `remediation-orchestrator`.

# Examples

Input:

```yaml
data_validation_report:
  domain: seed-data
  result: fail
  violations:
    - { entity: Order, field: user_id, issue: "FK references missing User id 9", count: 1 }
    - { entity: User, issue: "count 49, requested 50", count: 1 }
max_remediation_iterations: 2
```

Output (abridged):

```
iteration 1:
  map    → {Order.user_id orphan → delete/re-point}, {User short by 1 → modify(add row)}
  repair → surgical (data-change-orchestrator)
           ├ data-remover  → re-point Order.user_id to a surviving User
           └ data-modifier → generate 1 User row (seed 42), relink
  re-validate → seed-data-validator: pass (0 orphan FK, count=50)
data_remediation_result: final_status=passed, iterations_used=1, remediated_items=2, unresolved_violations=[]
```
