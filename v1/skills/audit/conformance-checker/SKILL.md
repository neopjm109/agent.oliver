---
name: conformance-checker
description: Evaluate each rule against the extracted clauses and return a conformance status (compliant, non-compliant, partial, not-applicable) with cited evidence. Core evaluation stage of the audit pipeline.
version: 1.0.0
category: audit
tags:
  - audit
  - conformance
  - evaluation
model: inherit
invokes: []
inputs:
  - rules
  - clauses
  - options
outputs:
  - conformance_results
---

# Goal

Decide, for every rule, whether the target document satisfies it, citing the clause(s)
that constitute evidence (or noting their absence). This is the evaluation stage; it does
not analyze remediation or score risk.

# Scope

- Match each rule to supporting/contradicting clauses.
- Classify: `compliant | non-compliant | partial | not-applicable`.
- Cite clause IDs as evidence for every verdict.

Out of scope: gap remediation (gap-analyzer), risk scoring (risk-scorer).

# Inputs

```yaml
rules: [ { id, text, severity, applies_when }, ... ]     # from ruleset-loader
clauses: [ { id, text, location, topic }, ... ]          # from clause-extractor
options:
  strictness: normal   # normal | strict (partial counts as non-compliant when strict)
```

# Checks

For each rule:
1. Determine applicability from `applies_when`; if not applicable → `not-applicable`.
2. Find clauses that satisfy or contradict the rule.
3. Fully satisfied → `compliant`; contradicted or absent → `non-compliant`; partially
   addressed → `partial` (→ `non-compliant` under `strict`).

# Output Schema

```yaml
conformance_results:
  - rule_id: <id>
    status: compliant | non-compliant | partial | not-applicable
    evidence: [<clause id>, ...]     # [] only when non-compliant by absence
    note: <why this status>
```

# Rules

- Every verdict must cite clause evidence or explicitly state "no clause addresses this".
- Do not infer compliance from absence; missing coverage is `non-compliant`, not compliant.
- Do not describe fixes or assign risk — downstream stages own those.
- Deterministic mapping: same rules + clauses + strictness → same verdicts.

# Examples

Input:

```yaml
rules:
  - { id: RULE-retention-notice, text: "Notify the data subject of the retention period.", severity: high, applies_when: always }
  - { id: RULE-destroy-after-purpose, text: "Destroy data without delay after the purpose is achieved.", severity: high, applies_when: always }
clauses:
  - { id: C-001, text: "Collected data is retained for 5 years.", topic: retention }
options: { strictness: normal }
```

Output:

```yaml
conformance_results:
  - { rule_id: RULE-retention-notice, status: partial, evidence: [C-001], note: "States a period but does not confirm the subject is notified." }
  - { rule_id: RULE-destroy-after-purpose, status: non-compliant, evidence: [], note: "No clause addresses destruction after purpose." }
```
