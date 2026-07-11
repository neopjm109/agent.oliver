---
name: doc-translator
description: Translate finished document content into a target language while preserving structure, formatting, code samples, and canonical terminology. Optional final stage of the docwriting pipeline.
version: 1.0.0
category: docwriting
tags:
  - docwriting
  - translation
  - localization
model: inherit
invokes: []
inputs:
  - document_content
  - options
outputs:
  - translated_document
---

# Goal

Translate a finished document into a target language, preserving its structure,
formatting, and any non-translatable elements (code, identifiers, URLs). It translates
existing content only; it does not add, remove, or fact-check content.

# Inputs

```yaml
document_content:
  language: en
  sections: [ { heading, body, code_samples }, ... ]
options:
  target_language: ko
  glossary: { "endpoint": "엔드포인트" }   # optional term overrides
  keep_untranslated: [code, identifiers, urls]  # optional
```

# Output

```yaml
translated_document:
  language: <target_language>
  sections: [ { heading, body, code_samples }, ... ]  # same structure, translated
```

# Workflow

## Step 1 — Translate headings and body
Translate prose into the target language using natural, register-appropriate phrasing.

## Step 2 — Preserve non-translatables
Leave code samples, identifiers, and URLs unchanged; apply the glossary to fixed terms.

## Step 3 — Keep structure
Return the same section order and formatting; do not merge or drop sections.

## Step 4 — Return
Return `translated_document`. Stop.

# Rules

- Translate only; never add, remove, summarize, or fact-check content.
- Preserve markdown/formatting, code blocks, and identifiers exactly.
- Apply the provided glossary consistently; otherwise choose one canonical term and keep it.
- Do not run a style check or alter meaning to improve style.

# Examples

Input:

```yaml
document_content:
  language: en
  sections:
    - { heading: "Create a Payment", body: "Call `POST /api/payments` to create a payment.", code_samples: ["POST /api/payments"] }
options: { target_language: ko, glossary: { payment: "결제" } }
```

Output:

```yaml
translated_document:
  language: ko
  sections:
    - { heading: "결제 생성", body: "결제를 생성하려면 `POST /api/payments` 를 호출합니다.", code_samples: ["POST /api/payments"] }
```
