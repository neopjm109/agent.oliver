---
name: fact-check
description: Evaluate factual claims using only validated research evidence and mark each as supported, contradicted, inconclusive, or unverifiable, without new searches or prior knowledge. Use before summarize in the research pipeline.
version: 1.0.0
category: research
tags:
  - research
  - fact-check
  - verification
  - evidence
model: inherit
invokes: []
inputs:
  - extracted_facts
  - comparison_result
  - source_evaluation
  - claims
outputs:
  - fact_check_result
---

# Goal

Evaluate factual claims using verified research data and validated sources. Determine
whether each claim is supported, contradicted, inconclusive, or unverifiable based only on
the provided evidence. This skill performs no new web searches and uses no prior knowledge.

# Inputs

```yaml
extracted_facts: { ... }     # from web-research
comparison_result: { ... }   # from compare-sources
source_evaluation: { ... }   # from source-validation
claims:
  - "Spring Boot 3.4 requires Java 21."
```

# Output

```yaml
fact_check_result:
  claims:
    - claim: <original claim>
      status: Supported | Contradicted | Inconclusive | Unverifiable
      evidence: [<supporting/contradicting evidence with source>, ...]
      confidence: High | Medium | Low   # reflects evidence quality, not model confidence
      notes: <why the claim received this status>
  remaining_uncertainty: [<unresolved question>, ...]
  evidence_summary:
    supporting_sources: <n>
    contradicting_sources: <n>
    neutral_sources: <n>
```

# Workflow

## Step 1 — Receive claims and evidence
Receive claims plus extracted facts, comparison results, and source validation.

## Step 2 — Gather relevant evidence
Collect all related evidence; ignore evidence from rejected sources.

## Step 3 — Determine status
Compare each claim with the extracted facts; assign status and record supporting and
contradicting evidence.

## Step 4 — Assign confidence and report
Assign confidence based on evidence quality/consistency; report unresolved uncertainty. Stop.

# Rules

- Use only the provided evidence. Never search the web, use model memory or prior knowledge,
  fill missing information, or guess.
- Status: Supported (consistently supported by sufficient evidence); Contradicted (reliable
  evidence directly conflicts); Inconclusive (insufficient or conflicting evidence);
  Unverifiable (no relevant evidence).
- Confidence reflects evidence quality only: High (multiple independent high-quality sources
  agree), Medium (limited evidence or minor disagreement), Low (sparse/weak sources).
- When evaluating evidence, prefer official docs, government publications, standards orgs,
  peer-reviewed papers, vendor docs, reputable technical publications — but do not
  automatically reject lower-priority sources; evaluate all available evidence.
- On conflict, record all conflicting evidence, do not ignore minority evidence, and explain
  an inconclusive result where appropriate.
- If evidence is insufficient, return status Unverifiable; do not infer the answer.
- Do not recommend products, express opinions, predict outcomes, invent explanations, or
  rewrite evidence into stronger conclusions.

# Examples

Input:

```yaml
claims: ["Spring Boot 3.4 requires Java 21."]
extracted_facts:
  sources:
    - url: "https://docs.spring.io/..."
      facts: ["Spring Boot 3.4 requires Java 17 as a minimum and supports up to Java 23."]
    - url: "https://docs.oracle.com/..."
      facts: ["Virtual threads require Java 21."]
```

Output:

```yaml
fact_check_result:
  claims:
    - claim: "Spring Boot 3.4 requires Java 21."
      status: Contradicted
      evidence:
        - "Spring Boot 3.4 requires Java 17 minimum. [docs.spring.io]"
      confidence: High
      notes: "Official docs state Java 17 minimum; Java 21 is required only for virtual threads, not for Spring Boot 3.4 itself."
  remaining_uncertainty: []
  evidence_summary:
    supporting_sources: 0
    contradicting_sources: 1
    neutral_sources: 1
```
