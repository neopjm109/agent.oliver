---
name: scheduler-generator
description: Generate production-ready scheduled tasks for Spring Boot (fixed-rate, fixed-delay, cron, startup) that trigger work while keeping business logic in services or batch jobs.
version: 1.0.0
category: backend
tags:
  - spring-boot
  - scheduler
  - scheduling
  - cron
model: inherit
invokes:
  - spring-senior-programmer
inputs:
  - scheduler_requirements
outputs:
  - scheduler_layer_code
---

# Goal

Generate production-ready scheduled tasks using Spring Scheduling for reliable time-based
execution, keeping scheduling separate from business logic.

Boundary: this skill **owns schedule triggers** (fixed-rate, fixed-delay, cron, startup).
The actual heavy/bulk processing belongs in a service or a Spring Batch job — cross-reference
`batch-generator`. A scheduler here should invoke a service or a batch job, not do the work itself.

# Inputs

```yaml
scheduler_requirements:
  scheduler: CacheCleanupScheduler
  purpose: purge expired cache entries
  trigger: cron            # fixed-rate | fixed-delay | cron | startup
  cron: "0 0 3 * * *"
  timezone: Asia/Seoul
  invokes: CacheCleanupService   # or a batch job
```

# Output

```yaml
scheduler_layer_code:
  - <Name>Scheduler.java     # e.g. CacheCleanupScheduler.java
  - SchedulingConfig.java    # if required
```

# Workflow

## Step 1 — Analyze requirements
Select the scheduling strategy and resolve the trigger (cron/rate/delay/startup).

## Step 2 — Design the trigger
Wire the schedule to the target service or batch job; keep the scheduled method thin.

## Step 3 — Delegate implementation
Delegate the scheduler/config code writing to `spring-senior-programmer`.

## Step 4 — Validate
Verify no overlapping executions, externalized cron, and safe failure handling.

# Rules

- Keep schedulers lightweight: the scheduled method only triggers a service or batch job.
- Never put business logic inside a `@Scheduled` method.
- Prefer cron for calendar-based timing; externalize cron expressions and allow disabling by config.
- Prevent duplicate/overlapping executions; support distributed scheduling when requested.
- Offload heavy or bulk processing to a Spring Batch job — see `batch-generator`.

# Examples

Input:

```yaml
scheduler_requirements: { scheduler: CacheCleanupScheduler, trigger: cron, cron: "0 0 3 * * *", invokes: CacheCleanupService }
```

Output (abridged):

```java
@Component
@RequiredArgsConstructor
public class CacheCleanupScheduler {
    private final CacheCleanupService cacheCleanupService;

    @Scheduled(cron = "${cache.cleanup.cron:0 0 3 * * *}", zone = "Asia/Seoul")
    public void run() {
        cacheCleanupService.purgeExpired();
    }
}
```
