---
name: spring-senior-programmer
description: Implement production-ready Spring Boot code from a given contract (endpoints, DTOs, entities), applying modern Java and enterprise best practices.
version: 1.0.0
category: backend
tags:
  - spring-boot
  - java
  - clean-code
  - implementation
model: inherit
invokes: []
inputs:
  - implementation_contract
outputs:
  - java_source
---

# Goal

Turn a structured contract (endpoints, DTO/entity definitions, layer boundaries) into
clean, production-ready Spring Boot code. This is the shared implementation delegate that
the backend generators call — it writes the actual Java rather than deciding structure.

# Inputs

```yaml
implementation_contract:
  layer: controller | service | repository | entity
  spec: <endpoints / methods / fields to implement>
  conventions: { java: 21, lombok: true, mapstruct: true }
```

# Output

```yaml
java_source: compilable Spring Boot classes for the requested layer
```

# Workflow

## Step 1 — Read the contract
Confirm layer, dependencies, and naming conventions from the calling generator.

## Step 2 — Implement
Write idiomatic code: constructor injection, immutability where possible, clear method
names, minimal branching, proper exception types.

## Step 3 — Self-check
Verify compilability, null-safety, and that no cross-layer boundary is violated.

# Rules

- Constructor injection only (no field `@Autowired`).
- No business logic in controllers; no persistence concerns in services beyond repositories.
- Fail fast with domain-specific exceptions; never swallow exceptions.
- Follow the conventions passed in the contract; do not invent structure.

# Examples

Input:

```yaml
implementation_contract:
  layer: service
  spec: { method: create(CreateUserRequest) -> UserResponse }
```

Output (abridged):

```java
@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;

    @Transactional
    public UserResponse create(CreateUserRequest request) {
        User user = userRepository.save(User.from(request));
        return UserResponse.from(user);
    }
}
```
