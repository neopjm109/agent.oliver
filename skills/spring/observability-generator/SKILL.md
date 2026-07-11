---
name: observability-generator
description: Generate Spring Boot observability code — structured logging (MDC/JSON), Micrometer metrics, distributed tracing, and Actuator health indicators.
version: 1.0.0
category: backend
tags:
  - spring-boot
  - observability
  - micrometer
  - opentelemetry
  - logging
  - metrics
  - tracing
  - actuator
model: inherit
invokes:
  - spring-senior-programmer
inputs:
  - observability_requirements
outputs:
  - observability_code
---

# Goal

Generate production-ready observability infrastructure for a Spring Boot application:
structured logging with correlation ids (MDC), application metrics (Micrometer), distributed
tracing (Micrometer Tracing / OpenTelemetry), and custom Actuator health indicators. This
skill generates code; it does **not** own the basic logback/profile logging scaffold (that is
`spring-initializer`) — it enriches logging and adds metrics, tracing, and health signals.

# Inputs

```yaml
observability_requirements:
  logging:
    format: json           # json | pattern
    correlation: true      # inject traceId/requestId into MDC
  metrics:
    enabled: true
    registry: prometheus   # prometheus | otlp
    custom: [orders.placed.count, orders.value.summary]
  tracing:
    enabled: true
    exporter: otlp
  health:
    custom_indicators: [RedisHealthIndicator, PaymentGatewayHealthIndicator]
```

# Output

```yaml
observability_code:
  - LoggingConfig / MDC filter (correlation id propagation)
  - MetricsConfig + custom Meter beans (Counter/Timer/Gauge)
  - TracingConfig (Micrometer Tracing / OTLP exporter)
  - custom HealthIndicator classes
  - management/actuator + micrometer config in application.yml
```

# Workflow

## Step 1 — Analyze signals
Determine which of logs, metrics, traces, and health checks are required and their exporters.

## Step 2 — Design structured logging
Define an MDC-based correlation filter and JSON encoder so every log line carries a request/trace id.

## Step 3 — Design metrics and tracing
Define custom Micrometer meters (Counter/Timer/Gauge) and tracing exporter wiring; prefer
annotations (`@Timed`, `@Observed`) and a `MeterRegistry`/`ObservationRegistry` where practical.

## Step 4 — Design health indicators
Define custom `HealthIndicator` beans for critical dependencies (DB, Redis, external gateways).

## Step 5 — Delegate implementation
Delegate the config classes, filters, meters, and indicators to `spring-senior-programmer`.

# Rules

- Do not duplicate the base logging scaffold — `spring-initializer` owns logback + profiles; enrich, don't replace.
- Never log secrets, tokens, or PII; mask sensitive fields before emitting.
- Correlation id must propagate across threads (async, `@Async`, executors) and outbound calls.
- Expose only intended Actuator endpoints; never expose `env`/`heapdump` publicly in prod.
- Prefer Micrometer abstractions over vendor SDKs so the exporter stays swappable.

# Examples

Input:

```yaml
observability_requirements:
  logging: { format: json, correlation: true }
  metrics: { enabled: true, registry: prometheus, custom: [orders.placed.count] }
```

Output (abridged):

```java
@Component
public class CorrelationIdFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String id = Optional.ofNullable(req.getHeader("X-Request-Id")).orElse(UUID.randomUUID().toString());
        MDC.put("requestId", id);
        try { chain.doFilter(req, res); } finally { MDC.clear(); }
    }
}

@Configuration
public class MetricsConfig {
    @Bean
    Counter ordersPlacedCounter(MeterRegistry registry) {
        return Counter.builder("orders.placed.count").description("Orders placed").register(registry);
    }
}
```
