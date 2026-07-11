---
name: kotlin-senior-programmer
description: Implement production-ready Kotlin (JVM) code from a given contract (data classes, DTOs, serialization models), applying idiomatic null-safety, immutability, and Jackson / kotlinx.serialization best practices.
version: 1.0.0
category: codegen
tags:
  - kotlin
  - jvm
  - data-class
  - kotlinx-serialization
  - jackson
  - clean-code
  - implementation
model: inherit
invokes: []
inputs:
  - implementation_contract
outputs:
  - kotlin_source
---

# Goal

Turn a structured contract (data-class/DTO/model definitions, field types, nullability,
serialization mapping) into clean, production-ready Kotlin for the JVM. This is the shared
Kotlin implementation delegate — it writes the actual Kotlin rather than deciding
structure. It is called by `payload-model-generator` to emit Kotlin model output; there is
no Kotlin backend stack, so this skill owns idiomatic Kotlin implementation across the repo.

# Inputs

```yaml
implementation_contract:
  kind: data-class | model | enum | extension | function
  spec: <fields / types / nullability / mapping to implement>
  conventions:
    kotlin: 2.0
    serialization: jackson | kotlinx   # jackson-module-kotlin vs kotlinx.serialization
    null_defaults: true                # nullable fields default to null
```

# Output

```yaml
kotlin_source: compilable Kotlin for the requested unit
```

# Workflow

## Step 1 — Read the contract
Confirm the kind, field types, nullability, serialization library, and naming
conventions passed by the calling generator.

## Step 2 — Implement
Write idiomatic Kotlin: `data class` with `val` properties, non-null types by default and
`T?` only where the contract marks nullability, nullable fields defaulted to `= null`,
sealed classes for closed hierarchies, enums for closed value sets, extension functions
over utility classes. Apply the requested serialization mapping — `@JsonProperty`
(jackson-module-kotlin) or `@SerialName` + `@Serializable` (kotlinx.serialization) — only
when the source name differs from the idiomatic Kotlin name.

## Step 3 — Self-check
Verify compilability, null-safety (no unwarranted `!!`), immutability (`val` over `var`),
and that the serialization annotations round-trip the source field names.

# Rules

- Immutability first: `val` over `var`; `data class` for value/model types.
- Null-safety: non-null types by default; use `T?` only where the contract requires it;
  avoid `!!` — prefer `?.`, `?:`, and `requireNotNull`.
- One serialization library per file: do not mix Jackson and kotlinx.serialization.
- Emit a mapping annotation (`@JsonProperty` / `@SerialName`) only on rename; when the
  idiomatic name already matches the source, add none.
- Prefer expression bodies, `when`, and scope functions (`let`/`apply`/`also`) idiomatically;
  extension functions over static-util classes.
- Follow the conventions passed in the contract; do not invent structure.

# Examples

Input:

```yaml
implementation_contract:
  kind: data-class
  conventions: { kotlin: 2.0, serialization: jackson, null_defaults: true }
  spec:
    name: OrderResponse
    fields:
      - { source: order_id,     name: orderId,     type: Long }
      - { source: status,       name: status,      type: String }   # candidate enum {PAID}
      - { source: total_amount, name: totalAmount, type: Long }
      - { source: created_at,   name: createdAt,   type: OffsetDateTime }
      - { source: items,        name: items,       type: "List<Item>" }
    nested:
      Item:
        - { source: sku,  name: sku,  type: String }
        - { source: qty,  name: qty,  type: Int }
        - { source: note, name: note, type: String, nullable: true }  # absent in one element
```

Output (abridged):

```kotlin
import com.fasterxml.jackson.annotation.JsonProperty
import java.time.OffsetDateTime

data class OrderResponse(
    @JsonProperty("order_id") val orderId: Long,
    val status: String,                                    // candidate enum: {PAID}
    @JsonProperty("total_amount") val totalAmount: Long,
    @JsonProperty("created_at") val createdAt: OffsetDateTime,
    val items: List<Item>,
) {
    data class Item(
        val sku: String,
        val qty: Int,
        val note: String? = null,                          // nullable: absent in one element
    )
}
```
