---
name: nestjs-file-storage-generator
description: Generate file/object storage for a NestJS feature — uploads, object storage (S3/GCS/Azure) adapters, and signed URLs. NestJS peer of file-storage-generator.
version: 1.0.0
category: backend
tags:
  - nestjs
  - file-storage
  - uploads
model: inherit
invokes:
  - nestjs-senior-programmer
inputs:
  - feature
  - application_blueprint
outputs:
  - file_storage_artifact
---

# Goal

Produce file/object storage for the feature in NestJS: multipart upload handling, an object
storage adapter (S3/GCS/Azure), and signed URL issuance. Delegates code to
`nestjs-senior-programmer`.

# Inputs

```yaml
feature: { id, name }
application_blueprint: { storage: { provider, buckets, signed_urls } }
```

# Output

```yaml
file_storage_artifact:
  upload: <multipart handling + validation>
  adapter: <object storage client>
  signed_urls: <issue/verify>
```

# Workflow

## Step 1 — Uploads
Handle multipart uploads with size/type validation.

## Step 2 — Storage adapter
Implement the provider adapter (S3/GCS/Azure) for put/get/delete.

## Step 3 — Signed URLs
Issue time-limited signed URLs for downloads/uploads.

## Step 4 — Delegate & return
Delegate to `nestjs-senior-programmer`; return `file_storage_artifact`.

# Rules

- File/object storage only; email/SMS/push is `nestjs-notification-generator`.
- Validate upload size/type; never trust client content type alone.
- Use signed URLs for private objects; never expose bucket credentials.
- Delegate file contents to `nestjs-senior-programmer`.

# Examples

Input:

```yaml
application_blueprint: { storage: { provider: s3, buckets: [receipts], signed_urls: true } }
```

Output (abridged):

```yaml
file_storage_artifact:
  upload: "receipt upload (pdf/png, max 10MB)"
  adapter: "S3Client (receipts bucket)"
  signed_urls: "GET receipt → 5-min signed URL"
```
