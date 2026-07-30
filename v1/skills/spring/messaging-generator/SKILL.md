---
name: messaging-generator
description: Generate production-ready broker-based messaging infrastructure for Spring Boot (Kafka, RabbitMQ, Redis Pub/Sub, AWS SQS) with producers, consumers, retry, and DLQ.
version: 1.0.0
category: backend
tags:
  - spring-boot
  - messaging
  - kafka
  - rabbitmq
  - redis-pubsub
  - sqs
model: inherit
invokes:
  - spring-senior-programmer
inputs:
  - messaging_requirements
outputs:
  - messaging_layer_code
---

# Goal

Generate production-ready **broker-based** messaging infrastructure for asynchronous
communication between services, keeping transport concerns separate from business logic.
Supports Kafka, RabbitMQ, Redis Pub/Sub, AWS SQS, and Google Pub/Sub.

Boundary rules:
- This skill **owns Redis Pub/Sub** — `redis-generator` covers all other Redis usage
  (cache, lock, streams, etc.) but not Pub/Sub.
- For **in-process** notifications within a single application, use `event-generator`
  (Spring Application Events) instead of a broker. This skill is for cross-process/broker transport.

# Inputs

```yaml
messaging_requirements:
  broker: kafka          # kafka | rabbitmq | redis-pubsub | sqs | google-pubsub
  topic: user.created
  producer: UserService
  consumer: NotificationService
  retry: true
  dlq: true
```

# Output

```yaml
messaging_layer_code:
  - <Event>Producer.java     # e.g. UserCreatedProducer.java
  - <Event>Consumer.java     # e.g. UserCreatedConsumer.java
  - messaging configuration, message DTO, retry/DLQ config
```

# Workflow

## Step 1 — Analyze requirements
Select the broker and design the message payload (immutable DTO, never a JPA entity).

## Step 2 — Design producer/consumer
Define producer publish points and idempotent consumer responsibilities, plus retry/DLQ policy.

## Step 3 — Delegate implementation
Delegate producer/consumer/config code writing to `spring-senior-programmer`.

## Step 4 — Validate
Verify delivery guarantees, idempotency, and graceful broker-failure handling.

# Rules

- Keep messaging independent from business logic; consumers delegate to services.
- Publish immutable, lightweight payloads; never send JPA entities.
- Keep consumers idempotent; support retry and DLQ when requested; preserve ordering when required.
- Never log sensitive message contents; support TLS/broker authentication.
- Redis Pub/Sub is generated here (not in `redis-generator`); in-process events go to `event-generator`.

# Examples

Input:

```yaml
messaging_requirements: { broker: kafka, topic: user.created, producer: UserService }
```

Output (abridged):

```java
@Component
@RequiredArgsConstructor
public class UserCreatedProducer {
    private final KafkaTemplate<String, UserCreatedMessage> kafka;

    public void publish(UserCreatedMessage message) {
        kafka.send("user.created", message.userId().toString(), message);
    }
}
```
