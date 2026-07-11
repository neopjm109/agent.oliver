---
name: spring-test-generator
description: Generate production-ready Spring Boot tests (JUnit 5 unit, @WebMvcTest controller, @DataJpaTest repository, integration with Testcontainers) following the testing pyramid.
version: 1.0.0
category: backend
tags:
  - spring-boot
  - junit
  - mockito
  - testcontainers
  - unit-test
  - integration-test
model: inherit
invokes:
  - spring-senior-programmer
inputs:
  - test_requirements
outputs:
  - test_code
---

# Goal

Generate production-ready test code for Spring Boot: unit, service, controller, repository,
integration, batch, and security tests. Focus on maintainable, deterministic, isolated tests
that follow the testing pyramid.

# Inputs

```yaml
test_requirements:
  target: UserService
  scope: unit           # unit | integration | repository | controller | service | batch | security
  scenario: create user
  dependencies: [UserRepository]
```

# Output

```yaml
test_code:
  - UserServiceTest.java
  - test fixtures / data builders, mocks, assertions
```

# Workflow

## Step 1 — Analyze the target
Identify the component and select the test strategy (slice vs full context).

## Step 2 — Design scenarios
Define one behavior per test; design fixtures, mocks, and assertions.

## Step 3 — Delegate implementation
Delegate the test-class code writing to `spring-senior-programmer`.

## Step 4 — Validate
Verify determinism, readability, and isolation.

# Rules

- One test verifies one behavior; keep tests deterministic and independent.
- Unit tests: JUnit 5 + Mockito, mock external dependencies, avoid Spring context.
- Slices: `@WebMvcTest` + MockMvc for controllers, `@DataJpaTest` for repositories; `@SpringBootTest` only when required.
- Prefer Testcontainers for integration tests; use the builder pattern for test data.
- Assert behavior/business outcomes, not implementation details; use descriptive names (`shouldRejectDuplicateEmail`).

# Examples

Input:

```yaml
test_requirements: { target: UserService, scope: unit, scenario: create user }
```

Output (abridged):

```java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {
    @Mock UserRepository userRepository;
    @InjectMocks UserService userService;

    @Test
    void shouldCreateUser() {
        var request = new CreateUserRequest("Alice", "alice@example.com");
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var response = userService.create(request);

        assertThat(response.email()).isEqualTo("alice@example.com");
        verify(userRepository).save(any(User.class));
    }
}
```
