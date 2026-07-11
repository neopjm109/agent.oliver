---
name: security-generator
description: Generate production-ready Spring Security infrastructure (authentication, authorization, JWT/OAuth2, CORS/CSRF, method security) isolated from business logic.
version: 1.0.0
category: backend
tags:
  - spring-boot
  - spring-security
  - authentication
  - authorization
  - jwt
  - oauth2
model: inherit
invokes:
  - spring-senior-programmer
inputs:
  - security_requirements
outputs:
  - security_layer_code
---

# Goal

Generate production-ready Spring Security infrastructure for a Spring Boot application:
authentication, authorization, token handling, and supporting configuration. Security
concerns are kept isolated from domain and business logic.

# Inputs

```yaml
security_requirements:
  authentication: jwt        # jwt | session | oauth2 | api-key | basic
  authorization: rbac        # rbac | permission | method-security
  roles: [ADMIN, USER]
  refresh_token: true
```

# Output

```yaml
security_layer_code:
  - SecurityConfig.java
  - JwtAuthenticationFilter.java
  - JwtTokenProvider.java
  - CustomUserDetailsService.java
  - AuthenticationEntryPoint / AccessDeniedHandler
```

# Workflow

## Step 1 — Analyze requirements
Determine the authentication and authorization strategy from the requirements.

## Step 2 — Design the security flow
Define the filter chain, token lifecycle, and authorization rules.

## Step 3 — Delegate implementation
Delegate the config/filter/provider code writing to `spring-senior-programmer`.

## Step 4 — Validate best practices
Verify no deprecated APIs, stateless-where-appropriate, and clean separation from business logic.

# Rules

- Follow Spring Security 6+ APIs; avoid deprecated `WebSecurityConfigurerAdapter`.
- Keep authentication stateless for token-based APIs; keep CSRF enabled for session apps.
- Use `BCryptPasswordEncoder`; never store or log plain-text passwords or tokens.
- Configure explicit CORS origins; no wildcard origins in production.
- Controllers must not contain authorization logic — prefer `@PreAuthorize`.
- Business services must never perform authentication; security stays in the security layer.

# Examples

Input:

```yaml
security_requirements: { authentication: jwt, authorization: rbac, roles: [ADMIN, USER] }
```

Output (abridged):

```java
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {
    private final JwtAuthenticationFilter jwtFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated())
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }
}
```
