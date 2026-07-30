# Human-in-the-Loop 오케스트레이터 — 재설계 스펙

> **목적**: `plan_and_run` 을 "계획 1회 확인 후 전(全)단계 자동 실행"에서
> **"계획 → 사람이 한 단계씩 승인하며 진행, 에이전트는 진행상태·산출물만 유지"**로 바꾼다.
> **핵심 착상**: 오케스트레이터에서 실행 로직을 빼내 **단일턴과 plan 스텝이 공유하는
> `executeStep` 프리미티브**로 승격한다. 오케스트레이터는 그 위의 얇은 *지휘자*만 된다.

---

## 0. 배경

현행 [orchestrator.ts](src/skills/orchestrator.ts) 의 정체성 = **auto-loop**:
`buildPlan → pendingPlan → (사용자 "응") → executePlan 이 for 루프로 전 단계 실행`.
저사양(4B/8B)에서 실패하는 지점이 바로 이 for 루프다 — 계획 JSON 런어웨이·코드 절단·틀린
로직이 **사람 개입 없이 다음 단계로 번진다**(phase3 실측).

또한 오케스트레이터가 `runScaffold`/`runCodeGen` 을 **자체 보유**해([orchestrator.ts:221](src/skills/orchestrator.ts#L221),
[:249](src/skills/orchestrator.ts#L249)) 단일턴 경로(pipeline 의 scaffold/edit)와 **생성 로직이 두 벌**로
갈라져 있다 → "plan 스텝 change_code" 와 "단독 change_code" 의 품질·동작이 다르다. 이것이
"orchestrator 역할이 애매"의 근원이다.

---

## 1. 설계 불변식

1. **오케스트레이터는 단계를 자동 연속 실행하지 않는다.** 매 단계는 사람의 승인으로만 전진한다.
2. **부작용(파일 쓰기·명령 실행)은 항상 미리보기 → 승인 → 커밋** 2단계를 거친다.
3. **생성 로직은 한 곳(`executeStep`)에만 존재한다.** 단일턴이든 plan 스텝이든 같은 코드가 돈다.
4. **오케스트레이터가 드는 상태는 `{plan, cursor, outputs}` 뿐.** 실제 실행은 프리미티브가 한다.
5. **"안내"가 아니라 "생성".** change_code/기능추가는 마크다운 조언이 아니라 실제 파일을 만든다.

---

## 2. 핵심 — `executeStep` 프리미티브

한 단계(=한 intent 실행)를 **두 국면(phase)**으로 나눈다. 현행이 scaffold·edit 에만 흩어 놓은
"preview→commit" 패턴을 **모든 단계에 균일하게** 일반화한 것이다.

```ts
// 단계는 두 종류
type StepKind = 'produce' | 'mutate';
//  produce = 텍스트 산출물, 비파괴 저장(.md). 게이트 불필요.
//            design_system · review_code · write_docs · research_topic · git_artifact ·
//            write_proposal · plan_tasks · analyze_document · story · game
//  mutate  = 파괴적 부작용(소스파일 쓰기·CLI 실행). 커밋 게이트 필수.
//            scaffold_project · change_code(기능추가 포함)

interface StepInput {
  intent: Intent;
  instruction: string;   // 이 단계 지시(단일턴이면 userText, plan 이면 step.instruction)
  ctx: Context;          // outputs(체이닝) · workspace · session · slots
}

// 국면 1: 준비 — 생성만 한다. 파괴적 쓰기/실행은 아직 안 한다.
function prepareStep(inp: StepInput): Promise<StepPrepared>;

type StepPrepared =
  | { kind: 'produce'; text: string; artifactBody?: string }        // 즉시 완료 가능
  | { kind: 'mutate';  preview: string; commit: MutateCommit };     // 커밋 대기

// 국면 2: 커밋 — 승인 후 실제 쓰기/실행.
function commitStep(commit: MutateCommit, ctx: Context): Promise<StepCommitted>;

interface StepCommitted { text: string; artifacts: string[] }       // 저장/실행된 경로들

// mutate 의 실체 — 이 두 가지가 전부다.
type MutateCommit =
  | { type: 'exec';       argv: string[]; cwd: string; label: string; framework: string }
  | { type: 'writeFiles'; files: { path: string; content: string }[]; baseDir: string };
```

- **produce**: `prepareStep` 이 곧 LLM 생성. `text` 를 즉시 보여주고 `.md` 로 비파괴 저장(현행
  `writeArtifact`). 승인 게이트 없음 — 결과 보여주고 "다음?"만 묻는다.
- **mutate**: `prepareStep` 이 **명령을 조립**(scaffold)하거나 **파일 내용을 생성**(코드생성/편집)한
  뒤 `preview`(diff·생성될 파일 목록·실행할 명령)를 반환. **디스크는 아직 안 건드린다.**
  승인되면 `commitStep` 이 `runCommand`/`overwriteFile`(+백업·가드·import 스텁·tsc 검증) 실행.

> `commitStep(writeFiles)` 안으로 현행 `runCodeGen` 의 저장 가드(중복확장자·라우터혼용·설정보호·
> import 스텁·`verifyGeneratedProject`)와 `runScaffold` 를 그대로 흡수한다. `runCodeGen`/`runScaffold`
> 는 오케스트레이터에서 **삭제**되고 여기로 이동한다.

---

## 3. 오케스트레이터 = 지휘자

실행 루프가 빠지면 오케스트레이터의 역할은 **계획 수립 + 커서 + 단계별 게이트 + 산출물 체이닝**
넷으로 선명해진다. 상태는 세션의 확장된 `pendingPlan` 하나에 담는다.

```ts
interface StagedPlan {
  goal: string;
  steps: PlanStep[];
  cursor: number;                 // 다음 실행할 단계 인덱스(0-based)
  outputs: StepOutput[];          // 완료된 단계 산출물(다음 단계 prepareStep 에 체이닝)
  stage: 'awaiting_advance'       // "N번 진행할까요?" 대기
       | 'awaiting_commit';       // mutate 미리보기 후 "적용할까요?" 대기
  preview?: { text: string; commit: MutateCommit };  // stage=awaiting_commit 일 때만
}
```

### 상태 기계 (pipeline 이 라우팅 이전에 가로챈다)

`session.pendingPlan` 이 있으면:

**stage = `awaiting_advance`** (다음 단계 진행 여부를 묻는 중):
| 입력 | 동작 |
|---|---|
| "아니오 / 그만 / 취소" | 계획 폐기(`pendingPlan=undefined`), 완료된 산출물 요약 반환 |
| "N번 빼줘 / 제외" | `steps` 에서 해당 단계 제거 후 재렌더(현행 편집 로직 재사용) |
| "건너뛰기 / skip" | `cursor++` → 다음 단계 advance 렌더(또는 완료) |
| **"응 / 다음 / 그대로"** | `prepareStep(steps[cursor])` 호출 → **아래 분기** |

"응" 후 `prepareStep` 결과 분기:
- `produce` → 산출물 저장 + `outputs.push` + `cursor++` → **결과 텍스트 + 다음 단계 advance 프롬프트**
  를 한 응답에 담아 반환(stage 유지). 게이트 없이 흐른다.
- `mutate` → `stage='awaiting_commit'`, `preview=...` 저장 → **미리보기(diff/파일목록/명령) +
  "적용하고 다음으로 갈까요? (응 / 다시 / 건너뛰기)"** 반환.

**stage = `awaiting_commit`** (mutate 미리보기 후 커밋 대기):
| 입력 | 동작 |
|---|---|
| "응 / 적용" | `commitStep(preview.commit)` → `outputs.push` + `cursor++` + `stage='awaiting_advance'` → "✅ 완료" + 다음 advance 프롬프트 |
| "다시 / 수정: …" | 같은 `cursor` 로 `prepareStep` 재호출(사용자 보정 지시 반영) → 새 미리보기 |
| "아니오 / 건너뛰기" | preview 폐기, `cursor++`, `stage='awaiting_advance'` → 다음 단계로 |

`cursor >= steps.length` 이면 → `pendingPlan=undefined`, **전체 산출물·저장 파일 요약** 반환.

> 체이닝: `prepareStep` 은 `ctx.outputs`(=완료된 `outputs`)를 프롬프트에 주입한다. 현행
> MarkdownSkill 의 prior 주입·runCodeGen 의 `[이전 단계 산출물]` 블록과 동일 메커니즘.

---

## 4. 단일턴과의 통합 — 같은 프리미티브

단일 요청도 **같은 `prepareStep`/`commitStep`** 을 탄다. 다른 점은 plan 커서 래퍼가 없다는 것뿐.

```ts
// 단일턴 mutate 커밋 대기(플랜 밖). inPlan=false 로 커밋 후 그냥 종료.
session.pendingStepCommit?: { commit: MutateCommit; preview: string }
```

- **단일턴 produce** (design/review/docs/research…): `prepareStep` → 텍스트 즉시 반환. (현행
  `runtime.execute` 를 얇게 감싼 것 = 사실상 동작 동일.)
- **단일턴 mutate** (scaffold / change_code): `prepareStep` → 미리보기 반환 + `pendingStepCommit`
  세팅. 다음 턴 "응" → `commitStep` → 완료(커서 전진 없음).

⇒ 현행에 흩어진 `session.pending`(scaffold argv) + `session.pendingEdit`(파일 덮어쓰기)이
**`pendingStepCommit` 하나로 통합**된다. plan 안의 커밋은 `pendingPlan.stage='awaiting_commit'`,
plan 밖의 커밋은 `pendingStepCommit` — 커밋 로직(`commitStep`)은 공유, 커밋 후 처리(커서 전진 vs
종료)만 분기.

---

## 5. 턴 흐름 예시

요청: **"스프링 만들고 CRUD 코드 짜고 리뷰까지 해줘"**

```
[턴1] buildPlan → pendingPlan{cursor:0, stage:awaiting_advance}
      🎯 목표: 스프링 + CRUD + 리뷰
      1. [ ] 스프링 스캐폴드      (scaffold_project · mutate)
      2. [ ] CRUD 코드 생성       (change_code · mutate)
      3. [ ] 생성 코드 리뷰       (review_code · produce)
      → 1번부터 시작할까요? (응 / "2번 빼줘" / 아니오)

[턴2] "응" → prepareStep(1)=mutate{exec: create-... } → stage=awaiting_commit
      1번: 아래 명령을 실행합니다  ·  `gradle init …` (또는 start.spring.io)
      적용하고 진행할까요? (응 / 다시 / 건너뛰기)

[턴3] "응" → commitStep(exec) → cursor=1, stage=awaiting_advance
      ✅ 1번 완료 — myapp/ 생성됨
      → 2번(CRUD 코드 생성) 진행할까요? (응 / 1번 다시 / 건너뛰기)

[턴4] "응" → prepareStep(2)=mutate{writeFiles: [...] } (1번 구조·설계 체이닝)
      → stage=awaiting_commit
      2번: 아래 3개 파일을 생성/수정합니다
        + src/.../UserController.java (신규)
        ~ src/.../AppModule …        (수정)
      적용할까요? (응 / 다시 / 건너뛰기)

[턴5] "응" → commitStep(writeFiles) [백업·가드·tsc/컴파일 검증] → cursor=2
      ✅ 2번 완료 — 3개 파일, 컴파일 통과
      → 3번(리뷰) 진행할까요? (응 / 건너뛰기)

[턴6] "응" → prepareStep(3)=produce → 리뷰 텍스트 즉시 + .md 저장 → cursor=3(끝)
      ## 리뷰 …
      🎉 계획 완료. 저장한 파일: …
```

각 mutate 단계 뒤 사람이 실제 결과를 보고 **"다시"로 재생성**할 수 있어, 4B 코드생성의 절단·
`eval()`·틀린 로직이 다음 단계로 번지기 전에 걸린다(=human-in-the-loop 의 최대 명분).

---

## 6. change_code = 생성 (안내 폐기)

`add_capability` 를 `change_code` 로 흡수하되, **둘 다 실제 파일 생성**으로 통일한다(마크다운
조언 모드 폐기 — `capability-advisor` 는 생성 실패 폴백으로만 남기거나 삭제).

`prepareStep(change_code)` 분기:
- 발화에 **대상 파일 경로/인라인 코드**가 있으면 → 그 파일 편집 `writeFiles`(단일 파일, 현행
  `editFile`+diff). 인라인 코드 감지 추가(중괄호·`function`/`def`/들여쓰기 신호).
- 경로 없이 **"추가/붙여/넣어" 등 기능추가** 요청이면 → 해당 기능의 **새 파일들 생성**
  `writeFiles`(다중 파일, 현행 `runCodeGen` 로직). 세션 `framework`·프로젝트 구조 주입.
- 어느 쪽이든 `kind='mutate'` → 미리보기 후 커밋. **안내 텍스트로 끝나지 않는다.**

---

## 7. 세션 상태 변경 요약

| 현행 | 신규 |
|---|---|
| `pending`(scaffold argv 커밋 대기) | → `pendingStepCommit{commit:{type:'exec'}}` 로 통합 |
| `pendingEdit`(파일 덮어쓰기 대기) | → `pendingStepCommit{commit:{type:'writeFiles'}}` 로 통합 |
| `pendingPlan{goal,steps}` | → `+cursor +outputs +stage +preview` 확장 |
| `awaitingScaffoldName` / `awaitingEditPath` | 유지(되묻기) — 이름/경로 확보 후 `prepareStep` 으로 진입 |

---

## 8. 현행 코드 → 신규 매핑 (마이그레이션)

| 현행 | 신규 위치 |
|---|---|
| `orchestrator.runScaffold` | → `commitStep(type:'exec')` + `prepareStep` 의 scaffold 조립 |
| `orchestrator.runCodeGen` | → `prepareStep`(생성) + `commitStep(type:'writeFiles')`(가드·스텁·검증) |
| `orchestrator.executePlan`(for 루프) | → **삭제**. 상태기계(§3)가 대체 |
| `orchestrator.buildPlan` / `heuristicPlan` / `renderPlan` | 유지(+`cursor/outputs/stage` 초기화). heuristic 의 `check_quality`→`review_code` 교체 |
| pipeline `pendingEdit` 블록([:301](src/pipeline.ts#L301)) | → `pendingStepCommit` 처리로 통합 |
| pipeline `pending`(scaffold) 블록([:245](src/pipeline.ts#L245)) | → `pendingStepCommit` 처리로 통합 |
| pipeline `pendingPlan` 블록([:272](src/pipeline.ts#L272)) | → §3 상태기계로 확장 |
| pipeline 단일턴 scaffold/change_code 분기([:432](src/pipeline.ts#L432), [:451](src/pipeline.ts#L451)) | → `prepareStep` 호출로 대체 |

`executeStep`(`prepareStep`+`commitStep`)의 새 위치: `src/core/step.ts`(신규) 또는
`src/skills/orchestrator.ts` 상단. runtime·executor·llmClient 를 주입받는 순수 함수 묶음.

---

## 9. 엣지 케이스

- **생성 실패(LLM JSON 오류·절단)**: `prepareStep` 이 에러 텍스트 반환, `mutate` 아님 → 커밋 없음.
  plan 이면 `awaiting_advance` 로 남겨 "다시 / 건너뛰기" 유도. (현행 절단 거부 로직 유지)
- **응/아니오 아닌 입력이 게이트 중 도착**: 현행처럼 게이트 해제 후 새 발화로 정상 처리하지 말고,
  plan 진행 중에는 **재확인 프롬프트**를 다시 낸다(계획 이탈 방지). 단, "그만/취소"는 항상 존중.
- **mutate 단계 커밋 거부 후**: 해당 단계 산출물이 없으므로 뒤 단계 체이닝에서 빠진다(정상 degrade).
- **단일턴 produce 는 게이트 0** — 즉답 유지(잡담·조사·리뷰). 부작용 있는 것만 게이트.

---

## 10. 구현 순서

1. `MutateCommit` 타입 + `commitStep`(exec/writeFiles) — 현행 runScaffold/runCodeGen 이식, 단위 테스트.
2. `prepareStep`(produce/mutate 분기) — runtime.execute·editFile·codegen 생성부 이식.
3. pipeline 단일턴을 `prepareStep`/`pendingStepCommit` 로 전환 → 기존 scaffold/edit 회귀 테스트 통과.
4. `pendingPlan` 확장 + §3 상태기계로 `executePlan` 대체 → human-in-the-loop plan 종단 테스트.
5. `add_capability`→`change_code` 흡수(생성 모드) + intents.yaml 재정립(17개) 반영.
6. 감사 로그 훅(단계별 `decided_by`·latency·`human_action`) — 나중에 어느 단계를 상위 모델로
   올릴지 데이터로 판단(agent-design-spec §6 와 연결).

**2번(단일 스텝 실행)을 먼저 단단히** — 여기서 생성·커밋이 한 벌로 모이면 plan 은 그 위 얇은
상태기계일 뿐이다. 현행 auto-loop 를 지우기 전에 프리미티브부터 세운다.
