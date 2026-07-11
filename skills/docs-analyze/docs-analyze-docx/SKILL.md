---
name: docs-analyze-docx
description: Parses a DOCX file into a structured document of functional/non-functional requirements, business rules, constraints, and entities for downstream orchestration.
version: 1.0.0
category: docs-analyze
tags:
  - docx
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

Extract explicit requirements and specifications from a Microsoft Word (`.docx`)
document and emit a normalized `structured_document`. This skill performs
**analysis only** — it does not generate application code. It is invoked by
`app-orchestrator`, one instance per `.docx` input file.

# Inputs

```yaml
file_path: /abs/path/to/requirements.docx
```

# Output

```yaml
structured_document:
  type: docx
  source: /abs/path/to/requirements.docx
  functional_requirements: []      # [{ id, text, section }]
  non_functional_requirements: []  # [{ id, text, category }]  e.g. performance, security
  business_rules: []               # [{ id, text }]
  constraints: []                  # [{ id, text }]
  entities: []                     # [{ name, attributes[], source_section }]
  tables: []                       # [{ heading, header[], rows[][] }] raw table content preserved
```

# Workflow

## Step 1 — Verify the file

Using the `terminal` tool, confirm the file exists and is a real DOCX
(a ZIP container). Fail fast with a clear message if not:

```bash
test -f "<file_path>" && file "<file_path>" | grep -qi "microsoft word\|zip" \
  && echo "OK" || echo "NOT_A_DOCX"
```

## Step 2 — Extract raw text and tables

Run the bundled extractor with the `terminal` tool. It prints each non-empty
paragraph as `[StyleName] text` (headings such as `Heading1` are preserved) and
each table as a `--- TABLE n ---` block of pipe-joined rows. It prefers
`python-docx` and falls back to parsing `word/document.xml` with the standard
library, so `python3` is the only requirement:

```bash
python3 scripts/extract.py "<file_path>"
```

If `python3` itself is unavailable, extract the document XML directly with shell
tools (a `.docx` is a ZIP whose body lives in `word/document.xml`; read its text
runs `<w:t>`, heading styles `<w:pStyle>`, and tables `<w:tbl>`/`<w:tr>`/`<w:tc>`):

```bash
mkdir -p /tmp/docx_extract && \
unzip -o "<file_path>" word/document.xml -d /tmp/docx_extract && \
cat /tmp/docx_extract/word/document.xml
```

## Step 3 — Classify content

Walk the extracted paragraphs/tables and classify each item into
`functional_requirements`, `non_functional_requirements`, `business_rules`, or
`constraints`, using heading context and cue words ("shall", "must", "the
system") to decide. Preserve the originating section for traceability.

## Step 4 — Extract entities

From nouns in requirement text and from table rows describing data, collect
candidate `entities` with their attributes. Only include entities explicitly
named in the document.

## Step 5 — Normalize

Assemble every extracted item into the unified `structured_document` schema,
assigning stable ids (e.g. `FR-001`, `NFR-001`, `BR-001`).

# Rules

- Extract only content explicitly present; never infer missing requirements.
- Preserve original wording; do not paraphrase requirement text.
- Every requirement must carry a stable id and its source section for traceability.
- Preserve raw tables under `tables` even when their content is also classified elsewhere.
- Use `terminal` for all file access; run `scripts/extract.py` (it handles the `python-docx`→stdlib fallback internally) and drop to the `unzip`/XML shell path only when `python3` is absent.
- This skill parses `.docx` only. Route `.pptx` to `docs-analyze-pptx`, `.xlsx` to `docs-analyze-xlsx`, `.md` to `docs-analyze-markdown`, `.pdf` to `docs-analyze-pdf`, and `.csv`/`.tsv` to `docs-analyze-csv`.

# Examples

Input:

```yaml
file_path: /project/docs/requirements.docx
```

Output:

```yaml
structured_document:
  type: docx
  source: /project/docs/requirements.docx
  functional_requirements:
    - { id: FR-001, text: "The system shall allow users to register with an email and password.", section: "2. Accounts" }
    - { id: FR-002, text: "Users shall be able to reset their password via email.", section: "2. Accounts" }
  non_functional_requirements:
    - { id: NFR-001, text: "API responses must return within 300ms at p95.", category: performance }
    - { id: NFR-002, text: "All passwords must be stored using bcrypt.", category: security }
  business_rules:
    - { id: BR-001, text: "An email address may be linked to at most one account." }
  constraints:
    - { id: C-001, text: "The backend must run on Spring Boot." }
  entities:
    - { name: User, attributes: [id, email, passwordHash, createdAt], source_section: "2. Accounts" }
  tables:
    - heading: "Account fields"
      header: [Field, Type, Required]
      rows:
        - [email, string, "yes"]
        - [password, string, "yes"]
```
