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
