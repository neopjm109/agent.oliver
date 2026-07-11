---
name: spring-initializer
description: Scaffold a production-ready Spring Boot project (build config, package structure, base configuration, profiles) from a chosen technology stack.
version: 1.0.0
category: backend
tags:
  - spring-boot
  - java
  - initializer
  - scaffolding
model: inherit
invokes:
  - spring-senior-programmer
inputs:
  - project_stack
outputs:
  - project_scaffold
---

# Goal

Initialize a production-ready Spring Boot project from a selected technology stack and
project conventions. This generates the project skeleton and infrastructure configuration
only — feature code (entities, controllers, security, etc.) is produced by the dedicated
generators that run afterward.

# Inputs

```yaml
project_stack:
  spring_boot: "3.5"
  java: 21
  build_tool: gradle
  group_id: com.example
  artifact_id: shop
  package: com.example.shop
  database: mariadb
  dependencies: [jpa, redis, validation, spring-security, jwt, querydsl]
```

# Output

```yaml
project_scaffold:
  - build.gradle
  - settings.gradle
  - src/main/resources/application.yml
  - src/main/java/<package>/<Artifact>Application.java
  - base config, profiles, global exception handler, logging config
```

# Workflow

## Step 1 — Analyze the stack
Resolve compatible dependency versions for the requested Spring Boot / Java combination.

## Step 2 — Initialize the project
Generate the Gradle build file (`build.gradle`, `settings.gradle`) and the application entry
point. Gradle is the fixed Spring build tool for this pipeline — do not emit a Maven `pom.xml`.

## Step 3 — Configure structure and infrastructure
Create the layered package structure, profile-separated configuration, a global exception
handler, and logging configuration.

## Step 3b — Delegate implementation
Delegate authoring of the actual Java (entry point, global exception handler, config classes) to
`spring-senior-programmer`, keeping scaffold decisions (package structure, versions, profiles,
dependency set) in this skill — mirroring how the NestJS/Django/Tauri/Flutter initializers delegate.

## Step 4 — Validate integrity
Ensure the generated project compiles and the profiles resolve.

# Rules

- Use Java 21 and Gradle. Gradle is the only supported Spring build tool in this pipeline
  (`build_tool` is fixed to `gradle`; ignore/reject a `maven` request) — the downstream
  deployment (`cicd-generator`: `./gradlew build`, `bootJar`) and `dependency-license-validator`
  (`build.gradle`) skills assume Gradle, so a Maven project would break them.
- Follow layered architecture and modern Spring Boot 3+ conventions.
- Separate configuration by profile (dev / prod); keep secrets out of source.
- Produce only the scaffold — do not generate feature code (that is the other backend generators' job).
- The generated project must compile as-is.

# Examples

Input:

```yaml
project_stack: { spring_boot: "3.5", java: 21, build_tool: gradle, package: com.example.shop, database: mariadb, dependencies: [jpa, redis, spring-security] }
```

Generated project layout:

```
shop/
├── build.gradle
├── settings.gradle
└── src/main/
    ├── java/com/example/shop/
    │   ├── ShopApplication.java
    │   ├── config/            (RedisConfig, SecurityConfig, JpaConfig)
    │   ├── common/            (exception/GlobalExceptionHandler.java, response/ApiResponse.java)
    │   └── domain/            (feature packages added later by domain-generator)
    └── resources/
        ├── application.yml
        ├── application-dev.yml
        └── application-prod.yml
```

Entry point:

```java
@SpringBootApplication
public class ShopApplication {
    public static void main(String[] args) {
        SpringApplication.run(ShopApplication.class, args);
    }
}
```
