# 테스트 기준 양식 (Test Criteria & Templates)

저사양 LLM 에이전트의 라우팅·스킬 실행·멀티턴(plan_and_run·HITL)을 **프로필(m2·m4)별**로,
**복잡도 1~10**으로 나눠 평가하는 표준 양식이다. 새 평가를 만들거나 회귀를 검증할 때 이 문서를 기준으로 한다.

> 근거 하네스: [`scripts/eval-routing.ts`](scripts/eval-routing.ts) · [`scripts/eval-skills.ts`](scripts/eval-skills.ts) · [`scripts/eval-hitl.ts`](scripts/eval-hitl.ts) · [`scripts/eval-plan-longrun.ts`](scripts/eval-plan-longrun.ts)
> 결과 예시: `results/skill-eval-c1-10-*/` · `results/hitl-eval-*/` · `results/skill-e2e-*/` · `results/eval-*-plan6to8/`

---

## 1. 세 가지 평가 축

| 축 | 하네스 | 대상 | 실행 방식 | 채점 |
|---|---|---|---|---|
| **라우팅 골든** | `eval-routing.ts` | 발화 → 기대 intent | `decideOnly`(스킬 미실행) | intent 일치율 ≥ 0.8 |
| **단일턴 스킬 실행** | `eval-skills.ts` | 각 스킬 1회 실제 실행 | 실제 실행(mutate 는 미리보기까지) | 라우팅 정확 + 실행 성공 + 지연 |
| **멀티턴 plan·HITL** | `eval-hitl.ts` | 계획 수립→진행→커밋, 승인 게이트 | 멀티턴 대화(상태기계) | 턴별 응답 패턴 + 시나리오 통과 |
| **plan 장기완주** | `eval-plan-longrun.ts` | 6~8단계 계획 완주 | 응×N 으로 끝까지 | 분해 정확 + 완주 + **무오버플로** + 체이닝 |

**실행 명령**
```bash
AGENT_PROFILE=m4 npm run eval:routing               # 골든 라우팅(활성 프로필)
AGENT_PROFILE=m4 node --import tsx scripts/eval-skills.ts   # 단일턴
AGENT_PROFILE=m2 node --import tsx scripts/eval-hitl.ts     # 멀티턴 (HITL_LEVELS=1,2,6 로 부분 실행)
AGENT_PROFILE=m4 npm run eval:plan                  # plan 장기완주 정례 스모크(6·8단계, maxSteps=8)
```
- **프로필**: `AGENT_PROFILE=m4|m2` 로 한 프로세스에서 전환(없으면 `settings.yaml` 값). m4=qwen3-8b, m2=gemma3n-e4b.
- **부분 실행**: `eval-hitl.ts` 는 `HITL_LEVELS=1,2,6`, `eval-plan-longrun.ts` 는 `LONGRUN_STEPS=6,8` 처럼 골라 스모크 가능.
- **정례 회귀(필수)**: 6~8단계 확장(`maxSteps>4`)을 건드리는 변경은 `npm run eval:plan` 을 **m4·m2 양쪽**에서 돌려
  **8단계 완주·무오버플로**를 확인한다(회귀 지점: planTokens 비례·priorOutputsBlock 총량예산). 순차 실행(Ollama 경합 방지).

---

## 2. 복잡도 1~10 루브릭

라우팅 난이도 + 생성 깊이 + 오케스트레이션을 종합한 등급. 단일턴/멀티턴 두 렌즈로 매핑한다.

| Lv | 성격 | 단일턴(스킬) 예 | 멀티턴(plan·HITL) 예 |
|---|---|---|---|
| **1** | 결정론/테이블(LLM 최소) | agent_status, chitchat 인사 | 미리보기/되묻기 진입 |
| **2** | 경량 LLM 짧은 응답 | chitchat warm, OOS fallback | 취소/부정 게이트(부작용 없음) |
| **3** | 단일 짧은 생성 | explain_code, translate | 긍정/부정 판정 견고성(질문·가정 배제) |
| **4** | 결정론 조립·감지(미리보기) | run_command, setup_deployment, scaffold | 안전 커밋 완주(격리 temp) |
| **5** | 중간 생성 + 인제스천 | review_code, analyze_document, research | 되묻기 → 값 제공 → 미리보기 |
| **6** | 구조화 생성 | design_system, write_docs, git_artifact | plan 수립 + 체크리스트 |
| **7** | 코드인접 + 파일 산출 | write_tests, convert_document, meeting_minutes | plan 진행 제어(abort/skip/edit/재확인) |
| **8** | 코드 생성(무거움) | change_code(codegen) | plan 단계 실행 후 전진 |
| **9** | 장문 창작 / 계획 | write_proposal, write_story, plan_tasks | mutate 커밋 게이트 / 산출물 체이닝 |
| **10** | 다단계 오케스트레이션 | plan_and_run | 복합(편집+진행+skip+완주) |

**시나리오 개수**: 각 복잡도당 최소 3개(멀티턴은 3~5개 권장). 전 스킬을 최소 1회 커버한다.

---

## 3. 공통 규칙 (모든 축)

1. **부작용 격리**
   - mutate 계열(scaffold_project·change_code·write_tests·run_command)은 **미리보기(승인 게이트)까지만** 실행.
   - 승인("응")으로 실제 커밋하는 케이스는 **격리된 임시 워크스페이스**에서 파일쓰기(editFile/codeFiles)만.
   - scaffold/run_command 의 **실 CLI 실행·네트워크는 승인하지 않는다**(미리보기·취소·질문 게이트까지만).
2. **세션 초기화 후 진행(필수, 단일턴·멀티턴 공통)**: 모든 케이스/시나리오는 **고유 chatId** 를 쓰고,
   **시작 시 반드시 `pipe.reset({ chatId })` 로 세션을 초기화한 뒤** 진행한다. 추가로 실행 전 `.cache/sessions.json`
   을 비우는 것을 권장한다. → 영속 세션 잔여 상태(pending/plan/framework) 누수 차단(누수 시 이전 상태가
   새 케이스로 새어 오탐. 실제로 초기 HITL 실행에서 스모크런과 chatId 충돌로 대량 오탐 발생 → §7).
3. **인제스천**: 파일 기반 스킬(review/analyze/explain/write_tests/convert/meeting)은 **픽스처 워크스페이스**의
   파일을 참조. git_artifact 만 실제 저장소를 워크스페이스로 사용(diff·최근 커밋 컨텍스트).
4. **타임아웃 가드**: 케이스/턴당 상한(예: 240s)을 두되, **타임아웃은 "실패"가 아니라 "미완"으로 해석**한다
   (아래 §7 오탐 주의).

---

## 4. 단일턴 스킬 실행 기준

**케이스 양식**
```ts
interface Case {
  lvl: number;          // 복잡도 1~10
  label: string;        // 스킬/시나리오 라벨
  text: string;         // 사용자 발화
  expect: string;       // 기대 intent
  alt?: string[];       // 모호 경계에서 허용할 대체 intent
  ws?: 'fixture' | 'repo'; // 기본 fixture(임시). 실 저장소 감지 필요 시 repo.
}
```

**채점**
| 마크 | 의미 |
|---|---|
| ✅ | 라우팅 일치(`got === expect` 또는 `alt` 포함) **및** 실행 성공(비어있지 않은 응답, 예외 없음) |
| 🟡 | 실행은 됐으나 라우팅이 다름(기능은 동작, intent 오분류) |
| ❌ | 실행 실패(빈 응답/예외/타임아웃) |

**기록 지표**: 라우팅 정확도, 실행 성공률, 케이스별 지연(s), 출력 문자수, 1줄 미리보기. 복잡도별·전체 요약.

---

## 5. 멀티턴 plan·HITL 기준

**시나리오 양식**
```ts
interface Turn { user: string; intent?: string; inc?: RegExp; exc?: RegExp }
interface Scenario { lvl: number; label: string; ws?: 'fixture'|'repo'; turns: Turn[] }
```
- `intent`: 그 턴 응답의 기대 intent(선택).
- `inc`: 응답에 **포함돼야** 하는 패턴(상태기계 전이 확인).
- `exc`: 응답에 **없어야** 하는 패턴(예: 부작용 커밋 문구 — 질문/취소가 잘못 커밋되지 않았는지).

**상태기계 문구 패턴(채점 기준선)**
| 상태 | 응답 패턴(정규식) |
|---|---|
| 미리보기 진입 | `만들까요|실행할까요|바꿀까요|테스트를 만들까요|파일을 생성` |
| 취소/부정 | `취소했어요|계획을 (취소\|중단)` |
| 커밋 성공(부작용) | `✅ 저장 완료|✅ \d+개 파일 생성|✅ 실행 완료` |
| 계획 수립 | `🎯 목표[\s\S]*할 일` |
| 계획 전진/완료 | `진행할까요|계획 완료|건너뛰|## \d` |
| 계획 재확인(비응답) | `계획 진행 중|진행할까요` |

**턴/시나리오 통과 정의**
- 턴 통과 = `intent` 일치(있으면) **AND** `inc` 매칭(있으면) **AND** `exc` 위반 없음(있으면).
- 시나리오 통과 = 모든 턴 통과.

**핵심 검증 포인트(반드시 포함)**
- 승인 게이트: 미리보기 → `응`=커밋 / `아니오`=취소(부작용 없음) / **질문·가정("실행하면 뭐가 바뀌어?")=커밋 안 함**.
- 계획: 수립(체크리스트) → 진행/건너뛰기/취소/`N번 빼줘`(편집)/비응답 재확인 → 단계 실행 → mutate 커밋 게이트 → 완주.
- 산출물 체이닝: 앞 단계 결과가 다음 단계에 반영되는지(설계 → 코드).
- **장기완주(6~8단계)**: `maxSteps>4` 계획이 목표 수대로 분해되고(폴백 붕괴 없음), 완주하며, num_ctx 를 넘치지 않는지.
  m2(num_ctx 4096)에서의 무오버플로가 특히 중요. → `eval-plan-longrun.ts`.
- **review/verify 계열을 계획 후미에 둘 땐 대상을 발화로 명시**한다. 대상 없는 `review_code` 는 "코드를 붙여넣어 주세요"로
  축약될 수 있다(정상 degrade지만 체이닝 검증엔 무의미). "앞서 정리한 설계·문서를 대상으로 리뷰"처럼 산출물을 못박아 준다.

---

## 6. 프로필 비교 관점(m2 vs m4)

동일 케이스를 두 프로필로 돌려 **라우팅 동일성 · 속도 · 생성 품질 · 계획 분해**를 대조한다.

| 관점 | 확인할 것 |
|---|---|
| 라우팅 | 두 프로필 정확도 동일해야(경량 라우터 가정) |
| 속도 | 복잡도별 지연. m4(8B)는 장문/계획에서 크게 느릴 수 있음 |
| 품질 | 출력 길이·정합. m4 가 항상 우위는 아님(예: review 반사, 분해 등) |
| 계획 분해 | 다작업 요청이 단계로 분해되는지(m2 과소분해 주의) |

---

## 7. 결과 판정 — 실제 이슈 vs 하네스 아티팩트

"실패"를 곧바로 버그로 보지 말고 아래를 구분한다.

- **실제 이슈**: 두 프로필 공통 오분류(라우팅 결함), 승인 게이트 오작동, 계획 상태기계 오류.
- **하네스 아티팩트(오탐)** — 다음은 하네스 문제이지 제품 결함이 아님:
  - **타임아웃 오탐**: 느린 생성이 상한을 넘겨 "실패"로 찍혔으나 이어진 턴은 정상 → 성능 이슈로 재분류.
  - **계획 단계수 가정**: `N번 빼줘`류가 실패해도 계획이 1단계면 정상(과소분해는 별개 이슈).
  - **세션 누수**: chatId 충돌로 이전 pending/plan 이 새 케이스로 샘 → `pipe.reset`/고유 chatId 로 해소.
- 판정 결과는 실제/아티팩트로 **분류표**를 만들고, 실제 이슈는 재현 발화·기대·실제를 명시한다.

---

## 8. 결과 산출물 규칙

- **한 번의 테스트 세션(단일턴 + 멀티턴)은 한 폴더로 묶는다**: `results/eval-<YYYYMMDD>[-tag]/`
  (예: `results/eval-20260729-postfix/`). 축·프로필별로 폴더를 쪼개지 않는다(한 세션 = 한 폴더). `results/` 는 gitignore.
- 파일:
  - `run.log` — **단일 로그에 축을 섹션으로 나눠 함께 쌓는다**(케이스별 1줄 미리보기 포함):
    - `## 단일턴 (eval-skills)` — m4 → m2
    - `## 멀티턴 (eval-hitl)` — m4 → m2
  - `COMPARISON.md` — 단일턴·멀티턴 각 요약표 + 복잡도별 통과/지연 + 발견(실제 vs 아티팩트) + 결론.
- 회귀로 굳힐 항목은 **골든셋(`eval-routing.ts`)이나 유닛 테스트(`src/**/*.test.ts`)로 승격**해 `npm test`/`eval:routing` 에 편입한다.

---

## 9. 복사용 템플릿

**단일턴 케이스**
```ts
{ lvl: 5, label: 'review_code', text: 'src/foo.ts 리뷰해줘', expect: 'review_code' },
```

**멀티턴 시나리오(HITL 취소 게이트)**
```ts
{ lvl: 2, label: 'scaffold→아니오 취소', turns: [
  { user: '스프링 프로젝트 shopmall 만들어줘', inc: /만들까요/ },
  { user: '아니오', inc: /취소했어요/, exc: /✅ 실행 완료/ }, // 부작용 없어야
] },
```

**멀티턴 시나리오(plan 수립→진행)**
```ts
{ lvl: 8, label: 'plan→응(1단계 실행)→전진', turns: [
  { user: '주문 도메인 설계하고 API 문서까지 작성해줘', intent: 'plan_and_run', inc: /🎯 목표[\s\S]*할 일/ },
  { user: '응', inc: /진행할까요|계획 완료|## \d/ },
] },
```
