---
name: event-topology-generator
description: Produce a design-time event & messaging topology (events, channels, producers/consumers, delivery semantics) from the domain model and architecture. Use at the blueprint stage after architecture and domain model, alongside API and database design. Not code.
version: 1.0.0
category: blueprint
tags:
  - event-topology
  - messaging
  - events
  - blueprint
  - architecture
model: inherit
invokes: []
inputs:
  - domain_model
  - architecture_design
outputs:
  - event_topology
---

# Goal

Produce a design-time event and messaging topology from the domain model and architecture:
the event catalog, in-process vs broker split, channels/topics, producers and consumers,
delivery semantics, ordering, and dead-letter strategy. This is a **design-time skill — it does
not generate code**. It emits an `event_topology` artifact that guides the backend
`event-generator` (in-process), `messaging-generator` (broker), and `websocket-generator`
(client-facing) at generation time.

# Inputs

```yaml
domain_model:
  aggregates: [Order, Payment]
  domain_events: [OrderPlaced, OrderCancelled, PaymentCaptured]
architecture_design:
  communication_style: REST (sync) + events (async)
  system_style: modular-monolith
```

# Output

```yaml
event_topology:
  events:
    - name: OrderPlaced
      type: domain            # domain | integration
      transport: in-process   # in-process | broker | websocket
      producer: order
      consumers: [notification, analytics]
      delivery: at-least-once
      ordering: per-aggregate
      dlq: n/a
  channels:
    - name: order-events      # broker topic/queue (if transport=broker)
      transport: kafka
      partitions_key: orderId
  notes: [...]
```

# Derive from the ACTUAL requirements — never copy the examples

The Inputs, Output, and Examples in this skill use an **illustrative sample domain**
(e-commerce: OrderPlaced, PaymentCaptured). They show the *format*, not the content. Build
the `event_topology` from the **real `domain_model` and `architecture_design` given in this
conversation** — the actual product's domain events and modules. Do **not** emit the sample
events (OrderPlaced/PaymentCaptured, …) unless the provided domain model genuinely defines
them. If your result lists events that never appear in the given domain model, you have
copied the example — discard it and redo the work from the real inputs.

# Workflow

## Step 1 — Catalog events
Collect domain events from the domain model and identify integration events crossing a boundary.

## Step 2 — Classify transport
For each event choose in-process (single deployable, decoupling), broker (cross-service/durable),
or websocket (client-facing push), driven by the architecture's communication style and scaling.

## Step 3 — Map producers and consumers
Assign the producing module and consuming modules per event; define channels/topics for broker
events with a partition/ordering key.

## Step 4 — Define delivery semantics
Specify delivery guarantee (at-least-once / at-most-once), ordering scope, idempotency needs, and
dead-letter/retry strategy for broker events.

## Step 5 — Assemble
Merge into the `event_topology` artifact with traceability to aggregates and requirements.

# Rules

- Never generate implementation code — emit a design artifact only. Runtime code is produced by `event-generator` (in-process), `messaging-generator` (broker, incl. Redis Pub/Sub), and `websocket-generator` (client-facing).
- Keep the in-process vs broker vs websocket split explicit per event; it directly drives which generator owns it.
- Broker events must declare delivery guarantee, ordering scope, and a dead-letter/retry strategy.
- Every event must trace to a domain aggregate or an explicit integration requirement.
- Prefer in-process events within a modular-monolith unless durability or cross-service delivery is required.

# Deliverable — also save a Markdown document

`event_topology` above is the in-context, pipeline-facing form (consumed by downstream
blueprint/validator/generator skills). You must **also persist the design as a
human-readable Markdown document** so it is a usable deliverable on its own:

- `write_file` to **`event-topology.md`** in the current working folder.
- Write **Markdown**: headings, brief prose, and tables/bullet lists (an event catalog
  table is ideal). **Never** dump raw YAML or a JavaScript-style object literal
  (`event_topology = { ... }`) — that is not a document.
- Cover every part of the artifact: event catalog, transport split (in-process/broker/
  websocket), channels, producers & consumers, delivery semantics, ordering, and dead-letter/
  retry strategy, keeping the traceability to aggregates and requirements.

This is still design-only — a design *document*, not application code. Saving
`event-topology.md` is a required step: the skill is **not complete** until that file exists.

# Examples

Input:

```yaml
domain_model: { domain_events: [OrderPlaced, PaymentCaptured] }
architecture_design: { system_style: modular-monolith, communication_style: "REST + events" }
```

Output (abridged):

```yaml
event_topology:
  events:
    - { name: OrderPlaced,    type: domain, transport: in-process, producer: order, consumers: [notification], delivery: at-least-once, ordering: per-aggregate }
    - { name: PaymentCaptured, type: integration, transport: broker, producer: payment, consumers: [order, ledger], delivery: at-least-once, ordering: per-aggregate, dlq: payment-events.DLQ }
  channels:
    - { name: payment-events, transport: kafka, partitions_key: orderId }
```
