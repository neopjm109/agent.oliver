---
name: nestjs-integration-generator
description: Generate production-ready external-system integration clients for NestJS (HttpModule/axios, OAuth, payment, webhooks) with resilient timeouts and retries. NestJS peer of integration-generator.
version: 1.0.0
category: backend
tags:
  - nestjs
  - integration
  - axios
  - http-module
  - external-api
  - webhook
model: inherit
invokes:
  - nestjs-senior-programmer
inputs:
  - integration_requirements
outputs:
  - integration_layer_code
---

# Goal

Generate production-ready integrations with external systems over generic transports (REST,
SOAP, GraphQL, OAuth providers, payment gateways, FTP/SFTP, webhooks) for a NestJS backend,
keeping external communication isolated from business logic with resilient timeouts and retries.
Notification delivery (email/SMS/push) is owned by `nestjs-notification-generator` and file/object
storage (S3/GCS/Azure) by `nestjs-file-storage-generator` — delegate those rather than generating
them here.

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
  - <Name>Client (injectable, HttpModule/axios)   # e.g. slack.client.ts
  - request/response DTOs, mapper, client configuration
  - exception handling, retry/timeout config
```

# Workflow

## Step 1 — Analyze requirements
Select the client technology (HttpService/axios) and the authentication method.

## Step 2 — Design models and resilience
Define dedicated request/response DTOs and retry/timeout policies.

## Step 3 — Delegate implementation
Delegate the client/config/mapper code writing to `nestjs-senior-programmer`.

## Step 4 — Validate
Verify resilience, error translation, and that no third-party model leaks to the domain.

# Rules

- Keep external integrations isolated; business services depend on integration interfaces, not implementations.
- Own generic external transport only; delegate email/SMS/push to `nestjs-notification-generator` and file/object storage to `nestjs-file-storage-generator`.
- Prefer `HttpModule`/`HttpService` (axios) with interceptors; register per-client config via `ConfigModule`.
- Never expose third-party DTOs to the domain; translate external errors into domain-specific exceptions.
- Configure connect/read timeouts; support bounded retries — never infinite retries.
- Never hardcode or log credentials/secrets; validate and sanitize external input.

# Examples

Input:

```yaml
integration_requirements: { name: SlackNotification, protocol: rest, auth: bearer-token }
```

Output (abridged):

```typescript
@Injectable()
export class SlackClient {
  constructor(private readonly http: HttpService) {}

  async notify(message: SlackMessage): Promise<void> {
    await firstValueFrom(
      this.http.post('/api/chat.postMessage', message).pipe(
        timeout(5000),
        retry({ count: 2, delay: 300 }),
        catchError((e) => { throw new ExternalServiceError('Slack', e); }),
      ),
    );
  }
}
```
