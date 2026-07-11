---
name: nestjs-queue-generator
description: Generate background/bulk job processing for a feature using BullMQ — producers and processors with retry/backoff. Bulk/async jobs only. NestJS peer of batch-generator.
version: 1.0.0
category: backend
tags:
  - nestjs
  - queue
  - bullmq
  - jobs
model: inherit
invokes:
  - nestjs-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - queue_artifact
---

# Goal

Produce background and bulk-processing jobs for the feature in NestJS using BullMQ: job
producers, processors, and retry/backoff/concurrency settings. Delegates code to
`nestjs-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
application_blueprint: { jobs: [ { name, trigger, bulk } ] }
```

# Output

```yaml
queue_artifact:
  queues: [<queue name>]
  producers: [<where jobs are enqueued>]
  processors: [ { queue, concurrency, retry, backoff } ]
```

# Workflow

## Step 1 — Define queues
Create BullMQ queues for the feature's background/bulk work.

## Step 2 — Producers & processors
Add producers (enqueue points) and processors with concurrency, retry, and backoff.

## Step 3 — Delegate & return
Delegate to `nestjs-senior-programmer`; return `queue_artifact`.

# Rules

- Background/bulk jobs only; scheduled triggers are `nestjs-scheduler-generator`.
- Set retry/backoff for fault tolerance; make processors idempotent.
- Enqueue heavy work from controllers/schedulers rather than running inline.
- Delegate file contents to `nestjs-senior-programmer`.

# Examples

Input:

```yaml
application_blueprint: { jobs: [ { name: order-email, trigger: on-order-placed } ] }
```

Output (abridged):

```yaml
queue_artifact:
  queues: [order-email]
  producers: ["OrderService.place → add('order-email', { orderId })"]
  processors: [ { queue: order-email, concurrency: 5, retry: 3, backoff: exponential } ]
```
