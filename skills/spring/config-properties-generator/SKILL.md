---
name: config-properties-generator
description: Generate type-safe Spring Boot configuration — @ConfigurationProperties classes with validation, profile binding, and externalized secrets.
version: 1.0.0
category: backend
tags:
  - spring-boot
  - configuration
  - config-properties
  - profiles
  - secrets
model: inherit
invokes:
  - spring-senior-programmer
inputs:
  - config_requirements
outputs:
  - config_code
---

# Goal

Generate type-safe, validated configuration for a Spring Boot feature: `@ConfigurationProperties`
classes bound to profile-separated properties, with Bean Validation constraints and externalized
secrets. This skill generates typed binding classes; it does **not** own the base
`application.yml` scaffold or profile files (that is `spring-initializer`) — it adds feature-scoped
typed config on top.

# Inputs

```yaml
config_requirements:
  name: PaymentProperties
  prefix: app.payment
  fields:
    - { name: apiBaseUrl, type: String, required: true }
    - { name: timeout, type: Duration, default: 5s }
    - { name: apiKey, type: String, secret: true }
    - { name: maxRetries, type: int, min: 0, max: 5, default: 2 }
  profiles: [dev, prod]
```

# Output

```yaml
config_code:
  - <Name>Properties.java     # @ConfigurationProperties + validation
  - EnableConfigurationProperties registration (or @Configuration)
  - property keys added to application-<profile>.yml (secrets via env placeholders)
```

# Workflow

## Step 1 — Model the properties
Group related settings under a single prefix and define a record/class with typed fields.

## Step 2 — Add validation and defaults
Apply `@Validated` + Bean Validation constraints (`@NotBlank`, `@Min`, `@Positive`) and safe defaults.

## Step 3 — Externalize secrets
Bind secrets through environment placeholders (`${PAYMENT_API_KEY}`) — never inline literal secrets.

## Step 4 — Delegate implementation
Delegate the properties class and registration to `spring-senior-programmer`.

# Rules

- One prefix per cohesive concern; prefer immutable records with constructor binding.
- Always `@Validated` config that has constraints; fail fast on startup for invalid config.
- Never commit secret values — reference environment variables / secret managers via placeholders.
- Do not recreate the base `application.yml`/profile scaffold; add keys and typed binding only.
- Keep configuration free of business logic; it holds values, not behavior.

# Examples

Input:

```yaml
config_requirements:
  name: PaymentProperties
  prefix: app.payment
  fields:
    - { name: apiBaseUrl, type: String, required: true }
    - { name: apiKey, type: String, secret: true }
    - { name: maxRetries, type: int, min: 0, max: 5, default: 2 }
```

Output (abridged):

```java
@Validated
@ConfigurationProperties(prefix = "app.payment")
public record PaymentProperties(
    @NotBlank String apiBaseUrl,
    @NotBlank String apiKey,
    @Min(0) @Max(5) int maxRetries
) {}
```

```yaml
# application-prod.yml
app:
  payment:
    api-base-url: https://api.pay.example.com
    api-key: ${PAYMENT_API_KEY}
    max-retries: 3
```
