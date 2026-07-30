---
name: knowledge-base-orchestrator
description: Coordinate the end-to-end knowledge-base pipeline that turns a document corpus into organized, reusable knowledge artifacts — a chunked/indexed knowledge base plus FAQ, onboarding path, and glossary. Use to structure internal knowledge, not to generate code. Entrypoint of the knowledge-base domain.
version: 1.0.0
category: knowledge-base
tags:
  - knowledge-base
  - orchestrator
  - knowledge
  - faq
  - onboarding
  - pipeline
  - entrypoint
model: inherit
invokes:
  - docs-analyze-docx
  - docs-analyze-pptx
  - docs-analyze-markdown
  - docs-analyze-pdf
  - docs-analyze-xlsx
  - content-chunker
  - kb-indexer
  - faq-generator
  - onboarding-generator
  - glossary-generator
  - knowledge-base-validator
inputs:
  - kb_request
  - corpus_documents
  - options
outputs:
  - knowledge_base
---

# Goal

Build organized knowledge artifacts from a document corpus by orchestrating specialized
knowledge-base skills. This skill **never authors knowledge directly** — it ingests the
corpus, sequences chunking/indexing/artifact generation, delegates each stage, and returns
the assembled knowledge base. It organizes existing content; it never generates runtime code
and never invents facts absent from the corpus.

# Inputs

```yaml
kb_request:
  purpose: [faq, onboarding, glossary]   # which artifacts to build
  audience: new-engineer                 # optional
corpus_documents: [handbook.pdf, api-notes.md, policies.docx]
options:
  language: ko
  output_format: markdown
```

# Output

```yaml
knowledge_base:
  chunks: [ { id, text, source, location } ]          # citable units the artifacts' source_refs resolve against
  index: <topic/taxonomy structure over chunks>
  faq: [ { question, answer, source_refs } ]         # if requested
  onboarding: [ { step, content, source_refs } ]     # if requested
  glossary: [ { term, definition, source_refs } ]    # if requested
  coverage: <what the corpus did / did not cover>
  validation: <pass/fail + violations from knowledge-base-validator>
```

# Workflow

## Step 1 — Ingest the corpus
For each document, invoke the matching `docs-analyze-*` skill. Merge into a single corpus,
preserving per-source provenance.

## Step 2 — Chunk
Invoke `content-chunker` to segment the corpus into retrievable, self-contained chunks with
source metadata.

## Step 3 — Index
Invoke `kb-indexer` to build a topic taxonomy/tags over the chunks.

## Step 4 — Generate requested artifacts
Per `kb_request.purpose`: `faq-generator`, `onboarding-generator`, `glossary-generator`.

## Step 5 — Validate
Invoke `knowledge-base-validator` on the assembled artifacts + chunks to verify citation
integrity, grounding, glossary consistency, and requested-artifact completeness (pass/fail).

## Step 6 — Assemble & return
Combine index + artifacts + coverage note + validation verdict into `knowledge_base`. The
pipeline ends here.

# Rules

- This skill only coordinates. Delegate every stage; never chunk, index, or author artifacts
  directly.
- Only `invokes` listed in frontmatter may be called; they must exist in INVENTORY.md.
- Every artifact entry must cite corpus `source_refs`; never fabricate answers or terms.
- Boundary: this organizes an internal corpus into reusable knowledge. Use `research/*` for
  external web sources + fact-checking, and `docwriting/*` for authoring a single deliverable
  document. Do not generate runtime code.
- Error handling: if a `docs-analyze-*` skill fails, continue with the rest and note the gap
  in `coverage`. If a downstream skill fails, return partial artifacts and mark the stage.

# Examples

Input:

```yaml
kb_request: { purpose: [faq, glossary], audience: new-engineer }
corpus_documents: [handbook.pdf, policies.docx]
options: { language: ko }
```

Output (abridged):

```
✔ ingest  → 2 docs → 148 chunks
✔ index   → 9 topics (온보딩, 보안정책, 배포, ...)
✔ faq     → 22 Q&A (all source-cited)
✔ glossary→ 15 terms
✔ coverage→ "배포 롤백 절차는 코퍼스에 없음"
✔ validate→ knowledge-base-validator: pass (0 dangling citation, 0 uncited, 0 term conflict)

KB: 9 topics · 22 FAQ · 15 terms — 모두 출처 추적 가능, 검증 pass.
```
