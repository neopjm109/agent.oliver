---
name: docs-analyze
description: Short entry point for the docs-analyze category. Parses a source document into a structured document (requirements, business rules, API specs, UI flows, data models, tables) by detecting the file format and routing to the matching analyzer — CSV/TSV, DOCX, Markdown, PDF, PPTX, or XLSX. Invoke as '/docs-analyze'. Analysis only; does not generate code.
version: 1.0.0
category: docs-analyze
tags:
  - docs-analyze
  - entrypoint
  - router
model: inherit
invokes:
  - docs-analyze-csv
  - docs-analyze-docx
  - docs-analyze-markdown
  - docs-analyze-pdf
  - docs-analyze-pptx
  - docs-analyze-xlsx
---

# Goal

This is the **short entry point for the `docs-analyze` category**. It parses a source
document into a structured result. There is no single orchestrator — instead, pick the
analyzer that matches the input file's format.

# How to run

1. Detect the input document's format from its extension (or content):

   | Format        | Skill                   |
   | ------------- | ----------------------- |
   | `.csv` / `.tsv` | `docs-analyze-csv`      |
   | `.docx`       | `docs-analyze-docx`     |
   | `.md`         | `docs-analyze-markdown` |
   | `.pdf`        | `docs-analyze-pdf`      |
   | `.pptx`       | `docs-analyze-pptx`     |
   | `.xlsx`       | `docs-analyze-xlsx`     |

2. Run the matching analyzer as a subagent (see the framework delegation rule) to parse
   the document into the structured output.
3. If several documents of different formats are given, run one analyzer per format and
   merge the structured results before returning them to the user.

Analysis only — this category never generates code.
