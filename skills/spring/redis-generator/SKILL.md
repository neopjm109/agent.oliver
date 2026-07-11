---
name: redis-generator
description: Generate production-ready Redis integrations for Spring Boot (cache, distributed lock, streams, sessions, rate limiting, queues, rankings, counters) isolated from domain logic.
version: 1.0.0
category: backend
tags:
  - spring-boot
  - redis
  - cache
  - distributed-lock
  - streams
  - rate-limit
model: inherit
invokes:
  - spring-senior-programmer
inputs:
  - redis_requirements
outputs:
  - redis_layer_code
---

# Goal

Generate production-ready Redis infrastructure for a Spring Boot application, keeping
Redis-specific concerns isolated from domain logic. Supports cache, session, streams,
distributed lock, queue, rate limiter, ranking, counter, geo, and Lua-script patterns.

Note on boundary: **Redis Pub/Sub is owned by `messaging-generator`**, not this skill.
This skill covers all other Redis usage. See INVENTORY.md and cross-reference
`messaging-generator` for broker-based Pub/Sub messaging.

# Inputs

```yaml
redis_requirements:
  feature: distributed-lock   # cache | session | streams | distributed-lock | queue | rate-limiter | ranking | counter | geo | lua
  purpose: prevent duplicate payment processing
  key_pattern: "lock:payment:{orderId}"
  ttl: 30s
```

# Output

```yaml
redis_layer_code:
  - RedisConfig.java
  - <feature>Service.java   # e.g. PaymentLockService.java
  - supporting types / constants
```

# Workflow

## Step 1 — Analyze requirements
Select the Redis feature and the business purpose.

## Step 2 — Design keys, TTL, serialization
Define a namespaced key strategy, expiration, and JSON serialization.

## Step 3 — Delegate implementation
Delegate the config and feature-service code writing to `spring-senior-programmer`.

## Step 4 — Validate
Verify reliability, atomicity where required, and connection-failure handling.

# Rules

- Keep Redis infrastructure separate from business logic; never expose Redis APIs to domain services.
- Use consistent namespaced keys (`user:{id}`, `lock:payment:{orderId}`); define TTL when appropriate.
- Prefer JSON serialization; avoid Java native serialization unless requested.
- For distributed locks: safe acquire/release, lock timeout, deadlock prevention (Redisson when requested).
- For rate limiters/atomic multi-step ops: prefer Lua scripts.
- Redis Pub/Sub belongs to `messaging-generator` — do not generate Pub/Sub here.

# Examples

Input:

```yaml
redis_requirements: { feature: distributed-lock, key_pattern: "lock:payment:{orderId}", ttl: 30s }
```

Output (abridged):

```java
@Service
@RequiredArgsConstructor
public class PaymentLockService {
    private final StringRedisTemplate redis;

    public boolean acquire(String orderId) {
        String key = "lock:payment:" + orderId;
        Boolean ok = redis.opsForValue().setIfAbsent(key, "1", Duration.ofSeconds(30));
        return Boolean.TRUE.equals(ok);
    }

    public void release(String orderId) {
        redis.delete("lock:payment:" + orderId);
    }
}
```
