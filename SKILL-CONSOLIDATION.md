# 스킬 통합 설계 근거 (v2) — ⏸️ 역사 기록(동결)

> **이 문서는 v2/v2.1 통합 시점의 근거·이행 기록이다(동결 — 현행 수치로 유지보수하지 않는다).**
> 본문의 개수·명칭은 **당시 기준**이며 현행과 다르다(예: 이후 v3에서 `capability-advisor`→`change_code`,
> `quality-checker`→`review_code` 개명, `agent_status` intent 폐지, 계획 단계 상한 설정화 등).
> **현행 카탈로그·수치는 [SKILLS-INVENTORY.md](SKILLS-INVENTORY.md)**, 런타임 설계는 [ARCHITECTURE.md](ARCHITECTURE.md),
> 오케스트레이터는 [hitl-orchestrator-spec.md](hitl-orchestrator-spec.md)를 보라. 이 문서는 "왜 이렇게 갔나"만 남긴다.

24B 오케스트레이터에서 이식한 스킬·intent 층을 **소형 모델(2B~7B)용으로 백지 재설계**한 근거와
전환 기록. (수치는 당시 기준 — 상단 동결 안내 참조.)

---

## 1. 문제 진단 — 왜 다중 노드 DAG 가 lite 에서 무너지나

v1 은 `intent → 다중 노드 DAG`(예: `build_spring: [initializer, domain, api, test]`)였다.
그러나 lite 런타임은:

1. **산출물 체이닝을 안 한다.** `MarkdownSkill` 은 다음 스킬에 앞 스킬의 *이름*만 넘긴다(출력 텍스트 X).
2. **마지막 노드 텍스트만 반환한다.** 앞 노드 출력은 전부 버려진다.
3. **파일을 안 쓴다.** 순수 텍스트 in/out.

→ 다중 노드 DAG 는 중간 산출물이 소멸해 **원리적으로 동작하지 않았다.** api-generator 는 domain-generator
결과를 못 본 채 눈 감고 생성하고, 사용자는 test-generator 텍스트 한 덩어리만 받았다. 게다가 활성
스킬 상당수가 죽은 참조(`invokes:`, YAML in/out 계약, 사라진 스킬 링크)를 가진 24B 포맷이었다.

> 다단계 분해는 24B 의 일관성·추적성을 위한 것. 소형 모델은 이득이 없고, lite 런타임은 애초에
> 그 분해를 실행하지 못한다.

> **(v2.1)** 이후 세 결함(체이닝 없음·마지막만 반환·파일 안 씀)을 정면으로 고쳐, **흐름을 코드가
> 통제하는** `PlanOrchestrator` 로 멀티스텝을 안전하게 부활시켰다 — §6. 핵심은 "모델이 순서를
> 정하는 DAG"가 아니라 "코드가 배선하고 모델은 각 단계 내용만" 이라는 점(원칙 불변).

---

## 2. 재설계 원칙

| 원칙 | 내용 |
|---|---|
| **기본 1 intent → 1 skill → 1 호출** | 모델이 순서를 정하는 정적 DAG 폐기. 변형은 `slot` enum. 복합은 `PlanOrchestrator`(§6). |
| **스킬 = 짧은 출력전용 프롬프트** | ~30~50줄, 한국어, YAML/메타/머리말 금지. |
| **라우팅 표면 최소화** | intent 22개(당시). 프레임워크 세부는 슬롯으로. |
| **검증된 배관 보존** | 라우터·분류기·extractor·session·soul·전송은 그대로. 깨진 실행모델만 교체. |
| **코드생성 = 안내 + 확인 후 실제 실행** | 명령을 코드가 결정론 조립(오타 0) → 확인 → `execFile` 실행(화이트리스트). |

---

## 3. 통합 결과 (스킬 ~150 → 25)

| 구 스킬군 | 개수 | v2 |
|---|---|---|
| `build_*` 6종 + 프레임워크 생성기(spring/nestjs/django/web/mobile/desktop) | ~130 | `project-scaffolder` + `capability-advisor` (2) |
| blueprint (domain/database/event/blueprint-validator) | 4 | `architect` (1) |
| validator 10종 | 10 | `quality-checker` (1) |
| docwriting 7종 | 7 | `doc-writer` (1) |
| vcs 12종 | 12 | `git-writer` (1) |
| `*-code-reviewer` 5종 | 5 | `code-reviewer` (1) |
| `*-senior-programmer` 6종 | 6 | 제거(lite 미실행 dead persona) |
| code-change 3종 | 3 | `code-editor` (1) |
| deployment 2종 | 2 | `deploy-advisor` (1) |
| research 5종 | 5 | `researcher` (1) |
| docs-analyze 6종 | 6 | 유지·재정의("붙여넣은 내용 분석") |
| 콘텐츠 6도메인(story/game/meal/trip/playlist/proposal) | — | 이미 v1 에서 단일 스킬화 → 새 포맷 유지 |

intent: 31~33 → **22**(당시; 이후 v3에서 재정립·현행 23 — SKILLS-INVENTORY 참조).
스킬: ~150 → **27**(당시, md 23 + code 4). 현행은 24(md 21 + code 3, `agent_status` 폐지) — SKILLS-INVENTORY.

---

## 4. src 실행모델 변경

- `Intent`: `dag[]`·`validator`·`retry_once`·`present` 제거 → `skill`(단일) + `slot`.
- `runtime.ts`: DAG 루프·validator 재시도 삭제 → 슬롯추출 → 스킬 1개 → 1회 실행.
- `markdownSkill.ts`: 죽은 `priorOutputs`·validate 모드 삭제.
- `pipeline.ts`·`session.ts`·`extractor.ts`: 멀티턴 프레임워크 해소를 이름기반 → **슬롯기반**
  (발화 명시 > 세션 기억 > enum 기본값)으로 재작성.
- **(v2.1)** `orchestrator.ts` 신규(`PlanOrchestrator`), `markdownSkill.ts` 산출물 체이닝 복원,
  `executor.ts` scaffold 실제 실행(`runCommand`)+`writeArtifact`, 복합 감지
  (`looksMultiStep`+`isComplexRequest`). 상세 §6.

---

## 5. 검증

- 빌드 통과, 오프라인 와이어링 미참조·미해결 0.
- 라이브(ollama·gemma3n:e4b·bge-m3): 라우팅 표본 정확, OOS "오늘 날씨" → unknown 차단.
- 슬롯: `framework=spring` → `spring init …` / `엑셀` → `{doc_type}`=docs-analyze-xlsx 치환·실행.
- 환각 가드: 입력 없을 때 docs-analyze·code-reviewer·quality-checker·code-editor 가 "붙여넣어 주세요"만 출력.
- (v2.1) 멀티턴 검증됨: 세션 지속(scaffold→"응"→실제 실행), 계획→편집("2번 빼줘")→순차 실행,
  산출물 `agent-output/<목표>/` 파일 저장, 복합 감지(나열형·접속어 없는 문장 포함).

---

## 6. v2.1 — Plan-and-Execute 확장 (멀티스텝 부활)

"1 skill" 로 부족한 복합 요청을 위해 흐름을 **코드가 통제하는** 오케스트레이터를 얹어, §1 진단의
세 결함을 정면으로 해결했다:

1. **산출물 체이닝 복원** — `MarkdownSkill` 이 `ctx.outputs`(이전 단계 결과)를 프롬프트에 주입.
2. **실행 배선을 코드로** — `PlanOrchestrator.executePlan` 이 `runtime.execute` 를 루프로 돌림(프롬프트 X).
3. **파일 저장** — 텍스트 산출물을 `writeArtifact` 로 workspace(`agent-output/<목표>/`)에 남김.

**복합 감지** = 룰(`looksMultiStep`: 문장 경계·접속어/`-고`·동작동사 2개+) + LLM(`isComplexRequest` yes/no).
룰에 걸린 것만 LLM 확정 → 단일 작업은 즉답 1턴 유지(룰 미매칭 시 LLM 스킵).

**안전장치(소형 모델)**: enum 플래너(등록 스킬만) · 최대 4단계 · **확인 게이트**(응/아니오·"N번 빼줘" 편집).
scaffold 스텝은 계획 안에서도 코드가 명령을 조립·실제 실행. 검증은 플래너가 `check_quality` 스텝으로 선택.

> 원칙은 그대로다: **모델이 순서를 만드는 게 아니라, 코드가 배선하고 모델은 각 단계 내용만 생성**.
