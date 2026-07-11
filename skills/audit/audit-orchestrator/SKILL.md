---
name: audit-orchestrator
description: Coordinate the end-to-end document-compliance audit pipeline that checks a target document against a ruleset (policy, regulation, standard, or checklist) and produces a conformance gap report with risk scoring. Use when the goal is assessing a document's compliance, not generating code. Entrypoint of the audit domain.
version: 1.0.0
category: audit
tags:
  - audit
  - orchestrator
  - compliance
  - pipeline
  - entrypoint
model: inherit
invokes:
  - docs-analyze-docx
  - docs-analyze-pptx
  - docs-analyze-xlsx
  - docs-analyze-markdown
  - docs-analyze-pdf
  - ruleset-loader
  - clause-extractor
  - conformance-checker
  - gap-analyzer
  - risk-scorer
  - audit-report-generator
  - audit-validator
inputs:
  - audit_request
  - target_documents
  - ruleset
  - options
outputs:
  - audit_report
---

# Goal

Produce a document-compliance audit report by orchestrating specialized audit skills.
This skill **never evaluates conformance directly** — it loads the ruleset, ingests the
target document, sequences the pipeline, delegates each stage, and returns the assembled
report. It assesses documents against rules; it never generates code and never edits the
target document.

# Inputs

```yaml
audit_request:
  subject: "Personal Data Handling Policy v3"
  audit_type: regulatory        # regulatory | internal-policy | standard | checklist
target_documents: [policy-v3.docx]
ruleset:
  source: pipa-2024.pdf         # a document, or inline rules below
  inline_rules: []              # optional pre-structured rules
options:
  language: ko                  # optional
  output_format: markdown       # optional
  min_report_severity: low      # optional filter for the report
```

# Output

```yaml
audit_report:
  subject: <audited subject>
  verdict: pass | fail          # fail if any gap's risk is at/above min_report_severity
  summary: <one-paragraph result>
  findings: [ { rule_id, status, evidence, gap, risk }, ... ]
  stats: { rules: <n>, compliant: <n>, non_compliant: <n>, partial: <n>, na: <n> }
  validation: <pass/fail + violations from audit-validator>
```

# Workflow

## Step 1 — Analyze the request
Determine `audit_type`, the target document(s), and the ruleset source.

## Step 2 — Ingest inputs
For each target document (and the ruleset if it is a document), invoke the matching
`docs-analyze-*` skill by extension. Merge extracted material.

## Step 3 — Load the ruleset
Invoke `ruleset-loader` to normalize the ruleset into structured, individually-checkable
rules.

## Step 4 — Extract clauses
Invoke `clause-extractor` to pull the target document's statements/clauses into a
referenceable form.

## Step 5 — Check conformance
Invoke `conformance-checker` to evaluate each rule against the extracted clauses, producing
`compliant | non-compliant | partial | not-applicable` with evidence.

## Step 6 — Analyze gaps
Invoke `gap-analyzer` on non-compliant and partial results to describe each gap and its
remediation.

## Step 7 — Score risk
Invoke `risk-scorer` to assign a risk level to each gap.

## Step 8 — Assemble report
Invoke `audit-report-generator` to produce the final `audit_report`, applying
`min_report_severity`.

## Step 9 — Validate integrity
Invoke `audit-validator` to verify report integrity (rule coverage, finding traceability,
gap/risk completeness, stats reconciliation, verdict consistency) — pass/fail. The pipeline
ends here.

# Rules

- This skill only coordinates. Delegate every stage; never load rules, extract clauses,
  check conformance, analyze gaps, or score risk directly.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Never edit or "fix" the target document — this pipeline only assesses.
- Never generate runtime code.
- Every finding must cite evidence traceable to an extracted clause or its absence; never
  assert non-compliance without a rule reference.
- The verdict is deterministic and computed by `audit-report-generator`: `fail` if any
  gap's scored risk is at or above `min_report_severity`; otherwise `pass`.
- Error handling: if a `docs-analyze-*` skill fails, continue with remaining inputs and
  note the gap. If a downstream skill fails, return the partial report and mark the
  incomplete stage.

# Examples

Input:

```yaml
audit_request: { subject: "Personal Data Handling Policy v3", audit_type: regulatory }
target_documents: [policy-v3.docx]
ruleset: { source: pipa-2024.pdf }
options: { language: ko, min_report_severity: medium }
```

Output (abridged):

```
✔ ingest      → policy-v3.docx (34 clauses), pipa-2024.pdf
✔ ruleset     → 21 rules loaded
✔ clauses     → 34 clauses extracted
✔ conformance → 15 compliant · 3 non-compliant · 2 partial · 1 n/a
✔ gaps        → 5 gaps described
✔ risk        → 2 high · 3 medium
✔ report      → verdict: FAIL (2 high-risk gaps)

Summary: 정책 문서는 21개 규칙 중 15개를 충족하나, 보관기간 고지와 파기 절차에서 고위험 갭 2건 존재.
```
