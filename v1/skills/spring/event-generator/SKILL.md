---
name: event-generator
description: Generate in-process Spring Application Events for Spring Boot (domain events, publishers, listeners, async and transactional listeners) to decouple business processes.
version: 1.0.0
category: backend
tags:
  - spring-boot
  - events
  - domain-events
  - application-events
  - async
model: inherit
invokes:
  - spring-senior-programmer
inputs:
  - event_requirements
outputs:
  - event_layer_code
---

# Goal

Generate production-ready **in-process** event-driven components using Spring Application
Events: immutable domain events, a publisher, and one or more listeners (synchronous,
`@Async`, or `@TransactionalEventListener`). This decouples business processes within a
single application.

Boundary: this skill is for **in-process** events only. For cross-process delivery over a
message broker (Kafka, RabbitMQ, Redis Pub/Sub, SQS), use `messaging-generator` instead.
See INVENTORY.md.

# Inputs

```yaml
event_requirements:
  event: UserCreatedEvent
  trigger: user registration completed
  consumers:
    - send welcome email
    - grant welcome points
    - write audit log
  mode: async     # sync | async
```

# Output

```yaml
event_layer_code:
  - UserCreatedEvent.java       # immutable payload
  - one or more @EventListener classes
  - AsyncConfig.java            # if async
```

# Workflow

## Step 1 — Analyze requirements
Identify the producer, the immutable event payload, and each independent consumer.

## Step 2 — Design publisher and listeners
Publish after the business operation succeeds; one listener per responsibility.

## Step 3 — Delegate implementation
Delegate event/publisher/listener code writing to `spring-senior-programmer`; add async
or transactional-event configuration when required.

## Step 4 — Validate
Verify listeners are independent and failures do not block one another.

# Rules

- Events represent completed facts, not commands; producers must not know their consumers.
- Publish events only after the business transaction succeeds; use `@TransactionalEventListener` for commit-bound work.
- Keep payloads immutable and lightweight; avoid large object graphs.
- One listener, one responsibility; delegate complex work to services.
- For broker-based / cross-process delivery, use `messaging-generator` — not this skill.

# Examples

Input:

```yaml
event_requirements: { event: UserCreatedEvent, mode: async, consumers: [send welcome email] }
```

Output (abridged):

```java
public record UserCreatedEvent(Long userId, String email) {}

@Component
@RequiredArgsConstructor
public class WelcomeEmailListener {
    private final EmailService emailService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void on(UserCreatedEvent event) {
        emailService.sendWelcome(event.email());
    }
}
```
