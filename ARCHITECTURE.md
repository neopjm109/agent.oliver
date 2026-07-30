# ai-agent-lite — 아키텍처 설계

저사양 로컬 LLM(2B~7B급)에서 **안정적으로 동작하는 것**을 최우선으로 하는 경량 에이전트.
계획/DAG 생성을 모델에게 맡기면 저사양에서 무너진다 → **흐름은 코드가 통제**하고, 모델은
**분류(intent)·슬롯 추출·각 단계 내용 생성**만 맡는다.

- **언어:** TypeScript (Node.js)
- **런타임 백엔드:** Ollama · LM Studio (OpenAI 호환, 로컬 서버)
- **인터페이스:** 전역 CLI · 텔레그램 봇 · 슬랙 봇 (상주 서버의 얇은 클라이언트, 파일 첨부 지원)

---

## 0. 실행 모델 (현행)

24B 오케스트레이터에서 이식한 "intent → 다중 노드 DAG"는 lite 런타임과 맞지 않았다(초기엔
MarkdownSkill 이 앞 산출물을 안 넘기고 마지막 노드만 반환해 다중 노드가 무의미했다). 그래서
**1 intent → 1 skill**을 기본으로 재설계하고, 이후 **산출물 체이닝을 복원**해 멀티스텝을 코드가
통제하는 **Plan-and-Execute** 계층을 얹었다.

### 2계층

1. **단일 요청 → 1 skill** (`Runtime.execute`): intent 에 매달린 스킬 1개 실행. 모델이 순서를
   정하지 않는다. `Intent = skill`(단일, 또는 `"{slot}"`) `+ slot`(enum). `dag`/`validator`/
   `retry_once`/`present` 는 폐기.
2. **복합 요청 → `plan_and_run`** (`PlanOrchestrator`, 코드 스킬): 룰(`looksMultiStep`: 문장 경계·
   접속어/`-고`·동작동사 2개+) + LLM(`isComplexRequest`)로 복합을 감지해 승격 → enum 플래너가
   등록 스킬 중에서 계획(기본 4단계, `plan.maxSteps`·`AGENT_MAX_STEPS`로 조정 — m2 보수·m4 여유, 실측
   6~8단계 완주) → **human-in-the-loop**: 사람이 한 단계씩 승인하며 진행한다(자동 실행 없음). 부작용
   단계(스캐폴드 실행·코드 생성)는 미리보기→승인→커밋. 오케스트레이터는 커서·완료 산출물만
   유지(`StagedPlan{cursor,outputs,stage}`). 각 단계는 `ctx.outputs` 를 이어받아 앞 산출물을 반영한다
   (**체이닝** — 총량예산 압축 `priorOutputsBlock`로 단계가 늘어도 num_ctx 무오버플로). 실행/생성 로직은
   단일턴과 공유하는 `core/step.ts`(prepareStep/commitStep)에
   위임한다(생성 로직 이중화 제거). 단일은 즉답 1턴 유지. → 설계: [hitl-orchestrator-spec.md](hitl-orchestrator-spec.md).

### 코드 생성 = 안내 + 확인 후 실제 실행

`scaffold_project` 는 `executor.ts` 가 공식 CLI 명령을 **결정론적으로 조립**(프로젝트명·플래그를
코드가 채워 오타·환각 0)한 뒤, **사용자 확인**을 받아 `execFile` 로 실제 실행한다(셸 미개입,
화이트리스트만, 미설치 시 설치 안내 폴백). 이름이 없으면 임의로 짓지 않고 되묻는다. 확인·이름 대기는
`session.pending`/`awaitingScaffoldName` 상태머신으로 CLI·서버·텔레그램 공통 동작한다.

### 규모

- **intent 23개**(`config/intents.yaml`) — 프레임워크 세부는 `slot` enum 으로 흡수. (v3 재정립:
  `add_capability`→`change_code`, `check_quality`→`review_code` 흡수, 콘텐츠 식단·여행·음악 제거,
  `convert_document`·`translate`·`write_tests`·`run_command`·`explain_code`·`write_message`·`meeting_minutes` 추가.
  `agent_status`는 intent 폐지 → 결정론 인터셉트 `/status`·`STATUS_QUERY`로 대체 §3.3)
- **스킬 24개** = markdown 21(`skills/dev` 10 · `skills/docs-analyze` 6 · `skills/domains` 5) +
  code 3(`chitchat` · `fallback_reply` · `plan-and-run`). (scaffold·change_code·
  convert_document·setup_deployment·translate·write_tests·run_command 는 pipeline 코드 경로로 처리 — SKILL.md 는 없거나 폴백용)

---

## 1. 설계 철학 (저사양 원칙)

| 원칙 | 의미 | 이유 |
|---|---|---|
| **모델은 분류/선택/내용 생성만** | intent 고르기, 슬롯 채우기, 각 단계 본문 쓰기 | 2B~7B는 멀티스텝 계획을 스스로 못 세운다 |
| **흐름은 코드가 배선** | 실행 순서·체이닝·확인·파일저장은 결정론적 코드 | 모델이 그래프를 만들면 오케스트레이션 실패 재발 |
| **자유형식 대신 제약 디코딩** | JSON schema 로 출력 강제(서버가 강제) | 저사양 tool call 은 포맷이 잘 깨짐 |

모델이 호출되는 지점: 애매한 intent 분류, 복합 판정, 슬롯 추출, 계획 수립, 각 스킬 본문 생성,
(선택) 응답 다듬기. 라우팅·흐름 제어·명령 조립은 전부 코드.

---

## 2. 런타임 백엔드 — Ollama & LM Studio

둘 다 **OpenAI 호환 API**라 클라이언트 하나(`core/llmClient.ts`)로 통합하고 `baseURL`만 바꾼다.
JSON schema 제약(`response_format`)은 **서버가 강제**하므로 클라이언트 언어 무관. 임베딩 모델은
chat 모델과 별개(전용 소형 모델 `bge-m3`/`nomic-embed-text`).

> 한국어는 `bge-m3` 권장. 동시성은 Ollama 가 안정적(멀티모델 상주+큐잉).

---

## 3. 컴포넌트

### 3.1 Intent Router — 2단계 하이브리드 (`core/router.ts`, `classifier.ts`)

임베딩을 1차 필터로만 쓰고, 애매한 것만 LLM 이 후보 중 분류한다.

```
[시작 1회] intent별 (description + examples) 임베딩 → centroid + 개별 벡터 캐시(.cache/)
[런타임]   점수 = max(cos(centroid), max_i cos(벡터_i))
  top ≥ directThreshold(0.94)            → 직행(고신뢰)
  unknownThreshold(0.60) ≤ top < 0.94    → LLM 분류: top-K 후보 중 1택(+none)
  top < 0.60                             → unknown → fallback(LLM 대화형)
```

- **점수 = max(centroid, 개별 벡터)** + **description 도 임베딩** → 다양한 예제로 인한 희석 보완,
  넓은 의미로 후보 진입(recall). intent 의미는 description 1개로 커버 → 유지보수 급감.
- **복합 승격**(§0): 라우팅 후 `looksMultiStep`+`isComplexRequest` 로 `plan_and_run` 승격 판단.

### 3.2 Extractor (`core/extractor.ts`)

자유형식 tool call 대신 **enum JSON schema 제약**으로 슬롯만 뽑는다. 파이프라인이 미리 채운
슬롯(예: 세션 프레임워크)은 재추출하지 않는다.

### 3.3 Skill (`skills/`)

- **MarkdownSkill** — `skills/**/SKILL.md` 본문(프론트매터 제외)이 그대로 시스템 프롬프트.
  폴더명으로 인덱싱. `ctx.outputs`(이전 단계)·history·workspace·slots 를 user 메시지로 주입.
- **코드 스킬** — `chitchat` · `fallback_reply` · `plan-and-run`(오케스트레이터). 파이프라인이 주입,
  레지스트리 우선순위 최상위.
- **상태(status)는 스킬/intent 가 아니다** — 인프라 조회라 라우터를 안 거치고 `handleInner` 의 결정론
  인터셉트(`/status` 명령 + `STATUS_QUERY` 앵커드 정규식)가 `statusFactsBlock`(외부/LLM 의존 0)을 즉시
  반환. `/soul` 처럼 history·audit 미경유. "잘 돌아가?"(status)와 "잘 지내?"(chitchat)를 정규식이 정확히 가른다.
- **능력/도움말 조회도 결정론 인터셉트** — "뭘 할 수 있어?"·"기능 알려줘"·"도움말"은 임베딩상
  explain_code("뭐 하는거야")와 가까워 오분류되던 문제라, status 와 같은 취지로 `CAPABILITY_QUERY`
  앵커드 정규식이 `CAPABILITIES` 요약을 즉시 반환(`intent:'capabilities'`). 코드 대상 지시("이 코드/함수
  뭐 하는지")는 선두 lookahead 로 배제 → explain_code 로 보낸다. history·audit 미경유.

### 3.4 Session / 멀티턴 (`core/session.ts`)

세션 키 = `chatId ?? workspace`(CLI=디렉토리, 텔레그램=채팅방). 유지 상태: 최근 프레임워크, 부작용
커밋 대기(`pendingStepCommit` — scaffold 실행·파일 편집·코드 생성 통합)·이름 대기(`awaitingScaffoldName`)·
경로 대기(`awaitingEditPath`)·계획 진행(`pendingPlan`=StagedPlan), 대화 히스토리(최근 4턴). framework 슬롯은
발화 명시 > 세션 기억 > enum 기본값 순으로 채운다. `/reset` 로 초기화.

> 메타명령(라우팅 전 결정론 처리, 전 surface 공통): `/status`(상태) · `/soul [이름|off]`(페르소나) · `/reset`(CLI).

### 3.5 Soul (페르소나, `core/soul.ts`)

정체성·말투를 `souls/<이름>.md` 로 정의하고 **대화 표면(chitchat·fallback·응답 다듬기)에만** 얇게
주입. 생성 스킬엔 주입하지 않는다(저사양은 좁은 프롬프트가 안정적). `settings.soul` 기본값 +
`/soul <이름|off>` 세션 전환. 기본은 소울 없음. (현재 `claire`·`oliver`)

### 3.6 전송 (서버 + CLI + 텔레그램 + 슬랙)

상주 서버(`server.ts`, TCP 기본 `127.0.0.1:7000`)가 파이프라인을 1회 로드해 워밍 유지하고,
전역 CLI(`bin/agent.mjs`)·텔레그램(`telegramBot.ts`, `npm run bot`)·슬랙(`slackBot.ts`, Socket Mode,
`npm run slack`)이 얇은 클라이언트로 요청만 보낸다. 모든 진입점이
`pipeline.handle(text, {workspace|chatId|attachments})` 하나로 수렴 → 확인/편집 상태머신이 전송 무관하게 동작.
`npm run cli`(서버리스 in-process)는 개발용. `server:restart` 로 코드 변경 반영.

**파일 첨부:** 텔레그램(문서/사진)·슬랙(files) 업로드를 봇이 내려받아 `core/uploads.ts`(os tmpdir 아래
채팅방별 폴더)에 저장하고, **바이트가 아니라 절대경로만** 서버에 넘긴다(`opts.attachments`). 서버는
경로를 검증(절대·실파일)하고, 파이프라인이 `readAttachmentFiles`로 텍스트/코드는 직접·바이너리 문서
(pdf·docx·xlsx·pptx)는 추출해 `ctx.attachments`에 실어, 붙여넣기 없이 분석·리뷰가 된다. 못 읽은 파일은
정직화 꼬리말로 명시. (같은 인제스천 엔진을 "경로 언급" 방식과 공유)

**결과물 파일(아웃바운드):** 문서형 intent(write_docs·design_system·write_proposal·research_topic·
git_artifact·write_story·run_game_session)의 출력이 길면(≥1500자) `.md`로도 저장하고(`core/uploads.ts`
`saveOutbox`) `PipelineResponse.files`에 절대경로를 싣는다. 파일명은 `core/naming.ts`가 **문서 종류의
관용 표준명**(README.md·CHANGELOG.md·설계서.md·제안서.md·COMMIT_MESSAGE.txt …, 이야기는 제목)으로 짓고,
plan 결과 폴더는 목표 문장 전체가 아니라 **짧은 주제**(`agent-output/주문도메인/`)로 만든다 — 모델 제목을
통째로 슬러그화하던 방식(`주문-도메인-아키텍처-설계-문서.md`)을 폐기. 표준명 반복 시 덮어쓰지 않도록
**`_YYYYMMDD_NN`**을 붙여 유일화·정렬(`설계서_20260727_01.md`, `uniqueStamped`). 봇은 그 파일을 **첨부로
업로드**(짧은 캡션만, 전체는 파일)하고, CLI는 경로로 안내한다. 짧은 답·잡담은 그대로 텍스트. (인바운드
첨부의 정확한 역방향 — 바이트가 아니라 경로만 오가고 같은 머신의 봇이 읽어 올린다)

---

## 4. ⚠️ 재현되는 함정 (반드시 기억)

1. **임베딩은 `encoding_format: 'float'` 강제.** openai-node 기본 base64 는 LM Studio 에서 디코딩이
   깨져 **0 벡터**, Ollama 에선 **"Premature close"** 실패. float 통일.
2. **openai SDK 는 네이티브 fetch(undici)로 교체.** 번들 node-fetch 는 keep-alive 재사용 시 로컬
   서버(특히 Ollama)에서 `Premature close` 잦다 → `new OpenAI({ fetch: globalThis.fetch })`.
3. **threshold 는 임베딩 모델별 재보정 필수.** 모델마다 유사도 분포가 다르다.
   - **bge-m3(한국어 우수):** 인스코프 1.0 / paraphrase 0.83~0.88 / **OOS 0.63~0.66**.
   - nomic-embed: 바닥이 높아 인스코프 ≥0.97 / OOS ≤0.92(아슬아슬).
   - 현행: `directThreshold 0.94` · `unknownThreshold 0.60` · `candidateK 8`.
4. **동시성은 Ollama 가 유리.** LM Studio 는 embed+chat 동시 버스트 시 chat 모델 축출("Model
   unloaded") → 대량 실패. Ollama 는 멀티모델 상주+큐잉. `OLLAMA_MAX_LOADED_MODELS=2 OLLAMA_KEEP_ALIVE=-1` 권장.
5. **코드 변경이 안 먹으면 서버 재시작.** 상주 서버는 시작 시 파이프라인 1회 로드 → `npm run server:restart`.

---

## 5. 디렉토리

```
bin/agent.mjs              전역 CLI 클라이언트 (순수 Node)
src/
  server.ts                상주 서버 (TCP 7000, 파이프라인 워밍)
  index.ts · telegramBot.ts  텔레그램 봇 (서버 클라이언트, 문서/사진 첨부)
  slackIndex.ts · slackBot.ts  슬랙 봇 (Socket Mode, files 첨부)
  pipeline.ts              handle() 조립: 라우팅 → 복합 승격 → 확인/실행 상태머신 → Skill
  cli.ts                   서버리스/원격 겸용 CLI 하네스 (REPL·one-shot)
  core/
    llmClient.ts           Ollama/LM Studio 통합 (embed/chatJson/chatText)
    router.ts · classifier.ts   임베딩 라우팅 + LLM 분류/복합판정
    extractor.ts           enum 슬롯 추출
    runtime.ts             단일 스킬 실행 (+ "{slot}" 치환)
    step.ts                prepareStep/commitStep — 단일턴·plan 공유 실행 프리미티브(scaffold/편집/코드생성)
    convert.ts             문서 변환 — 목표포맷 감지 + LLM 정형 + pandoc(오피스)/직접저장(텍스트)
    deploy.ts              배포 — 스택 감지 + 빌드 명령·산출물·실행법 결정론 템플릿(build.sh)
    translate.ts           번역 — 목표언어 감지(한↔영·일·중) + 한국어강제 우회 chatText
    tests.ts               테스트 생성 — 프레임워크·테스트경로 결정론 감지 + 코더모델 생성
    runner.ts              실행·검증 — test/build/lint/typecheck 화이트리스트 명령 조립(commitStep 실행)
    naming.ts              결과물 표준 파일명·짧은 주제 폴더 (uploads.ts 와 함께)
    executor.ts            scaffold 명령 조립·실행(execFile) + writeArtifact + 첨부 인제스천(readAttachmentFiles)
    session.ts             멀티턴 세션 + framework/복합 신호 룰
    audit.ts               턴 단위 감사 로그(JSONL) · uploads.ts  메신저 업로드 로컬 저장
    soul.ts · config.ts · serverAddr.ts · client.ts · tui.ts · types.ts
  skills/
    registry.ts            스킬 해결 (코드 스킬 + MarkdownSkill)
    markdownSkill.ts        SKILL.md 실행기 (산출물 체이닝 주입)
    orchestrator.ts        PlanOrchestrator (계획→단계별 승인 진행, human-in-the-loop 상태기계)
    agentStatus.ts · chitchat.ts · fallbackReply.ts   코드 스킬
config/
  settings.yaml            provider · 모델 · threshold · soul
  intents.yaml             intent → 단일 skill 매핑 (23개)
skills/                    dev/ · docs-analyze/ · domains/  (SKILL.md 21개)
souls/                     페르소나 (oliver · claire)
```

의존성: `openai` · `grammy`(텔레그램) · `@slack/bolt`(슬랙) · `officeparser`(문서 추출) · `yaml` · `dotenv`
(+ dev: `typescript` · `tsx`). 선택 외부 도구: `pandoc`(문서 변환의 오피스 출력 — 없으면 마크다운 폴백).

---

## 6. 설정 · 스킬 추가

설정 스키마와 스킬 추가 절차는 [README.md](README.md)(설정·스킬 추가/편집) 참고. 요지:
`config/settings.yaml`(provider·모델·`router.{directThreshold,unknownThreshold,candidateK}`·soul),
스킬은 `skills/<카테고리>/<스킬>/SKILL.md`(짧은 출력전용 프롬프트) + `intents.yaml` 에
`skill`·`examples`·`slot` 추가 후 `server:restart`.

카탈로그(intent·스킬 목록)는 [SKILLS-INVENTORY.md](SKILLS-INVENTORY.md),
통합/재설계 근거는 [SKILL-CONSOLIDATION.md](SKILL-CONSOLIDATION.md).
