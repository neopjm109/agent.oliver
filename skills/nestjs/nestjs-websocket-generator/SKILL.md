---
name: nestjs-websocket-generator
description: Generate client-facing real-time endpoints for a NestJS feature using WebSocket gateways (rooms, events, auth). Client-facing only — broker messaging is nestjs-messaging-generator. NestJS peer of websocket-generator.
version: 1.0.0
category: backend
tags:
  - nestjs
  - websocket
  - gateway
  - realtime
model: inherit
invokes:
  - nestjs-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - websocket_artifact
---

# Goal

Produce client-facing real-time endpoints in NestJS via WebSocket gateways: connection/auth,
rooms, and emitted/received events. Client-facing only. Delegates code to
`nestjs-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
application_blueprint: { realtime: { channels: [...], auth } }
```

# Output

```yaml
websocket_artifact:
  gateway: <@WebSocketGateway>
  events: [<subscribe/emit message>]
  rooms: [<room strategy>]
  auth: <handshake auth guard>
```

# Workflow

## Step 1 — Gateway & auth
Create a gateway with connection auth (handshake).

## Step 2 — Events & rooms
Implement `@SubscribeMessage` handlers and room join/leave; emit server→client events.

## Step 3 — Delegate & return
Delegate to `nestjs-senior-programmer`; return `websocket_artifact`.

# Rules

- Client-facing real-time only; broker/microservice transport is `nestjs-messaging-generator`;
  in-process events are `nestjs-event-generator`.
- Authenticate the handshake; do not trust unauthenticated sockets.
- Scope broadcasts to rooms; avoid global emits unless required.
- Delegate file contents to `nestjs-senior-programmer`.

# Examples

Input:

```yaml
application_blueprint: { realtime: { channels: [order-status], auth: jwt } }
```

Output (abridged):

```yaml
websocket_artifact:
  gateway: "OrderGateway (namespace /orders)"
  events: ["subscribe order:{id}", "emit status-changed"]
  rooms: ["order:{id}"]
  auth: "JWT handshake guard"
```
