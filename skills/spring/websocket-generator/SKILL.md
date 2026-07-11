---
name: websocket-generator
description: Generate Spring Boot WebSocket/STOMP endpoints — broker config, message handlers, subscriptions, and session/auth management for client-facing real-time.
version: 1.0.0
category: backend
tags:
  - spring-boot
  - websocket
  - stomp
  - realtime
model: inherit
invokes:
  - spring-senior-programmer
inputs:
  - websocket_requirements
outputs:
  - websocket_code
---

# Goal

Generate production-ready client-facing real-time transport for a Spring Boot application:
WebSocket/STOMP endpoints, message broker configuration, subscription/destination handlers, and
session + authentication management. This skill owns the **client-facing real-time channel**;
in-process events use `event-generator` and cross-service broker messaging uses
`messaging-generator`.

# Inputs

```yaml
websocket_requirements:
  name: OrderStatus
  protocol: stomp            # stomp | raw
  endpoint: /ws
  destinations:
    app_prefix: /app
    broker_prefix: /topic     # simple broker | relay to rabbitmq/kafka
  auth: jwt                   # aligns with security-generator
  broadcast: [/topic/orders]
```

# Output

```yaml
websocket_code:
  - WebSocketConfig (endpoint registration, broker, prefixes)
  - message mapping controller (@MessageMapping / @SendTo)
  - handshake/auth interceptor (JWT principal resolution)
  - broadcast service (SimpMessagingTemplate)
```

# Workflow

## Step 1 — Configure the endpoint and broker
Register the STOMP endpoint, application destination prefix, and broker (simple or relay).

## Step 2 — Design message handlers
Define `@MessageMapping`/`@SendTo` handlers and typed message payloads per destination.

## Step 3 — Secure the channel
Add a handshake/channel interceptor that authenticates connections (JWT) and resolves the principal.

## Step 4 — Delegate implementation
Delegate config, handlers, interceptor, and broadcast service to `spring-senior-programmer`.

# Rules

- Own client-facing real-time only; use `event-generator` for in-process events and `messaging-generator` for broker-to-broker/service messaging.
- Authenticate the handshake and authorize destinations; never trust an unauthenticated socket.
- Keep payloads typed DTOs; never leak domain entities directly over the socket.
- Bound per-session subscriptions and handle disconnects/reconnects cleanly.
- For horizontal scaling, relay to an external broker rather than the in-memory simple broker.

# Examples

Input:

```yaml
websocket_requirements:
  name: OrderStatus
  protocol: stomp
  endpoint: /ws
  destinations: { app_prefix: /app, broker_prefix: /topic }
  auth: jwt
  broadcast: [/topic/orders]
```

Output (abridged):

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").setAllowedOriginPatterns("*").withSockJS();
    }
    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
    }
}

@Controller
@RequiredArgsConstructor
public class OrderStatusController {
    private final SimpMessagingTemplate messaging;
    public void broadcast(OrderStatusMessage msg) {
        messaging.convertAndSend("/topic/orders", msg);
    }
}
```
