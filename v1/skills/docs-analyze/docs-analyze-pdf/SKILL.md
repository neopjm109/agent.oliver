---
name: docs-analyze-pdf
description: Parses a PDF document into a structured document of requirements, business rules, constraints, entities, and tables for downstream orchestration.
version: 1.0.0
category: docs-analyze
tags:
  - pdf
  - requirements
  - parser
  - document-analysis
model: inherit
invokes: []
inputs:
  - file_path
outputs:
  - structured_document
---

# Goal

Extract explicit system information from a PDF (`.pdf`) document — functional and non-functional
requirements, business rules, constraints, entities, and tables — and emit a normalized
`structured_document`. This skill performs **analysis only** — it does not generate code. It is
invoked by `app-orchestrator`, one instance per `.pdf` input file.

# Inputs

```yaml
file_path: /abs/path/to/requirements.pdf
```

# Output

```yaml
structured_document:
  type: pdf
  source: /abs/path/to/requirements.pdf
  functional_requirements: []      # [{ id, text, page }]
  non_functional_requirements: []  # [{ id, text, page }]
  business_rules: []    # [{ id, text, page }]
  constraints: []       # [{ id, text, page }]
  entities: []          # [{ name, attributes[], page }]
  tables: []            # [{ page, header[], rows[][] }]
```

# Workflow

## Step 1 — Read the file

Prefer a Python extractor; fall back to a CLI text extractor. Verify the file exists first:

```bash
test -f "<file_path>" || echo "FILE_NOT_FOUND"
# Preferred: python3 -c "import pypdf" then extract per-page text (pypdf / pdfplumber)
# Fallback:  pdftotext -layout "<file_path>" -   (poppler)
```

Use `pdfplumber` when tables must be preserved (it exposes `page.extract_tables()`); use `pypdf`
or `pdftotext -layout` for plain text with column layout retained.

## Step 2 — Extract per-page text and tables

Iterate pages in order. For each page capture the text blocks and any detected tables, keeping
the page number for traceability. Preserve layout (`-layout` / column order) so multi-column PDFs
do not scramble sentences.

## Step 3 — Classify meaning

Assign each paragraph / list item to `functional_requirements`, `non_functional_requirements`,
`business_rules`, or `constraints` using cue words ("must", "shall", "should", "performance", "SLA", "rule",
"constraint"). Collect explicitly named data models as `entities`.

## Step 4 — Normalize

Merge all extracted content into the unified `structured_document` schema with stable ids
(`FR-001`, `NFR-001`, `BR-001`, `C-001`), preserving the source page for every item.

# Rules

- Extract only explicit content; never infer requirements that are not written in the document.
- Preserve original wording and record the source page number for every item (traceability).
- Preserve tables (header + rows) even when their content is also classified elsewhere.
- Prefer a Python extractor (`pypdf`/`pdfplumber`); fall back to `pdftotext -layout` (poppler). If the PDF is scanned/image-only and no text layer exists, report `NO_TEXT_LAYER` rather than guessing (OCR is out of scope for this skill).
- This skill parses `.pdf` only. Route `.docx` → `docs-analyze-docx`, `.pptx` → `docs-analyze-pptx`, `.xlsx` → `docs-analyze-xlsx`, `.md` → `docs-analyze-markdown`, and `.csv`/`.tsv` → `docs-analyze-csv`.

# Examples

Input:

```yaml
file_path: /project/docs/requirements.pdf
```

Output:

```yaml
structured_document:
  type: pdf
  source: /project/docs/requirements.pdf
  functional_requirements:
    - { id: FR-001, page: 2, text: "Users can create and cancel orders." }
  non_functional_requirements:
    - { id: NFR-001, page: 5, text: "Order placement must respond within 300ms (p95)." }
  business_rules:
    - { id: BR-001, page: 3, text: "An order cannot be cancelled after it has shipped." }
  constraints:
    - { id: C-001, page: 1, text: "Must deploy on Spring Boot + Next.js." }
  entities:
    - { name: Order, attributes: [id, status, total], page: 4 }
  tables:
    - page: 4
      header: [Field, Type]
      rows: [[id, bigint], [status, varchar]]
```
