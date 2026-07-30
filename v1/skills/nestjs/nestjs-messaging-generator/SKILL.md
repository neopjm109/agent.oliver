---
name: nestjs-messaging-generator
description: Generate NestJS broker messaging for a feature — microservice transports or broker publishers/consumers (Kafka/RabbitMQ/Redis) — from the event topology. Broker only; in-process events are nestjs-event-generator. NestJS peer of messaging-generator.
version: 1.0.0
category: backend
tags:
  - nestjs
  - messaging
  - microservices
  - broker
model: inherit
invokes:
  - nestjs-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - messaging_artifact
---

# Goal

Produce broker-based messaging in NestJS: publishers and consumers over a transport
(Kafka/RabbitMQ/Redis via Nest microservices), per the event topology. Broker only.
Delegates code to `nestjs-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
application_blueprint: { event_topology: { broker_messages: [...], transport } }
```

# Output

```yaml
messaging_artifact:
  transport: <kafka | rmq | redis>
  publishers: [<topic/queue + payload>]
  consumers: [<@MessagePattern/@EventPattern handler>]
```

# Workflow

## Step 1 — Configure transport
Set up the microservice transport per the topology.

## Step 2 — Publishers & consumers
Implement publishers for outgoing messages and `@EventPattern`/`@MessagePattern` consumers.

## Step 3 — Delegate & return
Delegate to `nestjs-senior-programmer`; return `messaging_artifact`.

# Rules

- Broker/transport messaging only; in-process events are `nestjs-event-generator`;
  client-facing real-time is `nestjs-websocket-generator`.
- Follow the event topology for which messages exist and their transport.
- Make consumers idempotent; handle redelivery.
- Delegate file contents to `nestjs-senior-programmer`.

# Examples

Input:

```yaml
application_blueprint: { event_topology: { transport: kafka, broker_messages: [OrderShipped] } }
```

Output (abridged):

```yaml
messaging_artifact:
  transport: kafka
  publishers: ["order.shipped → { orderId, trackingNo }"]
  consumers: ["@EventPattern('order.shipped') updateReadModel"]
```
