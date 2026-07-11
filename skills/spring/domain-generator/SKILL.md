---
name: domain-generator
description: Generate the domain layer (JPA Entity, Repository, RepositorySupport, Service) for a Spring Boot feature from business requirements and schema.
version: 1.0.0
category: backend
tags:
  - spring-boot
  - domain
  - jpa
  - entity
  - repository
  - service
model: inherit
invokes:
  - spring-senior-programmer
inputs:
  - domain_requirements
outputs:
  - domain_layer_code
---

# Goal

Generate the domain layer for a Spring Boot feature: JPA entities, repositories,
optional QueryDSL repository support, and business services. This produces **runtime
persistence and business code** for one domain, distinct from `domain-model-generator`
(blueprint), which produces the design-time domain model.

# Inputs

```yaml
domain_requirements:
  domain: User
  table:
    columns: [id, name, email, created_at]
  requirements:
    - register user
    - update user
    - delete user
    - search user
```

# Output

```yaml
domain_layer_code:
  - User.java              # entity
  - UserRepository.java    # Spring Data JPA
  - UserRepositorySupport.java  # QueryDSL, if needed
  - UserService.java
```

# Workflow

## Step 1 — Analyze requirements and schema
Map business requirements and the database schema to a domain model.

## Step 2 — Design the layer
Identify entities, required repositories (and whether QueryDSL support is needed), and
the service operations.

## Step 3 — Delegate implementation
Delegate the entity/repository/service code writing to `spring-senior-programmer` with
the field definitions and method contracts.

## Step 4 — Validate
Verify layer consistency and that entities stay persistence-focused.

# Rules

- Generate only the classes the feature needs; no speculative components.
- Keep entities persistence-focused and services business-focused (DDD-inspired layering).
- Use constructor injection; follow Spring Data JPA best practices.
- Never expose entities through the API — that boundary belongs to `api-generator` (DTOs).
- Use Java 21 features where they improve clarity.

# Examples

Input:

```yaml
domain_requirements: { domain: User, table: { columns: [id, name, email, created_at] } }
```

Output (abridged):

```java
@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @CreatedDate
    private Instant createdAt;
}
```
