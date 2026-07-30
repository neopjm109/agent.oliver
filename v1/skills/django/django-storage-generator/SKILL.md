---
name: django-storage-generator
description: Generate file/object storage for a Django feature — uploads, object storage via django-storages (S3/GCS/Azure), and signed URLs. Django peer of file-storage-generator.
version: 1.0.0
category: backend
tags:
  - django
  - storage
  - uploads
model: inherit
invokes:
  - django-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - storage_artifact
---

# Goal

Produce file/object storage for the feature in Django: upload handling with validation, an
object storage backend via django-storages (S3/GCS/Azure), and signed URL issuance. Delegates
code to `django-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
application_blueprint: { storage: { provider, buckets, signed_urls } }
```

# Output

```yaml
storage_artifact:
  upload: <FileField/upload handling + validation>
  backend: <django-storages backend config>
  signed_urls: <issue/verify>
```

# Workflow

## Step 1 — Uploads
Handle uploads (FileField/serializer) with size/type validation.

## Step 2 — Storage backend
Configure the django-storages backend for the provider (S3/GCS/Azure).

## Step 3 — Signed URLs
Issue time-limited signed URLs for private objects.

## Step 4 — Delegate & return
Delegate to `django-senior-programmer`; return `storage_artifact`.

# Rules

- File/object storage only; email/SMS/push is `django-notification-generator`.
- Validate upload size/type; do not trust client content type alone.
- Use signed URLs for private media; never expose bucket credentials.
- Delegate file contents to `django-senior-programmer`.

# Examples

Input:

```yaml
application_blueprint: { storage: { provider: s3, buckets: [receipts], signed_urls: true } }
```

Output (abridged):

```yaml
storage_artifact:
  upload: "receipt upload (pdf/png, max 10MB)"
  backend: "storages.backends.s3.S3Storage (receipts)"
  signed_urls: "generate_presigned_url (5 min)"
```
