---
name: audit-validator
description: Validate an assembled audit report for internal integrity — every finding references a real rule and cites evidence, every ruleset rule is covered, gaps carry a risk score, stats reconcile with findings, and the verdict matches the min-severity rule — returning a deterministic pass/fail report. Final integrity gate of the audit pipeline (distinct from the compliance verdict it checks).
version: 1.0.0
category: audit
tags:
  - audit
  - validation
  - integrity
  - final-output
model: inherit
invokes: []
inputs:
  - audit_report
  - rules
  - audit_request
outputs:
  - validation_result
---

# Goal

Verify that an audit report is complete and internally consistent before it is delivered,
returning a deterministic pass/fail verdict with specific violations. This validates the
report's **integrity** against the loaded ruleset — not the correctness of the compliance
judgment itself (legal/policy interpretation is out of scope). It is the audit analog of
`data-analysis-validator`: it checks traceability and reconciliation, not truth.

# Scope

- Rule coverage (every rule in the ruleset has a finding; none skipped)
- Finding traceability (every finding references a real rule and cites evidence/clause)
- Gap completeness (every non-compliant/partial finding carries a gap and a risk score)
- Stats reconciliation (compliant/non_compliant/partial/na counts match the findings)
- Verdict consistency (verdict is `fail` iff some gap's risk ≥ `min_report_severity`)

Out of scope: correctness of the compliance judgment, legal interpretation, ruleset quality,
edits to the audited document.

# Checks

1. Every rule in `rules` has exactly one finding in `audit_report.findings` (no unchecked rule).
2. Every finding's `rule_id` exists in `rules`; non-`na` findings cite evidence.
3. Every `non_compliant`/`partial` finding has a `gap` and a `risk` score.
4. `stats` counts equal the tallied finding statuses.
5. `verdict` is `fail` if and only if at least one gap's risk ≥ `min_report_severity`.

# Pass/Fail Criteria

- **pass**: all checks succeed.
- **fail**: any uncovered rule, orphan finding, missing gap/risk, stats mismatch, or verdict
  inconsistent with the findings.

# Output Schema

```yaml
validation_result:
  result: pass | fail
  violations:
    - { area: coverage | traceability | gap | stats | verdict, ref: <rule_id/field>, issue: <what failed> }
  stats: { rules: <n>, uncovered: <n>, orphan_findings: <n>, missing_risk: <n> }
```

# Rules

- Report violations only; never modify the audit report.
- Deterministic verdict: any single violation forces `fail`.
- Check findings against the loaded `rules`, not against outside knowledge.
- Do not re-judge conformance or interpret the rules — only integrity and reconciliation.

# Examples

Input:

```yaml
audit_report:
  verdict: pass                                   # inconsistent: a high-risk gap exists
  findings:
    - { rule_id: R1, status: compliant, evidence: "§2.1" }
    - { rule_id: R2, status: non_compliant, gap: "no retention limit", risk: high }
  stats: { rules: 3, compliant: 1, non_compliant: 1, partial: 0, na: 0 }   # R3 missing
rules: [R1, R2, R3]
audit_request: { options: { min_report_severity: low } }
```

Output:

```yaml
validation_result:
  result: fail
  violations:
    - { area: coverage, ref: R3, issue: "rule has no finding (unchecked)" }
    - { area: stats, ref: rules, issue: "stats total 2 findings but ruleset has 3 rules" }
    - { area: verdict, ref: verdict, issue: "verdict pass but a high-risk gap exists (min_report_severity=low)" }
  stats: { rules: 3, uncovered: 1, orphan_findings: 0, missing_risk: 0 }
```
