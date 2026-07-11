---
name: faq-generator
description: Generate source-cited question-and-answer pairs from indexed chunks, covering the corpus's common topics for the target audience. Artifact stage of the knowledge-base pipeline.
version: 1.0.0
category: knowledge-base
tags:
  - knowledge-base
  - faq
  - qa
model: inherit
invokes: []
inputs:
  - index
  - chunks
  - options
outputs:
  - faq
---

# Goal

Produce a FAQ whose every answer is grounded in and cited to corpus chunks. This skill
authors Q&A from provided content only; it never invents answers.

# Inputs

```yaml
index: { topics: [...] }
chunks: [ { id, text, source } ]
options:
  audience: new-engineer
  max_questions: 30
  language: ko
```

# Output

```yaml
faq:
  - question: <likely question for the audience>
    answer: <answer grounded in chunks>
    source_refs: [K-0001, ...]
    topic: <topic name>
```

# Workflow

## Step 1 — Derive questions
For each topic, formulate the questions the audience would actually ask.

## Step 2 — Answer from chunks
Answer using only the supporting chunks; cite their IDs.

## Step 3 — Drop unanswerable
If no chunk supports an answer, omit the question rather than guessing.

## Step 4 — Return
Return `faq` (up to `max_questions`). Stop.

# Rules

- Every answer cites the chunk IDs it rests on; never answer beyond the corpus.
- Omit questions the corpus cannot answer; do not fabricate.
- Phrase questions in the audience's voice; keep answers concise.
- Do not duplicate the glossary's job (term definitions) — answer how/why questions.

# Examples

Input:

```yaml
index: { topics: [ { name: 배포, chunk_ids: [K-0001] } ] }
chunks: [ { id: K-0001, text: "배포는 매주 화요일 진행한다.", source: handbook.pdf } ]
options: { audience: new-engineer, language: ko }
```

Output:

```yaml
faq:
  - { question: "배포는 언제 하나요?", answer: "배포는 매주 화요일에 진행합니다.", source_refs: [K-0001], topic: 배포 }
```
