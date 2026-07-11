---
name: django-auth-generator
description: Generate Django/DRF authentication and authorization for a feature — authentication classes, permission classes, and a role/permission model — from blueprint security requirements. Django peer of security-generator.
version: 1.0.0
category: backend
tags:
  - django
  - auth
  - drf
  - permissions
model: inherit
invokes:
  - django-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - auth_artifact
---

# Goal

Produce authentication and authorization for the feature in Django/DRF: authentication
classes (e.g. JWT/session), permission classes, and a role/permission model applied to
viewsets. Delegates code to `django-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
application_blueprint: { security: { scheme, roles, protected_endpoints } }
```

# Output

```yaml
auth_artifact:
  authentication: [<auth class>]
  permissions: [<permission class>]
  rbac: { roles, permissions }
  applied: [<viewset/endpoint → permission/roles>]
```

# Workflow

## Step 1 — Authentication
Configure the auth scheme (JWT/session/token) via DRF authentication classes.

## Step 2 — Authorization
Define roles/permissions and DRF permission classes; map protected endpoints.

## Step 3 — Apply & delegate
Attach permission classes to viewsets; delegate to `django-senior-programmer`.

## Step 4 — Return
Return `auth_artifact`.

# Rules

- Follow the blueprint security model; never invent roles or loosen protection.
- Use DRF authentication/permission classes; keep auth logic out of business code.
- Protect exactly the endpoints the blueprint marks; default-deny where specified.
- Delegate file contents to `django-senior-programmer`.

# Examples

Input:

```yaml
application_blueprint: { security: { scheme: JWT, roles: [USER], protected_endpoints: ["POST /orders"] } }
```

Output (abridged):

```yaml
auth_artifact:
  authentication: [JWTAuthentication]
  permissions: [IsAuthenticated, OrderPermission]
  rbac: { roles: [USER], permissions: [order:create] }
  applied: ["OrderViewSet.create → IsAuthenticated + role USER"]
```
