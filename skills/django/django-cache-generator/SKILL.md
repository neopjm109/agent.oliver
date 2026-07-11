---
name: django-cache-generator
description: Generate caching for a Django feature using the cache framework (Redis backend) — cache keys, TTLs, invalidation, and locks — from performance requirements. Django peer of redis-generator.
version: 1.0.0
category: backend
tags:
  - django
  - cache
  - redis
model: inherit
invokes:
  - django-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - cache_artifact
---

# Goal

Produce caching for the feature using Django's cache framework (Redis backend): cache keys,
TTLs, invalidation on writes, and optional locks. Delegates code to `django-senior-programmer`.

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
  locks: [<cache-based lock, if needed>]
```

# Workflow

## Step 1 — Keys & TTL
Choose cache key patterns and TTLs for cacheable reads (per-view or low-level cache API).

## Step 2 — Invalidation & locks
Define eviction on writes; add cache-based locks where concurrency requires.

## Step 3 — Delegate & return
Delegate to `django-senior-programmer`; return `cache_artifact`.

# Rules

- Use Django's cache framework with a Redis backend; namespace keys per feature.
- Always pair cache with invalidation; avoid stale reads.
- Broker messaging (Redis as broker) belongs to `django-celery-generator`, not here.
- Delegate file contents to `django-senior-programmer`.

# Examples

Input:

```yaml
application_blueprint: { performance: { cacheable: [order-by-id] } }
```

Output (abridged):

```yaml
cache_artifact:
  keys: [ { key_pattern: "order:{id}", ttl: 300 } ]
  invalidation: ["delete order:{id} on Order save"]
  locks: []
```
