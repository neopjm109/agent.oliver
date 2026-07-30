---
name: test-validator
description: Validate generated tests for coverage vs the plan, presence of tests per generated component, and assertion quality heuristics, returning a structured pass/fail result. Run after code generation, before review.
version: 1.0.0
category: validator
tags:
  - validation
  - testing
  - coverage
  - quality
model: inherit
invokes: []
inputs:
  - generated_artifacts
  - generated_tests
  - test_plan
outputs:
  - validation_result
---

# Goal

Statically validate the generated test suite against the plan and the generated
components. This skill **only analyzes** — it never modifies code and never
executes tests. Findings are reported for the remediation loop.

# Inputs

Validated inputs (produced upstream): `generated_artifacts`, `generated_tests`, `test_plan`.

# Scope

- Coverage vs plan: every test scenario listed in the plan has a corresponding test
- Presence: every generated component of a testable type has at least one test
- Assertion quality heuristics (tests actually assert, not just execute)
- Test isolation basics (no shared mutable state / order dependence signals)

# Checks

| id | check | severity |
|----|-------|----------|
| TE-01 | Every test scenario declared in the plan has a matching test case | error |
| TE-02 | Every generated controller/service/domain class has an associated test file | error |
| TE-03 | Every generated test contains at least one assertion (no assertion-free tests) | error |
| TE-04 | No test is empty, skipped, or permanently disabled without justification | error |
| TE-05 | Assertions check specific values/behavior, not only `assertNotNull`/truthiness | warning |
| TE-06 | Error/edge-case paths from the plan are covered, not only happy paths | warning |
| TE-07 | Tests avoid shared mutable static state that implies execution-order coupling | warning |

# Pass/Fail Criteria

- **pass**: zero `error`-severity findings.
- **fail**: one or more `error` findings. `warning` findings do not fail the run but are reported.

# Output Schema

```yaml
validation_result:
  status: pass | fail
  errors:
    - { id: string, file: string, message: string }
  warnings:
    - { id: string, file: string, message: string }
  metrics:
    planned_scenarios: int
    covered_scenarios: int
    components_with_tests: int
    components_total: int
    error_count: int
    warning_count: int
```

# Examples

Input: generated backend for `user-management` + test plan with 8 scenarios.

Output:

```yaml
validation_result:
  status: fail
  errors:
    - { id: TE-01, file: test_plan, message: "scenario 'reject duplicate email' has no matching test" }
    - { id: TE-02, file: UserService.java, message: "no test file for generated service" }
    - { id: TE-03, file: UserControllerTest.java, message: "test 'createUser_returns201' has no assertion" }
  warnings:
    - { id: TE-05, file: UserRepositoryTest.java, message: "only assertNotNull used; assert field values" }
  metrics:
    planned_scenarios: 8
    covered_scenarios: 6
    components_with_tests: 4
    components_total: 5
    error_count: 3
    warning_count: 1
```
