---
name: audit-report-generator
description: Assemble the final compliance audit report from conformance results and scored gaps, including verdict, summary, findings table, and statistics. Final stage of the audit pipeline.
version: 1.0.0
category: audit
tags:
  - audit
  - report
  - synthesis
  - final-output
model: inherit
invokes: []
inputs:
  - conformance_results
  - scored_gaps
  - audit_request
  - options
outputs:
  - audit_report
---

# Goal

Produce the final, human-readable audit report from upstream results. This skill only
assembles and formats provided data; it does not re-check conformance, re-score risk, or
add findings.

# Inputs

```yaml
conformance_results: [ { rule_id, status, evidence, note }, ... ]
scored_gaps: [ { rule_id, gap, remediation, severity, likelihood, risk, rationale }, ... ]
audit_request: { subject, audit_type }
options:
  language: ko
  output_format: markdown
  min_report_severity: low   # filter findings below this risk out of the detail table
```

# Output

```yaml
audit_report:
  subject: <subject>
  verdict: pass | fail
  summary: <one paragraph>
  findings:
    - { rule_id, status, risk, gap, remediation, evidence }
  stats: { rules, compliant, non_compliant, partial, na }
```

# Workflow

## Step 1 — Compute stats
Count conformance statuses.

## Step 2 — Determine verdict
`fail` if any scored gap's risk is at or above `min_report_severity`; otherwise `pass`. This
matches the rule the orchestrator declares and `audit-validator` enforces. (`min_report_severity`
also filters the Step-3 detail table — see Step 3.)

## Step 3 — Build findings
Merge conformance results with scored gaps into a findings list; apply
`min_report_severity` to the detail table (but always count all in stats).

## Step 4 — Write summary
One neutral paragraph stating the overall result and the top risks.

## Step 5 — Return
Return the `audit_report`. Stop.

# Rules

- Only assemble provided data; never re-evaluate, re-score, or invent findings.
- Verdict logic is deterministic and must match the orchestrator's stated rule.
- Stats count all results even when the detail table is filtered; state the filter applied.
- Neutral tone; no recommendations beyond the remediations already provided.

# Examples

Input:

```yaml
conformance_results:
  - { rule_id: RULE-retention-notice, status: partial, evidence: [C-001], note: "Period stated, notification unconfirmed." }
  - { rule_id: RULE-destroy-after-purpose, status: non-compliant, evidence: [], note: "No destruction clause." }
scored_gaps:
  - { rule_id: RULE-destroy-after-purpose, gap: "파기 절차 부재", remediation: "목적 종료 후 파기 시한·방법 조항 추가", severity: high, likelihood: high, risk: high, rationale: "No procedure." }
  - { rule_id: RULE-retention-notice, gap: "보존기간 고지 모호", remediation: "고지 문구에 구체적 보존기간 명시", severity: high, likelihood: medium, risk: medium, rationale: "Ambiguous notice." }
audit_request: { subject: "Personal Data Handling Policy v3", audit_type: regulatory }
options: { language: ko, min_report_severity: medium }
```

Output:

```yaml
audit_report:
  subject: "Personal Data Handling Policy v3"
  verdict: fail
  summary: "정책은 검토 규칙 중 일부만 충족하며, 파기 절차 부재(고위험)와 보관기간 고지 모호(중위험)가 확인됨."
  findings:
    - { rule_id: RULE-destroy-after-purpose, status: non-compliant, risk: high, gap: "파기 절차 부재", remediation: "목적 종료 후 파기 시한·방법 조항 추가", evidence: [] }
    - { rule_id: RULE-retention-notice, status: partial, risk: medium, gap: "보존기간 고지 모호", remediation: "고지 문구에 구체적 보존기간 명시", evidence: [C-001] }
  stats: { rules: 2, compliant: 0, non_compliant: 1, partial: 1, na: 0 }
```
