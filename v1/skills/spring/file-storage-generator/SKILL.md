---
name: file-storage-generator
description: Generate Spring Boot file upload and object-storage code — multipart handling, S3/GCS/Azure/local backends, signed URLs, and cleanup.
version: 1.0.0
category: backend
tags:
  - spring-boot
  - file-storage
  - s3
  - upload
  - multipart
  - object-storage
model: inherit
invokes:
  - spring-senior-programmer
inputs:
  - storage_requirements
outputs:
  - storage_code
---

# Goal

Generate production-ready file upload and object-storage handling for a Spring Boot feature:
multipart validation, a pluggable storage abstraction (S3 / GCS / Azure Blob / local), signed
URL issuance, and lifecycle/cleanup. This skill owns the **storage abstraction and upload
lifecycle**; generic external HTTP integration stays with `integration-generator`.

# Inputs

```yaml
storage_requirements:
  name: ProductImage
  backend: s3                    # s3 | gcs | azure-blob | local
  bucket: product-images
  max_size: 5MB
  allowed_types: [image/png, image/jpeg]
  signed_url: { enabled: true, ttl: 300s }
  cleanup: orphan-sweep          # optional lifecycle policy
```

# Output

```yaml
storage_code:
  - FileStorage interface + backend implementation (S3FileStorage, ...)
  - upload endpoint/service (multipart validation, key strategy)
  - signed URL issuer (if enabled)
  - StorageConfig + cleanup job hook (emitted as a scheduling requirement; scheduler/batch owns the trigger)
```

# Workflow

## Step 1 — Define the storage abstraction
Model a backend-agnostic `FileStorage` interface (put/get/delete/presign) and a key strategy.

## Step 2 — Validate uploads
Enforce size limits, allowed content types, and filename sanitization on multipart input.

## Step 3 — Design access and lifecycle
Add signed URL issuance for private objects and an orphan/expiry cleanup policy where required.

## Step 4 — Delegate implementation
Delegate the storage impl, upload service, and config to `spring-senior-programmer`. If a
*scheduled* cleanup job is required, surface it as a scheduling requirement for the orchestrator
to route to `scheduler-generator` / `batch-generator` — do not invoke them from here.

# Rules

- Own storage/upload only; generic external HTTP is `integration-generator`, and scheduled cleanup triggers are surfaced as a requirement for `scheduler-generator`/`batch-generator` (routed by the orchestrator, not invoked here).
- Always validate size and content type server-side; sanitize filenames; never trust client metadata.
- Private objects are accessed via bounded-TTL signed URLs, never public ACLs unless required.
- Never expose raw bucket credentials; bind them via typed config (see `config-properties-generator`).
- Store the storage key in the domain, not provider-specific URLs, so backends stay swappable.

# Examples

Input:

```yaml
storage_requirements:
  name: ProductImage
  backend: s3
  bucket: product-images
  max_size: 5MB
  allowed_types: [image/png, image/jpeg]
  signed_url: { enabled: true, ttl: 300s }
```

Output (abridged):

```java
public interface FileStorage {
    String put(String key, MultipartFile file);
    URL presignGet(String key, Duration ttl);
    void delete(String key);
}

@Component
@RequiredArgsConstructor
public class S3FileStorage implements FileStorage {
    private final S3Presigner presigner;
    private final S3Client s3;
    private final StorageProperties props;

    @Override
    public String put(String key, MultipartFile file) {
        validate(file); // size + content-type + filename sanitize
        s3.putObject(b -> b.bucket(props.bucket()).key(key), RequestBody.fromInputStream(...));
        return key;
    }
}
```
