---
name: codegen
description: Short entry point for the codegen category. From a concrete JSON or XML API-response payload, generate idiomatic typed models (DTO / class / interface) in the requested language (Java · Kotlin · TypeScript · Python) with serialization mapping so field-name and XML attribute/element/wrapper differences round-trip correctly. Invoke as '/codegen'; delegates to payload-model-generator.
version: 1.0.0
category: codegen
tags:
  - codegen
  - entrypoint
model: inherit
invokes:
  - payload-model-generator
---

# Goal

This is the **short entry point for the `codegen` category**. Start here, but let
`payload-model-generator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `payload-model-generator` needs
   (the sample JSON/XML payload and the target language).
2. Run `payload-model-generator` as a subagent (see the framework delegation rule) so it
   generates the typed models and delegates to the matching language senior-programmer.
3. Return its result to the user.
