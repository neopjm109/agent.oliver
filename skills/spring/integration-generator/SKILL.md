---
name: integration-generator
description: Generate production-ready external-system integration clients for Spring Boot (REST/WebClient/OpenFeign, OAuth, payment, webhooks) with resilient timeouts and retries.
version: 1.0.0
category: backend
tags:
  - spring-boot
  - integration
  - webclient
  - openfeign
  - external-api
  - webhook
model: inherit
invokes:
  - spring-senior-programmer
inputs:
  - integration_requirements
outputs:
  - integration_layer_code
---

# Goal

Generate production-ready integrations with external systems over generic transports (REST,
SOAP, GraphQL, OAuth providers, payment gateways, FTP/SFTP, webhooks), keeping external
communication isolated from business logic with resilient timeouts and retries. Notification
delivery (email/SMS/push) is owned by `notification-generator` and file/object storage
(S3/GCS/Azure) by `file-storage-generator` — delegate those rather than generating them here.

# Inputs

```yaml
integration_requirements:
  name: SlackNotification
  external_system: Slack
  protocol: rest          # rest | soap | graphql | webhook
  auth: bearer-token      # oauth2 | api-key | basic | bearer-token
  retry: true
  timeout: { connect: 2s, read: 5s }
```

# Output

```yaml
integration_layer_code:
  - <Name>Client.java     # e.g. SlackClient.java
  - request/response DTOs, mapper, client configuration
  - exception handling, retry/timeout config
```

# Workflow

## Step 1 — Analyze requirements
Select the client technology and the authentication method.

## Step 2 — Design models and resilience
Define dedicated request/response DTOs and retry/timeout policies.

## Step 3 — Delegate implementation
Delegate the client/config/mapper code writing to `spring-senior-programmer`.

## Step 4 — Validate
Verify resilience, error translation, and that no third-party model leaks to the domain.

# Rules

- Keep external integrations isolated; business services depend on integration interfaces, not implementations.
- Own generic external transport only; delegate email/SMS/push to `notification-generator` and file/object storage to `file-storage-generator`.
- Prefer WebClient for new HTTP integrations, OpenFeign for declarative clients; avoid RestTemplate unless requested.
- Never expose third-party DTOs to the domain; translate external errors into domain-specific exceptions.
- Configure connect/read timeouts; support bounded retries — never infinite retries.
- Never hardcode or log credentials/secrets; validate and sanitize external input.

# Examples

Input:

```yaml
integration_requirements: { name: SlackNotification, protocol: rest, auth: bearer-token }
```

Output (abridged):

```java
@Component
@RequiredArgsConstructor
public class SlackClient {
    private final WebClient webClient;

    public void notify(SlackMessage message) {
        webClient.post()
            .uri("/api/chat.postMessage")
            .bodyValue(message)
            .retrieve()
            .toBodilessEntity()
            .timeout(Duration.ofSeconds(5))
            .retry(2)
            .block();
    }
}
```
