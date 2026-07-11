---
name: django-channels-generator
description: Generate client-facing real-time endpoints for a Django feature using Django Channels — consumers, groups, and routing over WebSocket/ASGI. Client-facing only — async/broker is django-celery-generator. Django peer of websocket-generator.
version: 1.0.0
category: backend
tags:
  - django
  - channels
  - websocket
  - realtime
model: inherit
invokes:
  - django-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - channels_artifact
---

# Goal

Produce client-facing real-time endpoints in Django via Channels: consumers, channel groups,
and ASGI routing with connection auth. Client-facing only. Delegates code to
`django-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
application_blueprint: { realtime: { channels: [...], auth } }
```

# Output

```yaml
channels_artifact:
  consumers: [<WebsocketConsumer/AsyncConsumer>]
  groups: [<channel group strategy>]
  routing: <ASGI routing>
  auth: <connection auth middleware>
```

# Workflow

## Step 1 — Consumers & auth
Create consumers with connect/receive/disconnect and authenticate the connection.

## Step 2 — Groups & routing
Use channel groups for scoped broadcasts; wire ASGI routing.

## Step 3 — Delegate & return
Delegate to `django-senior-programmer`; return `channels_artifact`.

# Rules

- Client-facing real-time only; async/broker work is `django-celery-generator`; in-process
  reactions are `django-signals-generator`.
- Authenticate connections; do not trust unauthenticated sockets.
- Scope broadcasts to groups; avoid global sends unless required.
- Delegate file contents to `django-senior-programmer`.

# Examples

Input:

```yaml
application_blueprint: { realtime: { channels: [order-status], auth: jwt } }
```

Output (abridged):

```yaml
channels_artifact:
  consumers: [OrderStatusConsumer]
  groups: ["order_{id}"]
  routing: "ws/orders/<id>/ → OrderStatusConsumer"
  auth: "JWT auth middleware on connect"
```
