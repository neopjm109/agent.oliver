---
name: django-integration-generator
description: Generate production-ready external-system integration clients for Django (httpx/requests, OAuth, payment, webhooks) with resilient timeouts and retries. Django peer of integration-generator.
version: 1.0.0
category: backend
tags:
  - django
  - integration
  - httpx
  - requests
  - external-api
  - webhook
model: inherit
invokes:
  - django-senior-programmer
inputs:
  - integration_requirements
outputs:
  - integration_layer_code
---

# Goal

Generate production-ready integrations with external systems over generic transports (REST,
SOAP, GraphQL, OAuth providers, payment gateways, FTP/SFTP, webhooks) for a Django backend,
keeping external communication isolated from business logic with resilient timeouts and retries.
Notification delivery (email/SMS/push) is owned by `django-notification-generator` and file/object
storage (S3/GCS/Azure) by `django-storage-generator` — delegate those rather than generating them
here.

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
  - <Name>Client (httpx client wrapper)   # e.g. slack_client.py
  - request/response schemas, mapper, client configuration
  - exception handling, retry/timeout config
```

# Workflow

## Step 1 — Analyze requirements
Select the client technology (httpx preferred; requests if sync-only) and the authentication method.

## Step 2 — Design models and resilience
Define dedicated request/response schemas (dataclasses/pydantic) and retry/timeout policies.

## Step 3 — Delegate implementation
Delegate the client/config/mapper code writing to `django-senior-programmer`.

## Step 4 — Validate
Verify resilience, error translation, and that no third-party model leaks to the domain.

# Rules

- Keep external integrations isolated; services depend on integration interfaces, not implementations.
- Own generic external transport only; delegate email/SMS/push to `django-notification-generator` and file/object storage to `django-storage-generator`.
- Prefer `httpx` (with a configured `Client`/`Timeout`); use `requests` only where a sync-only dependency requires it.
- Never expose third-party payloads to the domain; translate external errors into domain-specific exceptions.
- Configure connect/read timeouts; support bounded retries (e.g. tenacity) — never infinite retries.
- Never hardcode or log credentials/secrets; bind them via settings; validate and sanitize external input.

# Examples

Input:

```yaml
integration_requirements: { name: SlackNotification, protocol: rest, auth: bearer-token }
```

Output (abridged):

```python
class SlackClient:
    def __init__(self, client: httpx.Client, settings: SlackSettings) -> None:
        self._client = client
        self._settings = settings

    @retry(stop=stop_after_attempt(3), wait=wait_fixed(0.3))
    def notify(self, message: SlackMessage) -> None:
        resp = self._client.post(
            "/api/chat.postMessage",
            json=asdict(message),
            headers={"Authorization": f"Bearer {self._settings.token}"},
            timeout=httpx.Timeout(5.0, connect=2.0),
        )
        if resp.is_error:
            raise ExternalServiceError("Slack", resp.status_code)
```
