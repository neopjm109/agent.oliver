---
name: doc-style-checker
description: Check drafted document prose for tone, terminology consistency, heading parallelism, and readability against a style profile, returning a pass/fail report with specific fixes. The validation stage of the docwriting pipeline (prose, not code).
version: 1.0.0
category: docwriting
tags:
  - docwriting
  - style
  - consistency
  - review
model: inherit
invokes: []
inputs:
  - drafted_sections
  - style_guide
outputs:
  - style_report
---

# Goal

Review drafted prose for style and consistency and report a verdict with concrete,
actionable fixes. This validates documents (prose), not code — code artifacts are handled
by `validator/*`.

# Scope

- Terminology consistency (one canonical term per concept)
- Tone and voice against the style profile (neutral, instructional, no marketing)
- Heading parallelism and structure
- Readability (sentence length, undefined jargon, passive overuse)
- Placeholder/TODO detection (unresolved `source needed` markers)

Out of scope: factual correctness of content, code correctness, translation.

# Inputs

```yaml
drafted_sections: [ { id, heading, body, todos }, ... ]
style_guide:
  canonical_terms: { "log-in": "sign in", "e-mail": "email" }  # optional
  tone: neutral                                                # optional
```

# Checks

1. Each concept uses its canonical term everywhere.
2. Tone matches the profile; no promotional or subjective wording.
3. Headings are parallel in grammatical form.
4. No unresolved `TODO`/placeholder remains.
5. Readability heuristics pass (no excessively long sentences, jargon is defined).

# Pass/Fail Criteria

- **pass**: no terminology violations, no unresolved TODOs, tone conforms.
- **fail**: any terminology violation, unresolved TODO, or tone breach; each becomes a
  fix entry.

# Output Schema

```yaml
style_report:
  result: pass | fail
  fixes:
    - { section: <id>, issue: <what>, suggestion: <how to fix>, severity: high|low }
  stats: { sections: <n>, violations: <n>, todos_open: <n> }
```

# Rules

- Report issues and suggestions only; do not rewrite the document (the generator applies
  fixes).
- Do not assess factual accuracy or translate — out of scope.
- Deterministic verdict: any high-severity issue forces `fail`.

# Examples

Input:

```yaml
drafted_sections:
  - { id: register-card, heading: "Registering a Card", body: "To log-in, open Settings...", todos: [] }
style_guide: { canonical_terms: { "log-in": "sign in" } }
```

Output:

```yaml
style_report:
  result: fail
  fixes:
    - { section: register-card, issue: "Uses 'log-in' instead of canonical 'sign in'", suggestion: "Replace 'log-in' with 'sign in'", severity: high }
  stats: { sections: 1, violations: 1, todos_open: 0 }
```
