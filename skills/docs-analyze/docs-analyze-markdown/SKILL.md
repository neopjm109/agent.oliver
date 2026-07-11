---
name: docs-analyze-markdown
description: Parses a Markdown document into a structured document of requirements, architecture notes, decisions, constraints, entities, tables, and code blocks for downstream orchestration.
version: 1.0.0
category: docs-analyze
tags:
  - markdown
  - requirements
  - architecture
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

Extract explicit system information from a Markdown (`.md`) document — 
requirements, architecture notes, design decisions, constraints, entities, tables,
and code blocks — and emit a normalized `structured_document`. This skill performs **analysis
only** — it does not generate code. It is invoked by `app-orchestrator`, one
instance per `.md` input file.

# Inputs

```yaml
file_path: /abs/path/to/design.md
```

# Output

```yaml
structured_document:
  type: markdown
  source: /abs/path/to/design.md
  architecture_notes: []  # [{ id, heading, text }]
  requirements: []        # [{ id, text, heading }]
  decisions: []           # [{ id, text, heading }]
  constraints: []         # [{ id, text, heading }]
  entities: []            # [{ name, attributes[], source_heading }]
  tables: []              # [{ heading, header[], rows[][] }]
  code_blocks: []         # [{ heading, lang, content }]
```

# Workflow

## Step 1 — Read the file

Read the full document with the `terminal` tool:

```bash
test -f "<file_path>" && cat "<file_path>" || echo "FILE_NOT_FOUND"
```

## Step 2 — Segment by heading hierarchy

Markdown is plain text, so parse it structurally rather than with a binary
extractor. Split the content into sections on ATX headings (`#`, `##`, `###` …),
building a heading tree that preserves nesting. Each section owns the text,
lists, tables, and code blocks that follow it until the next heading of equal or
higher level. Locate headings with the `terminal` tool when useful:

```bash
grep -nE '^#{1,6} ' "<file_path>"
```

## Step 3 — Parse block elements within each section

For every section, extract:

- **Bulleted / numbered lists** (`- `, `* `, `1. `) → candidate requirements or notes.
- **Fenced code blocks** (```` ``` ````), capturing the language tag and body → `code_blocks`.
- **Pipe tables** (`| … | … |` with a `---` separator row) → `tables`, keeping header and rows.

## Step 4 — Classify meaning

Assign each list item / paragraph to `requirements`, `architecture_notes`,
`decisions`, or `constraints` using heading context and cue words
("must", "shall", "we decided", "constraint", "ADR"). Collect explicitly named
data models as `entities`. Record the owning heading for every item.

## Step 5 — Normalize

Merge all extracted content into the unified `structured_document` schema with
stable ids (`FR-001`, `ARC-001`, `DEC-001`, `C-001`), preserving the original
heading hierarchy for traceability.

# Rules

- Extract only explicit content; never infer missing design decisions.
- Preserve the original heading hierarchy and keep every item traceable to its heading.
- Preserve code blocks verbatim, including their language tag.
- Preserve tables (header + rows) even when their content is also classified elsewhere.
- Use the `terminal` tool for reading and structural scanning; do not require any external parser binary.
- This skill parses `.md` only. Route `.docx` to `docs-analyze-docx`, `.pptx` to `docs-analyze-pptx`, `.xlsx` to `docs-analyze-xlsx`, `.pdf` to `docs-analyze-pdf`, and `.csv`/`.tsv` to `docs-analyze-csv`.

# Examples

Input:

```yaml
file_path: /project/docs/design.md
```

Output:

```yaml
structured_document:
  type: markdown
  source: /project/docs/design.md
  architecture_notes:
    - { id: ARC-001, heading: "Architecture", text: "The service is split into an API gateway and a core module." }
  requirements:
    - { id: FR-001, heading: "Features", text: "Users can create and cancel orders." }
  decisions:
    - { id: DEC-001, heading: "Decisions", text: "We decided to use MariaDB for persistence." }
  constraints:
    - { id: C-001, heading: "Constraints", text: "Must deploy on Spring Boot + Next.js." }
  entities:
    - { name: Order, attributes: [id, status, total], source_heading: "Data Model" }
  tables:
    - heading: "Data Model"
      header: [Field, Type]
      rows: [[id, bigint], [status, varchar]]
  code_blocks:
    - { heading: "Example", lang: json, content: "{ \"status\": \"PENDING\" }" }
```
