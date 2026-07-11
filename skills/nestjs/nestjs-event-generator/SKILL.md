---
name: nestjs-event-generator
description: Generate in-process NestJS domain events and listeners using EventEmitter2 for a feature. In-process only — broker messaging is nestjs-messaging-generator. NestJS peer of event-generator.
version: 1.0.0
category: backend
tags:
  - nestjs
  - events
  - eventemitter2
model: inherit
invokes:
  - nestjs-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - event_artifact
---

# Goal

Produce in-process domain events and their listeners in NestJS (EventEmitter2) so side
effects decouple from the main flow, per the event topology. In-process only. Delegates code
to `nestjs-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
application_blueprint: { event_topology: { in_process_events: [...] } }
```

# Output

```yaml
event_artifact:
  events: [<event class/payload>]
  emitters: [<where emitted>]
  listeners: [<@OnEvent handler>]
```

# Workflow

## Step 1 — Define events
Create event classes/payloads for the feature's in-process events.

## Step 2 — Emit & listen
Emit events from domain providers; implement `@OnEvent` listeners for side effects.

## Step 3 — Delegate & return
Delegate to `nestjs-senior-programmer`; return `event_artifact`.

# Rules

- In-process only (EventEmitter2); broker/microservice transport is `nestjs-messaging-generator`.
- Follow the event topology; never invent events not in the blueprint.
- Keep listeners idempotent where side effects can retry.
- Delegate file contents to `nestjs-senior-programmer`.

# Examples

Input:

```yaml
application_blueprint: { event_topology: { in_process_events: [OrderPlaced] } }
```

Output (abridged):

```yaml
event_artifact:
  events: [OrderPlacedEvent { orderId }]
  emitters: ["OrderService.place → emit('order.placed')"]
  listeners: ["@OnEvent('order.placed') sendConfirmation"]
```
