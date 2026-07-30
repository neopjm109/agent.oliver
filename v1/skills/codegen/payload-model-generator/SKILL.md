---
name: payload-model-generator
description: From a concrete JSON or XML API-response payload, generate idiomatic typed models (DTO / class / interface) in the requested language (Java · Kotlin · TypeScript · Python) with serialization mapping so field-name and XML attribute/element/wrapper differences round-trip correctly.
version: 1.0.0
category: codegen
tags:
  - json
  - xml
  - dto
  - model
  - deserialization
  - jackson
  - pydantic
  - kotlinx-serialization
  - class-transformer
  - api-response
model: inherit
invokes:
  - spring-senior-programmer
  - kotlin-senior-programmer
  - typescript-senior-programmer
  - django-senior-programmer
inputs:
  - model_request
outputs:
  - model_code
---

# Goal

From a **concrete serialized API-response sample** (JSON or XML), generate idiomatic
typed models (DTO / data class / interface) in the requested language. Detect the
format, infer a schema (types, nullability, arrays, nested objects), and emit models
with **serialization mapping** (Jackson / kotlinx.serialization / class-transformer /
Pydantic) so that source-field names and XML attribute/element/wrapper/text
distinctions round-trip correctly.

This is a **standalone utility**: it works from a real payload sample and does not
require the blueprint/design pipeline. It only emits **models** — no HTTP client, no
endpoints, no OpenAPI. Unlike the `api-*` skills, which work from the *api-spec design
contract*, this skill works from an *observed payload*.

# Inputs

```yaml
model_request:
  payload: |                    # raw JSON or XML sample (required)
    { "user_id": 1, "full_name": "Kim", "roles": ["admin"], "profile": { "age": 30 } }
  format: auto                  # auto | json | xml   (auto-detect by default)
  target:
    language: java              # java | kotlin | typescript | python
    variant: record             # java: record | class | class+lombok
                                # kotlin: data-class (jackson | kotlinx)
                                # typescript: interface | type | class | zod
                                # python: pydantic | dataclass
  root_name: UserResponse       # name of the top-level model
  options:
    mapping_annotations: true   # emit @JsonProperty / Field(alias) / @Expose / @SerialName
    naming_strategy: idiomatic  # idiomatic (rename to language convention) | preserve
    nullability: from-sample    # from-sample | all-optional | all-required
    date_detection: true        # ISO-8601 strings -> date/time types
    enum_hint: true             # flag small closed string sets as candidate enums (suggest, not force)
```

# Output

```yaml
model_code:
  - one model type per distinct object shape (root + nested)
  - idiomatic field names + serialization mapping back to the source names
  - collections for repeated JSON array elements / repeated XML child elements
  - XML: attribute vs child-element vs wrapper-list vs text content preserved distinctly
  - notes: every inference ambiguity (nullability, numeric width, empty arrays, enums, mixed content)
```

# Workflow

## Step 1 — Detect format
`auto`: a leading `<` or an XML declaration ⇒ XML; a leading `{` or `[` ⇒ JSON.
Honor an explicit `format` override.

## Step 2 — Parse and infer the schema
Walk the parsed tree; for each object, collect `field -> inferred type`.
- **Primitives**: string / integer / floating / boolean / null.
- **Arrays**: infer the element type by **merging across all elements** — union of keys;
  a key present in some elements but missing in others ⇒ that key is optional/nullable.
- **Nested objects** ⇒ their own model type.
- **Dates**: when `date_detection`, ISO-8601 strings ⇒ date/time types.
- **Enums**: when `enum_hint`, a small closed set of repeated string literals ⇒ *suggest*
  an enum in a note; keep the field as a string unless the user opts in.
- **XML specifics**: attributes ⇒ fields marked `attribute`; child elements ⇒ fields;
  a repeated child element ⇒ a list + detect a wrapper element; text/mixed content ⇒ a
  dedicated `value`/`#text` field; namespaces ⇒ note the prefix.

## Step 3 — Name types and fields
- Nested object at key `profile` ⇒ type `Profile` (or `<Root>Profile` on collision).
- Field names: `idiomatic` ⇒ Java/Kotlin/TS camelCase, Python snake_case; `preserve` ⇒
  keep the source spelling verbatim.
- When the idiomatic name **differs** from the source name, emit the mapping annotation
  (unless `mapping_annotations: false`). When they already match (e.g. snake_case source
  → Python snake_case), **no annotation is needed** — do not add redundant aliases.

## Step 4 — Emit models per target
Follow the mapping matrix below. Delegate nontrivial implementation to the matching
senior-programmer — Java → `spring-senior-programmer`, Kotlin →
`kotlin-senior-programmer`, TypeScript → `typescript-senior-programmer`, Python →
`django-senior-programmer`.

| target | shape | mapping (rename) | XML handling | nullable |
|--------|-------|------------------|--------------|----------|
| **Java** | `record` / `class` / `class+lombok`(`@Data @Builder`) | `@JsonProperty("src")` | `@JacksonXmlProperty(isAttribute=true / localName=…)`, `@JacksonXmlElementWrapper` | wrapper types + `@JsonInclude(NON_NULL)` |
| **Kotlin** | `data class` | `@JsonProperty` (jackson-kotlin) or `@SerialName` (kotlinx) | jackson-dataformat-xml | `T? = null` |
| **TypeScript** | `interface` / `type` / `class` / `zod` | `class` + class-transformer `@Expose({name})` / `@Type(() => Nested)`; `zod` via `z.object` | fast-xml-parser; attributes commonly prefixed | optional `?` |
| **Python** | Pydantic `BaseModel` / `dataclass` | `Field(alias="src")` + `model_config = ConfigDict(populate_by_name=True)` | pydantic-xml or manual | `Optional[T] = None` |

## Step 5 — Report ambiguities
Emit an explicit note for each: empty array (unknown element type), all-null field,
numeric width (int vs long vs decimal), candidate enums, and XML mixed content. Never
silently guess a concrete type for an unknowable field.

# Rules

- Never invent fields not present in the sample; infer types only from observed values.
- A key absent from some array elements ⇒ optional/nullable on the merged element type.
- Empty array or all-null field ⇒ element/field type is unknowable: emit a permissive
  placeholder (`Object` / `unknown` / `Any`) **plus an explicit note** — never guess.
- Idiomatic rename ⇒ always emit the round-trip mapping annotation (unless disabled);
  in `preserve` mode there is no rename, so no annotation is needed.
- XML attributes, child elements, wrapper lists, and text content must stay
  **distinguishable** — do not flatten them into indistinguishable string fields.
- One model type per distinct object shape; dedupe structurally identical nested shapes;
  resolve name collisions with the parent-prefixed name.
- This skill emits **models only**. Use `api-client-generator` (frontend HTTP client),
  `api-generator` (backend endpoints), or `api-spec-generator` (design contract) for
  those — do not generate them here.
- Boundary vs the `api-*` skills: this works from a **concrete serialized sample**; the
  `api-*` skills work from the **api-spec design contract**. Keep them separate.

# Examples

## Example 1 — JSON → Java record (+ Python & TypeScript)

Input:

```yaml
model_request:
  target: { language: java, variant: record }
  root_name: OrderResponse
  payload: |
    {
      "order_id": 1024,
      "status": "PAID",
      "total_amount": 39900,
      "created_at": "2026-07-06T09:30:00Z",
      "customer": { "id": 7, "email": "a@b.com" },
      "items": [
        { "sku": "A-1", "qty": 2, "note": "gift" },
        { "sku": "B-9", "qty": 1 }
      ]
    }
```

Output (Java):

```java
public record OrderResponse(
    @JsonProperty("order_id")     long orderId,
    String status,                              // candidate enum: {PAID} — kept as String
    @JsonProperty("total_amount") long totalAmount,
    @JsonProperty("created_at")   OffsetDateTime createdAt,
    Customer customer,
    List<Item> items
) {
  public record Customer(long id, String email) {}
  public record Item(
      String sku,
      int qty,
      String note                              // optional: absent in 2nd element -> nullable
  ) {}
}
```

Same shape as **Python (pydantic)** — note the source is already snake_case, so Python's
idiomatic names match and **no aliases are needed**:

```python
from datetime import datetime
from pydantic import BaseModel

class Customer(BaseModel):
    id: int
    email: str

class Item(BaseModel):
    sku: str
    qty: int
    note: str | None = None      # absent in one element

class OrderResponse(BaseModel):
    order_id: int
    status: str                  # candidate enum: {"PAID"}
    total_amount: int
    created_at: datetime
    customer: Customer
    items: list[Item]
```

Same shape as **TypeScript (interface)** — interfaces are compile-time only, so the
renames below are documentation; to map `order_id -> orderId` *at runtime*, use the
`class` variant with class-transformer `@Expose({ name: "order_id" })` or the `zod`
variant with `.transform`:

```ts
export interface OrderResponse {
  orderId: number;      // "order_id"
  status: string;       // candidate enum: "PAID"
  totalAmount: number;  // "total_amount"
  createdAt: string;    // ISO-8601 — parse to Date at the boundary
  customer: Customer;
  items: Item[];
}
export interface Customer { id: number; email: string; }
export interface Item { sku: string; qty: number; note?: string; }
```

Notes emitted: `status` is a single-value closed set → candidate enum (kept as String);
`Item.note` nullable (missing in one array element); `order_id` and `Customer.id` widened to
`long` (id convention — future-proof for large key spaces, `number_widening`); `total_amount`
widened to `long` (`number_widening`); `qty` kept `int` (small bounded quantity).

## Example 2 — XML → Java (attribute vs element vs wrapper list)

Input:

```yaml
model_request:
  target: { language: java, variant: record }
  root_name: Order
  payload: |
    <order id="1024" status="PAID">
      <customer><id>7</id><email>a@b.com</email></customer>
      <items>
        <item sku="A-1"><qty>2</qty></item>
        <item sku="B-9"><qty>1</qty></item>
      </items>
    </order>
```

Output (Java, jackson-dataformat-xml):

```java
@JacksonXmlRootElement(localName = "order")
public record Order(
    @JacksonXmlProperty(isAttribute = true) long id,        // attribute
    @JacksonXmlProperty(isAttribute = true) String status,  // attribute
    Customer customer,                                       // child element
    @JacksonXmlElementWrapper(localName = "items")          // wrapper element
    @JacksonXmlProperty(localName = "item")                 // repeated child -> List
    List<Item> items
) {
  public record Customer(long id, String email) {}
  public record Item(
      @JacksonXmlProperty(isAttribute = true) String sku,   // attribute
      int qty                                               // child element
  ) {}
}
```

Notes emitted: `id`/`status`/`sku` are XML **attributes** (not elements); `<items>` is a
**wrapper** around repeated `<item>` elements → `List<Item>`; no text/mixed content found.
