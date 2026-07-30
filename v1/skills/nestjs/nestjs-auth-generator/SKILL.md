---
name: nestjs-auth-generator
description: Generate NestJS authentication/authorization for a feature — Passport strategies, guards, and a role/permission model — from the blueprint security requirements. NestJS peer of security-generator.
version: 1.0.0
category: backend
tags:
  - nestjs
  - auth
  - security
  - guards
model: inherit
invokes:
  - nestjs-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - auth_artifact
---

# Goal

Produce authentication and authorization for the feature in NestJS: Passport strategies
(e.g. JWT), guards, and a role/permission model applied to routes. Delegates code to
`nestjs-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
application_blueprint: { security: { scheme, roles, protected_endpoints } }
```

# Output

```yaml
auth_artifact:
  strategies: [<Passport strategy>]
  guards: [<AuthGuard, RolesGuard>]
  rbac: { roles, permissions }
  applied: [<endpoint → guard/roles>]
```

# Workflow

## Step 1 — Authentication
Implement the auth scheme via a Passport strategy (e.g. JWT) and an auth guard.

## Step 2 — Authorization
Define roles/permissions and a RolesGuard; map protected endpoints to required roles.

## Step 3 — Apply & delegate
Apply guards to routes; delegate implementation to `nestjs-senior-programmer`.

## Step 4 — Return
Return `auth_artifact`.

# Rules

- Follow the blueprint security model; never invent roles or loosen protection.
- Use Nest guards + Passport strategies; keep auth logic out of controllers.
- Protect exactly the endpoints the blueprint marks; deny by default where specified.
- Delegate file contents to `nestjs-senior-programmer`.

# Examples

Input:

```yaml
application_blueprint: { security: { scheme: JWT, roles: [USER], protected_endpoints: ["POST /orders"] } }
```

Output (abridged):

```yaml
auth_artifact:
  strategies: [JwtStrategy]
  guards: [JwtAuthGuard, RolesGuard]
  rbac: { roles: [USER], permissions: [order:create] }
  applied: ["POST /orders → JwtAuthGuard + @Roles(USER)"]
```
