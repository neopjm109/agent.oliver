---
name: audit
description: Short entry point for the audit category. Coordinate the end-to-end document-compliance audit pipeline that checks a target document against a ruleset (policy, regulation, standard, or checklist) and produces a conformance gap report with risk scoring. Use when the goal is assessing a document's compliance, not generating code. Entrypoint of the audit domain. Invoke as '/audit'; delegates to audit-orchestrator.
version: 1.0.0
category: audit
tags:
  - audit
  - entrypoint
model: inherit
invokes:
  - audit-orchestrator
---

# Goal

This is the **short entry point for the `audit` category**. Start here, but let
`audit-orchestrator` do the actual work.

# How to run

1. Understand the user's request and gather the inputs `audit-orchestrator` needs.
2. Run `audit-orchestrator` as a subagent (see the framework delegation rule) so it coordinates the category's sub-skills.
3. Return its result to the user.
