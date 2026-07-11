---
name: api-guide-generator
description: Write a human-readable API usage guide (overview, auth, per-endpoint request/response, error handling, examples) from existing API code or an API spec. Prose deliverable, not code annotations. Use for developer-facing API documentation.
version: 1.0.0
category: docwriting
tags:
  - docwriting
  - api
  - guide
  - developer
model: inherit
invokes: []
inputs:
  - api_source
  - outline
  - options
outputs:
  - api_guide_sections
---

# Goal

Produce a developer-facing API usage guide in prose from existing API code or spec. This
is documentation about an API, not the API contract or in-code annotations.

# Inputs

```yaml
api_source:
  endpoints:
    - { method: POST, path: /api/payments, request: {...}, response: {...}, errors: [...] }
  auth: { scheme: bearer, notes: "..." }
outline: { ... }        # optional; from doc-outline-generator
options:
  language: en          # optional
  output_format: markdown
```

# Output

```yaml
api_guide_sections:
  - heading: <section title>          # Overview | Authentication | <resource> | Errors | Examples
    body: <finished prose>
    code_samples: [<request/response example>, ...]
```

# Workflow

## Step 1 — Overview & auth
Write an overview of the API's purpose and an authentication section from `api_source.auth`.

## Step 2 — Document each endpoint
For every endpoint, describe purpose, parameters, request body, response shape, and status
codes; include a concrete request/response sample.

## Step 3 — Error handling
Summarize common error responses and their meaning.

## Step 4 — Examples
Provide end-to-end usage examples covering a typical flow.

## Step 5 — Return
Return `api_guide_sections`. Stop.

# Rules

- Document only endpoints present in `api_source`; never invent routes, params, or fields.
- This produces prose — use `api-docs-generator` for springdoc/Swagger annotations in code
  and `api-spec-generator` for the design-time contract. Do not duplicate their roles.
- Samples must be consistent with the provided request/response shapes.
- Keep descriptions concise and factual; no marketing language.

# Examples

Input:

```yaml
api_source:
  auth: { scheme: bearer }
  endpoints:
    - method: POST
      path: /api/payments
      request: { amount: number, currency: string }
      response: { id: string, status: string }
      errors: [{ code: 400, when: "amount <= 0" }]
options: { language: en, output_format: markdown }
```

Output:

```yaml
api_guide_sections:
  - heading: "Authentication"
    body: "All requests require a Bearer token in the Authorization header."
    code_samples: ["Authorization: Bearer <token>"]
  - heading: "Create a Payment"
    body: >
      `POST /api/payments` creates a payment. Provide `amount` and `currency` in the
      request body. Returns the created payment `id` and its `status`.
    code_samples:
      - "POST /api/payments\n{ \"amount\": 1000, \"currency\": \"KRW\" }"
      - "200 OK\n{ \"id\": \"pay_123\", \"status\": \"PENDING\" }"
  - heading: "Errors"
    body: "`400` is returned when `amount` is zero or negative."
    code_samples: []
```
