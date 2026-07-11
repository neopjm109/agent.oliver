---
name: nestjs-cache-generator
description: Generate NestJS caching for a feature — cache-manager keys, TTLs, and Redis-backed cache/locks — from performance requirements. NestJS peer of redis-generator.
version: 1.0.0
category: backend
tags:
  - nestjs
  - cache
  - redis
model: inherit
invokes:
  - nestjs-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - cache_artifact
---

# Goal

Produce caching for the feature in NestJS using cache-manager (Redis store): cache keys,
TTLs, invalidation, and optional distributed locks. Delegates code to `nestjs-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
application_blueprint: { performance: { cacheable: [...] } }
```

# Output

```yaml
cache_artifact:
  keys: [ { key_pattern, ttl } ]
  invalidation: [<when to evict>]
  locks: [<distributed lock, if needed>]
```

# Workflow

## Step 1 — Define keys & TTL
Choose cache key patterns and TTLs for cacheable reads.

## Step 2 — Invalidation & locks
Define eviction on writes; add Redis locks where concurrency requires.

## Step 3 — Delegate & return
Delegate to `nestjs-senior-programmer`; return `cache_artifact`.

# Rules

- Use cache-manager with a Redis store; keep keys namespaced per feature.
- Always pair cache with an invalidation rule; avoid stale reads.
- Redis Pub/Sub as a broker belongs to `nestjs-messaging-generator`, not here.
- Delegate file contents to `nestjs-senior-programmer`.

# Examples

Input:

```yaml
application_blueprint: { performance: { cacheable: [order-by-id] } }
```

Output (abridged):

```yaml
cache_artifact:
  keys: [ { key_pattern: "order:{id}", ttl: 300 } ]
  invalidation: ["evict order:{id} on order update"]
  locks: []
```
