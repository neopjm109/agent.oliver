---
name: api-docs-generator
description: Generate runtime Spring Boot API documentation via springdoc-openapi — annotations, OpenAPI config, grouping, and Swagger UI.
version: 1.0.0
category: backend
tags:
  - spring-boot
  - openapi
  - springdoc
  - swagger
  - api-docs
model: inherit
invokes:
  - spring-senior-programmer
inputs:
  - api_docs_requirements
outputs:
  - api_docs_code
---

# Goal

Generate runtime API documentation for existing Spring Boot controllers using springdoc-openapi:
an `OpenAPI` config bean, operation/schema annotations, endpoint grouping, examples, and Swagger
UI exposure. This skill documents the **runtime** API surface; the design-time contract is owned
by `api-spec-generator` (blueprint) — this reflects and annotates the actually-implemented
controllers from `api-generator`.

# Inputs

```yaml
api_docs_requirements:
  title: Shop API
  version: v1
  groups: [orders, users]
  security_scheme: bearer-jwt     # aligns with security-generator
  controllers: [OrderController, UserController]
  expose_ui: true                 # /swagger-ui
```

# Output

```yaml
api_docs_code:
  - OpenApiConfig (info, servers, security scheme, grouped OpenAPI beans)
  - @Operation / @ApiResponse / @Schema annotations on controllers + DTOs
  - springdoc config in application.yml (ui path, packages-to-scan)
```

# Workflow

## Step 1 — Configure the document
Define API info, servers, security scheme (matching `security-generator`), and grouped definitions.

## Step 2 — Annotate operations
Add `@Operation`, `@ApiResponse`, and `@Schema` to controllers/DTOs; include realistic examples.

## Step 3 — Expose UI and grouping
Configure Swagger UI path and `GroupedOpenApi` beans per functional area.

## Step 4 — Delegate implementation
Delegate the config bean and annotations to `spring-senior-programmer`.

# Rules

- Document runtime controllers only; the design-time OpenAPI contract belongs to `api-spec-generator`.
- Keep the security scheme consistent with `security-generator` (same token/OAuth model).
- Do not expose Swagger UI in production unless explicitly allowed; gate by profile.
- Annotations must not alter behavior — documentation only, no business logic.
- Keep examples realistic and free of secrets/PII.

# Examples

Input:

```yaml
api_docs_requirements:
  title: Shop API
  version: v1
  groups: [orders]
  security_scheme: bearer-jwt
  expose_ui: true
```

Output (abridged):

```java
@Configuration
public class OpenApiConfig {
    @Bean
    OpenAPI shopApi() {
        return new OpenAPI()
            .info(new Info().title("Shop API").version("v1"))
            .components(new Components().addSecuritySchemes("bearer-jwt",
                new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
            .addSecurityItem(new SecurityRequirement().addList("bearer-jwt"));
    }

    @Bean
    GroupedOpenApi ordersGroup() {
        return GroupedOpenApi.builder().group("orders").pathsToMatch("/orders/**").build();
    }
}
```
