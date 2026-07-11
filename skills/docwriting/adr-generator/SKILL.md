---
name: adr-generator
description: Write an Architecture Decision Record (context, decision, alternatives, consequences) from a described decision. Produces a single ADR document in the standard format.
version: 1.0.0
category: docwriting
tags:
  - docwriting
  - adr
  - decision-record
  - architecture
model: inherit
invokes: []
inputs:
  - decision
  - options
outputs:
  - adr
---

# Goal

Produce a well-formed Architecture Decision Record from a described decision, following
the standard ADR structure. Documents a decision that has been made; it does not make or
recommend the decision.

# Inputs

```yaml
decision:
  title: "Adopt event-driven ledger"
  status: accepted        # proposed | accepted | superseded
  context: "High write contention on the balance table..."
  choice: "Use an append-only event log and project balances."
  alternatives: [{ option: "Row locking", why_not: "..." }, ...]
  consequences: { positive: [...], negative: [...] }
options:
  number: 7               # optional ADR sequence number
  language: en
  output_format: markdown
```

# Output

```yaml
adr:
  id: <ADR-000N or slug>
  title: <title>
  status: <status>
  content: <full ADR in standard sections>
```

# Workflow

## Step 1 — Header
Compose the ADR header: number/id, title, status, and date placeholder if not provided.

## Step 2 — Context
Write the forces and constraints that motivated the decision from `decision.context`.

## Step 3 — Decision
State the chosen approach clearly and unambiguously.

## Step 4 — Alternatives & consequences
List each considered alternative with why it was not chosen, then the positive and
negative consequences of the decision.

## Step 5 — Return
Return the assembled `adr`. Stop.

# Rules

- Record only the provided decision; never invent alternatives, rationale, or outcomes.
- Keep the status accurate to input; do not upgrade `proposed` to `accepted`.
- One decision per ADR; split multiple decisions into separate records upstream.
- Do not evaluate or recommend — this documents a decision already taken.

# Examples

Input:

```yaml
decision:
  title: "Adopt event-driven ledger"
  status: accepted
  context: "The balance table has high write contention under load."
  choice: "Use an append-only event log and project balances asynchronously."
  alternatives: [{ option: "Row-level locking", why_not: "Does not scale past ~500 TPS." }]
  consequences: { positive: ["Higher write throughput"], negative: ["Eventual consistency in balances"] }
options: { number: 7, language: en }
```

Output:

```yaml
adr:
  id: "ADR-0007"
  title: "Adopt event-driven ledger"
  status: "accepted"
  content: >
    # ADR-0007: Adopt event-driven ledger

    ## Status
    Accepted

    ## Context
    The balance table has high write contention under load.

    ## Decision
    Use an append-only event log and project balances asynchronously.

    ## Alternatives
    - **Row-level locking** — rejected: does not scale past ~500 TPS.

    ## Consequences
    - Positive: Higher write throughput.
    - Negative: Balances are eventually consistent.
```
