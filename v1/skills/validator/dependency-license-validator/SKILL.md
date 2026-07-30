---
name: dependency-license-validator
description: Statically validate backend (Gradle) and Node/frontend (pnpm) dependencies for known CVEs, license compatibility, pinned versions, and duplicates, returning a pass/fail/inconclusive result. The CVE (DL-01) and license (DL-02) gates require a vulnerability data source and a license policy respectively; when either is absent the run is inconclusive (not pass), so a missing feed never reads as a clean bill. Run after code generation, before review.
version: 1.0.0
category: validator
tags:
  - validation
  - dependencies
  - security
  - license
  - supply-chain
model: inherit
invokes: []
inputs:
  - generated_backend_artifacts
  - generated_frontend_artifacts
  - policy
outputs:
  - validation_result
---

# Goal

Statically validate the project's declared dependencies (Spring Boot / Gradle and Node / pnpm)
for supply-chain and compliance risks: known CVEs, license compatibility against policy, unpinned
versions, and duplicate/conflicting versions. This skill **only analyzes** manifests — it never
modifies build files or upgrades dependencies. Failures are reported for the remediation loop.

# Inputs

Validated inputs (produced upstream): `generated_backend_artifacts`, `generated_frontend_artifacts`,
`policy`, and `vuln_source` (a vulnerability/advisory data source or its results).

The two error-severity gates each depend on external data: **DL-01 requires `vuln_source`** (an
advisory feed/scan) and **DL-02 requires `policy`** (the license allowlist/denylist). The static
checks (DL-03 pinning, DL-04 duplicates, DL-05 release age) run from the manifests alone and need
neither. When `vuln_source` or `policy` is missing, the dependent gate is reported `unknown` and the
run is `inconclusive` — never a silent `pass` (see Pass/Fail Criteria).

# Scope

- Backend: `build.gradle` / lockfile dependency versions and licenses
- Node/frontend: `package.json` / `pnpm-lock.yaml` dependency versions and licenses (pnpm is the
  preferred manager; lockfile-driven, so `package-lock.json` / `yarn.lock` are read if present)
- Cross-cutting: version pinning, duplicate/conflicting versions, disallowed licenses

# Checks

| id | check | severity |
|----|-------|----------|
| DL-01 | No dependency with a known critical/high CVE | error |
| DL-02 | No license that violates the policy allowlist (e.g. GPL in a proprietary product) | error |
| DL-03 | Direct dependencies are version-pinned (no floating `+` / `latest` / `^` on criticals) | warning |
| DL-04 | No duplicate/conflicting versions of the same library | warning |
| DL-05 | Dependency last release within policy.max_release_age (flags likely-abandoned packages) | warning |

# Pass/Fail Criteria

Verdict precedence: **fail** > **inconclusive** > **pass**.

- **fail**: one or more `error`-severity findings (a real CVE hit or a policy-violating license).
- **inconclusive**: no errors found, but an error-severity gate could not be evaluated —
  `vuln_source` absent (DL-01 `unknown`) and/or `policy` absent (DL-02 `unknown`). The static
  checks still ran, but the supply-chain gate is **not** a clean bill and must not be treated as
  `pass`. Report which gate(s) were `unknown`.
- **pass**: zero `error` findings AND both DL-01 and DL-02 were actually evaluated (source + policy
  present). `warning` findings are reported but do not fail the run.

Never return `pass` when a required data source is missing — that is exactly the false-clean this
verdict guards against.

# Output Schema

```yaml
validation_result:
  status: pass | fail | inconclusive
  errors:
    - { id: string, dependency: string, version: string, message: string }
  warnings:
    - { id: string, dependency: string, version: string, message: string }
  unevaluated:                       # gates that could not run (drives `inconclusive`)
    - { id: DL-01 | DL-02, reason: "missing vuln_source | missing policy" }
  metrics:
    backend_deps: int
    frontend_deps: int
    error_count: int
    warning_count: int
    cve_source: available | unknown
    license_policy: provided | absent
```

# Examples

Input: generated backend `build.gradle` (32 deps) + frontend `package.json` (57 deps) + policy `{ allow: [MIT, Apache-2.0, BSD-3-Clause], deny: [GPL-3.0] }`.

Output:

```yaml
validation_result:
  status: fail
  errors:
    - { id: DL-02, dependency: some-gpl-lib, version: 2.1.0, message: "GPL-3.0 violates policy allowlist" }
  warnings:
    - { id: DL-03, dependency: axios, version: "^1", message: "floating range on HTTP client; pin exact version" }
  metrics: { backend_deps: 32, frontend_deps: 57, error_count: 1, warning_count: 1, cve_source: available, license_policy: provided }
```

Input: generated backend `build.gradle` (8 deps), no frontend, **no `vuln_source` and no `policy`**.

Output (the static checks ran, but neither error-gate could be evaluated → not a clean pass):

```yaml
validation_result:
  status: inconclusive
  errors: []
  warnings:
    - { id: DL-04, dependency: flyway, version: "n/a", message: "flyway-core + flyway-mysql are complementary; no conflict" }
  unevaluated:
    - { id: DL-01, reason: "missing vuln_source" }
    - { id: DL-02, reason: "missing policy" }
  metrics: { backend_deps: 8, frontend_deps: 0, error_count: 0, warning_count: 0, cve_source: unknown, license_policy: absent }
```
