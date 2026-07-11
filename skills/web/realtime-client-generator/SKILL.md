---
name: realtime-client-generator
description: Generate a Next.js real-time client — WebSocket/SSE connection, useSubscription hooks, reconnect/backoff, and TanStack Query cache integration.
version: 1.0.0
category: frontend
tags:
  - nextjs
  - react
  - websocket
  - realtime
  - subscription
  - tanstack-query
model: inherit
invokes:
  - typescript-senior-programmer
inputs:
  - realtime_requirements
outputs:
  - realtime_code
---

# Goal

Generate the client-side real-time layer for a Next.js app: a WebSocket/SSE connection manager,
`useSubscription`-style hooks, reconnect with backoff, and integration that pushes live updates
into the TanStack Query cache. This skill owns **push/subscription channels**; request/response
query hooks are owned by `data-generator` and the HTTP client by `api-client-generator`. Pairs
with the backend `websocket-generator`.

# Inputs

```yaml
realtime_requirements:
  transport: websocket        # websocket | sse | stomp
  url: /ws
  channels: [/topic/orders]
  reconnect: { enabled: true, backoff: exponential, max: 30s }
  cache_sync: true            # update TanStack Query cache on message
  fallback_polling: true
```

# Output

```yaml
realtime_code:
  - RealtimeClient (connection manager, reconnect/backoff)
  - RealtimeProvider (single connection in the tree)
  - useSubscription<T>(channel) hook
  - query cache sync helpers (queryClient.setQueryData / invalidate)
```

# Workflow

## Step 1 — Build the connection manager
Create a typed client handling connect/disconnect, subscriptions, and exponential-backoff reconnect.

## Step 2 — Expose subscription hooks
Provide `useSubscription<T>(channel)` returning the latest message and connection status.

## Step 3 — Sync the cache
On inbound messages, update the TanStack Query cache (`setQueryData`/`invalidateQueries`); add
polling fallback when the socket is unavailable.

## Step 4 — Delegate implementation
Delegate the client, provider, and hooks to `typescript-senior-programmer`.

# Rules

- Own push/subscription channels only; request/response query hooks belong to `data-generator` and the HTTP client to `api-client-generator`.
- Keep a single shared connection via a provider; do not open one socket per component.
- Reconnect must be bounded with backoff; clean up subscriptions on unmount.
- Prefer updating the TanStack Query cache over parallel local state so server data stays single-sourced. Tag data hooks `tanstack-query`.
- Degrade gracefully to polling when the transport is unavailable; surface connection status to the UI.

# Examples

Input:

```yaml
realtime_requirements:
  transport: websocket
  url: /ws
  channels: [/topic/orders]
  reconnect: { enabled: true, backoff: exponential, max: 30s }
  cache_sync: true
```

Output (abridged):

```tsx
// hooks/use-subscription.ts
"use client";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtime } from "@/components/providers/realtime-provider";

export function useSubscription<T>(channel: string, queryKey?: unknown[]) {
  const client = useRealtime();
  const qc = useQueryClient();
  const [message, setMessage] = useState<T | null>(null);

  useEffect(() => {
    const unsub = client.subscribe<T>(channel, (msg) => {
      setMessage(msg);
      if (queryKey) qc.setQueryData(queryKey, msg);
    });
    return unsub;
  }, [channel]);

  return { message, status: client.status };
}
```
