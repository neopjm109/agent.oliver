---
name: notification-generator
description: Generate Spring Boot outbound notification delivery — email, SMS, and push — with templating, retry/queueing, and delivery tracking.
version: 1.0.0
category: backend
tags:
  - spring-boot
  - notification
  - email
  - sms
  - push
  - template
model: inherit
invokes:
  - spring-senior-programmer
inputs:
  - notification_requirements
outputs:
  - notification_code
---

# Goal

Generate production-ready outbound notification delivery for a Spring Boot feature across
channels (email via `JavaMailSender`/template engine, SMS, push), with a channel abstraction,
templating, retry/queueing, and delivery status tracking. This skill owns the **notification
domain**; the raw HTTP transport to a specific provider may reuse `integration-generator`, and
async fan-out may reuse `messaging-generator`.

# Inputs

```yaml
notification_requirements:
  name: OrderConfirmation
  channels: [email, sms]
  template_engine: thymeleaf     # thymeleaf | freemarker
  async: true                    # send off the request thread
  retry: { max_attempts: 3, backoff: 2s }
  track_delivery: true
```

# Output

```yaml
notification_code:
  - NotificationSender interface + channel implementations (EmailSender, SmsSender)
  - NotificationService (channel routing, template rendering)
  - templates (HTML/text) + model binding
  - retry/async config + DeliveryLog (if track_delivery)
```

# Workflow

## Step 1 — Define channels and payload
Model a channel-agnostic notification payload and select the target channels.

## Step 2 — Design templating
Define templated bodies (subject/body) with a typed model per notification type.

## Step 3 — Design delivery and resilience
Add async dispatch, bounded retry with backoff, and optional delivery tracking/idempotency.

## Step 4 — Delegate implementation
Delegate senders, service, templates, and config to `spring-senior-programmer`.

# Rules

- Own notification concerns only; delegate generic external HTTP transport to `integration-generator` and async fan-out to `messaging-generator`.
- Never block the request thread for delivery unless explicitly synchronous; prefer async + retry.
- Retries must be bounded; make sends idempotent (dedupe key) to avoid duplicate notifications.
- Never log full message bodies containing PII; keep recipient/secret data masked.
- Keep templates free of business logic; the service supplies a fully-resolved model.

# Examples

Input:

```yaml
notification_requirements:
  name: OrderConfirmation
  channels: [email]
  template_engine: thymeleaf
  async: true
  retry: { max_attempts: 3, backoff: 2s }
```

Output (abridged):

```java
public interface NotificationSender {
    void send(NotificationMessage message);
}

@Component
@RequiredArgsConstructor
public class EmailSender implements NotificationSender {
    private final JavaMailSender mailSender;
    private final TemplateEngine templateEngine;

    @Async
    @Retryable(maxAttempts = 3, backoff = @Backoff(delay = 2000))
    @Override
    public void send(NotificationMessage message) {
        String html = templateEngine.process("order-confirmation", message.model());
        MimeMessage mime = mailSender.createMimeMessage();
        // ... set recipient/subject/html ...
        mailSender.send(mime);
    }
}
```
