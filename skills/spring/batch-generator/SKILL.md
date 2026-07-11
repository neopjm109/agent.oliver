---
name: batch-generator
description: Generate production-ready Spring Batch bulk-processing jobs (Job, Step, Reader, Processor, Writer, Listeners) for large datasets, following the testing pyramid and restartability.
version: 1.0.0
category: backend
tags:
  - spring-boot
  - spring-batch
  - batch
  - bulk-processing
model: inherit
invokes:
  - spring-senior-programmer
inputs:
  - batch_requirements
outputs:
  - batch_layer_code
---

# Goal

Generate production-ready Spring Batch jobs for bulk processing of large datasets: Job,
Step, Reader, Processor, Writer, and listeners, keeping business logic inside processors or
dedicated services.

Boundary: this skill defines the **bulk-processing job** (what work is done and how). It
does not own scheduling — the schedule trigger that launches a job belongs to
`scheduler-generator`. Cross-reference `scheduler-generator` when the job must run on a schedule.

# Inputs

```yaml
batch_requirements:
  batch: InactiveUserBatch
  purpose: deactivate users inactive for 365 days
  type: chunk           # chunk | tasklet
  input: mariadb
  output: mariadb
  chunk_size: 500
```

# Output

```yaml
batch_layer_code:
  - <Name>JobConfig.java
  - Reader / Processor / Writer
  - JobExecutionListener / StepExecutionListener   # if required
```

# Workflow

## Step 1 — Analyze requirements
Choose chunk vs tasklet and the input/output sources.

## Step 2 — Design Job and Step
Separate Reader (read only), Processor (transform/business rule), and Writer (persist).

## Step 3 — Delegate implementation
Delegate the job/step/reader/processor/writer code writing to `spring-senior-programmer`.

## Step 4 — Validate
Verify restartability, chunk transaction boundaries, and skip/retry policies.

# Rules

- One Job represents one business process; keep Reader/Processor/Writer responsibilities separate.
- Reader reads only; Processor holds transformation/business logic; Writer persists in batches.
- Use chunk processing and paging readers for large datasets; never load all data into memory.
- Support skip/retry policies and execution listeners when requested.
- Do not generate schedule triggers here — the launching schedule is `scheduler-generator`'s responsibility.

# Examples

Input:

```yaml
batch_requirements: { batch: InactiveUserBatch, type: chunk, chunk_size: 500 }
```

Output (abridged):

```java
@Configuration
@RequiredArgsConstructor
public class InactiveUserJobConfig {
    @Bean
    public Job inactiveUserJob(JobRepository repo, Step step) {
        return new JobBuilder("inactiveUserJob", repo).start(step).build();
    }

    @Bean
    public Step inactiveUserStep(JobRepository repo, PlatformTransactionManager tx,
                                 ItemReader<User> reader, ItemProcessor<User, User> processor,
                                 ItemWriter<User> writer) {
        return new StepBuilder("inactiveUserStep", repo)
            .<User, User>chunk(500, tx)
            .reader(reader).processor(processor).writer(writer)
            .build();
    }
}
```
