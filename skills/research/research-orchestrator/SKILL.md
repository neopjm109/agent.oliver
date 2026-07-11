---
name: research-orchestrator
description: Coordinate the end-to-end research pipeline by selecting search skills and delegating each stage (search, research, validation, comparison, fact-check, summary) to specialized research skills. Use when a request needs an evidence-based, source-cited answer.
version: 1.0.0
category: research
tags:
  - research
  - orchestrator
  - pipeline
  - fact-check
  - entrypoint
model: inherit
invokes:
  - web-search
  - docs-search
  - github-search
  - news-search
  - web-research
  - compare-sources
  - fact-check
  - source-validation
  - summarize
inputs:
  - user_request
  - options
outputs:
  - research_summary
---

# Goal

Produce an evidence-based response by orchestrating specialized research skills.
This skill **never performs research directly** — it selects search skills, sequences
the pipeline, and returns the final summarized result. It does not search, read pages,
validate, compare, fact-check, or summarize on its own.

# Inputs

```yaml
user_request: "Does Spring Boot 3.4 support Virtual Threads and which Java version is required?"
options:
  language: en            # optional
  output_format: markdown # optional
  trusted_domains: [spring.io, docs.oracle.com]  # optional
  time_range: last_12_months  # optional
```

# Output

```yaml
research_summary:            # returned unmodified from summarize
  summary: <concise evidence-based summary>
  key_points: [<point>, ...]
  important_facts: [<verified fact>, ...]
  open_questions: [<unresolved question>, ...]
  sources: [<url>, ...]
```

# Workflow

## Step 1 — Analyze the request
Determine topic, intent, information type, and preferred source type.

## Step 2 — Select search skills
Choose one or more from the available search skills. Multiple may run when the request
spans domains.

- General knowledge → `web-search`
- Official documentation / framework / API → `docs-search`
- Open source projects / repositories → `github-search`
- Recent events / releases → `news-search`

Prefer specialized search skills over general `web-search`; use `web-search` only when no
specialized skill fits or extra context is needed.

## Step 3 — Merge search results
Combine outputs from all invoked search skills. Remove duplicate URLs, mirrored pages, and
duplicate repositories. Preserve source metadata.

## Step 4 — Extract facts
Invoke `web-research` to extract factual information from the collected sources.

## Step 5 — Validate sources
Invoke `source-validation` to assess source credibility and authority.

## Step 6 — Compare sources
Invoke `compare-sources` to identify agreements, differences, and unique claims.

## Step 7 — Fact-check
Derive the candidate `claims` from the extracted facts and compare-sources' unique claims,
then invoke `fact-check` to verify those claims against the validated evidence.

## Step 8 — Summarize
Invoke `summarize` to generate the final response using only supported facts.

## Step 9 — Return
Return the final summary. The pipeline ends here.

# Rules

- This skill only coordinates. Delegate every task; never search, read, validate, compare,
  fact-check, or summarize directly.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Never modify outputs from downstream skills.
- Never invent information or fill missing evidence with model knowledge.
- If verified evidence cannot be obtained, report "Insufficient verified information."
- Error handling: if one search skill fails, continue with successful results. If every
  search skill fails, stop and report "No reliable sources were found." If a downstream
  skill fails, continue where possible and report the incomplete stage.

# Examples

Input:

```yaml
user_request: "Does Spring Boot 3.4 support Virtual Threads and what Java version is required?"
options: { trusted_domains: [spring.io, docs.oracle.com] }
```

Output (abridged):

```
✔ analyze → topic: Spring Boot 3.4 Virtual Threads; type: technical/version facts
✔ select  → docs-search + github-search
✔ merge   → 6 unique sources (2 duplicates removed)
✔ web-research     → 9 facts extracted
✔ source-validation→ 4 high, 2 medium credibility
✔ compare-sources  → 3 agreements, 0 conflicts
✔ fact-check       → "requires Java 21": Supported (High)
✔ summarize        → final response

Summary: Spring Boot 3.4 supports Virtual Threads; they require Java 21 (Project Loom).
Key Facts:
- Spring Boot 3.4 supports Virtual Threads. [spring.io]
- Virtual Threads require Java 21. [docs.oracle.com]
Remaining Uncertainty: None.
Sources: https://spring.io/..., https://docs.oracle.com/...
```
