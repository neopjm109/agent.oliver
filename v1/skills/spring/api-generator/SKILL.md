---
name: api-generator
description: Generate the runtime API layer (Controller, Request/Response DTO, mapping, routing) for a Spring Boot feature from business requirements.
version: 1.0.0
category: backend
tags:
  - spring-boot
  - controller
  - dto
  - rest-api
model: inherit
invokes:
  - spring-senior-programmer
inputs:
  - feature_requirements
  - domain_model
outputs:
  - api_layer_code
---

# Goal

Generate production-ready Spring Boot REST API code for one feature: Controller,
Request DTO, Response DTO, validation, and route mapping. This produces **runtime code** —
distinct from `api-spec-generator` (blueprint), which produces the design-time OpenAPI spec.
For overlap resolution see INVENTORY.md.

# Inputs

```yaml
feature_requirements:
  feature: user-management
  endpoints:
    - method: POST
      path: /api/users
      description: create a user
domain_model:
  entities: [User]
```

# Output

```yaml
api_layer_code:
  - UserController.java
  - CreateUserRequest.java
  - UserResponse.java
```

# Workflow

## Step 1 — Map endpoints
Derive controller methods, HTTP verbs, paths, and status codes from requirements.

## Step 2 — Design DTOs
Define Request DTOs (with Bean Validation) and Response DTOs; never expose entities directly.

## Step 3 — Delegate implementation
Delegate actual code writing to `spring-senior-programmer` with the mapped endpoints + DTO contracts.

## Step 4 — Wire routing
Ensure paths, versioning, and error mapping follow project conventions.

# Rules

- Never expose JPA entities in the API; always use DTOs.
- Request DTOs must carry Bean Validation annotations.
- Controllers stay thin: no business logic (delegate to service layer).
- Consistent base path (`/api`) and RESTful resource naming.
- Do not generate the OpenAPI/design spec — that is `api-spec-generator`'s job.

# Examples

Input:

```yaml
endpoints: [{ method: POST, path: /api/users, description: create a user }]
```

Output (abridged):

```java
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse create(@Valid @RequestBody CreateUserRequest request) {
        return userService.create(request);
    }
}
```
