# ai-agent-lite

저사양 로컬 LLM(2B~7B급)에서 **안정적으로 동작하는 것**을 최우선으로 하는 경량 에이전트.

오케스트레이션(계획 생성)을 모델에게 통째로 맡기면 저사양에서 무너진다 → 이 프로젝트는 흐름을
**코드가 통제**하고, 모델은 **분류(intent)·슬롯 추출·각 스킬의 본문 생성**만 담당한다.

```
User → Router(임베딩+분류기) → [단일] 스킬 1개 실행
                             └ [복합] plan_and_run → 계획 → 확인 → 순차 실행(산출물 체이닝)
```

- **1 intent → 1 skill → 1 LLM 호출**이 기본. 모델이 실행 순서를 정하지 않는다(정적 매핑).
- **복합 요청**("A하고 B해줘", 접속어 없이 문장 나열도)은 룰+LLM으로 감지해 `plan_and_run`으로
  올려, **계획을 세워 확인받고**(응/아니오·"N번 빼줘" 편집) 등록된 스킬을 **순서대로 실행**한다.
  각 단계 산출물은 다음 단계로 이어지고(체이닝), 텍스트 결과는 workspace에 파일로 저장된다.
- **코드 생성/스캐폴딩**은 코드가 공식 CLI 명령을 결정론적으로 조립(오타·환각 0)한 뒤,
  **사용자 확인을 받아 실제로 실행**한다(미설치 시 설치 안내로 폴백).
- 모델이 호출되는 곳: 애매한 intent 분류, 슬롯 추출, 복합 판정/계획, 스킬 본문 생성.

설계 상세는 [ARCHITECTURE.md](ARCHITECTURE.md)(§0이 현행), 스킬/인텐트 목록은
[SKILLS-INVENTORY.md](SKILLS-INVENTORY.md), 통합 근거는 [SKILL-CONSOLIDATION.md](SKILL-CONSOLIDATION.md).

---

## 빠른 시작 (Quick Start)

```bash
# 0) 사전: Ollama 를 켜고 chat + embedding 모델을 로드 (아래 "요구 사항")

npm install                       # 1) 의존성 설치
# 2) config/settings.yaml 에서 profile(m4|m2)·모델명 설정
npm run server                    # 3) 상주 서버 (이 터미널은 계속 켜 둔다)
npm link                          # 4) 전역 'agent' 명령 등록 (최초 1회, 프로젝트 루트에서)
agent "상태 확인"                 # 5) 어디서든 실행 (one-shot)
agent                             #    대화형 REPL
```

서버 없이 프로젝트 안에서 바로 테스트: `npm run cli -- "상태 확인"`.
코드를 고친 뒤 서버 반영: `npm run server:restart` (기존 포트 정리 후 재기동).

---

## 요구 사항

- **Node.js ≥ 18** (ESM · `tsx`)
- **로컬 LLM 서버**(OpenAI 호환): [Ollama](https://ollama.com) — `http://localhost:11434`
- **모델 2종**(chat + embedding 별개):
  - chat: 하드웨어별 프로필 — M4는 `qwen3:8b`, M2는 `gemma3n:e4b` (아래 "설정" 참고)
  - embedding: `bge-m3` (한국어 권장)
- **절제 설정**(num_ctx/num_thread)은 `modelfiles/*.Modelfile` 로 커스텀 태그에 고정.
  최초 1회 등록: `ollama create <태그> -f modelfiles/<파일>` (각 Modelfile 주석 참고)

---

## 실행 구조

**상주 서버 + 얇은 클라이언트**. 서버가 파이프라인(임베딩 centroid·LLM 연결)을 한 번만 로드해
워밍 유지하고, CLI·텔레그램은 TCP(기본 `127.0.0.1:7000`)로 요청만 보낸다.

```bash
npm run server           # 필수(터미널 1). 시작 시 파이프라인 1회 로드
npm run server:restart   # 포트 정리 후 재기동 (코드 변경 반영)
npm run server:stop      # 포트의 서버만 종료
```

전역 CLI 등록(프로젝트 루트에서). 전역 `agent` 명령은 `package.json`의 `bin`
(`agent` → [`bin/agent.mjs`](bin/agent.mjs))에서 온다. `bin/agent.mjs` 는 빌드본 `dist/cli.js` 를
remote 모드로 띄우는 얇은 shim 이라 **먼저 `npm run build` 가 필요**하다(그리고 실행엔 `npm run server`).

```bash
npm run build            # 필수 — bin/agent.mjs 가 dist/cli.js 를 로드한다
npm link                 # 개발용 심볼릭 링크(권장). 이후 어디서든 'agent'
# 또는  npm i -g .        # 스냅샷 설치
```

npm 없이 **bin 파일을 직접 PATH 에 거는 방법**(위와 택1):

```bash
chmod +x bin/agent.mjs                              # shebang(#!/usr/bin/env node) 실행권한
ln -s "$PWD/bin/agent.mjs" /usr/local/bin/agent     # PATH 에 심볼릭 링크 (권한 필요 시 ~/.local/bin)
# 또는 셸 rc(~/.zshrc)에 alias:  alias agent="$PWD/bin/agent.mjs"
```

> 어느 방식이든 `agent` 는 상주 서버(TCP `127.0.0.1:7000`)로 요청하는 remote 런처다 —
> `AGENT_REMOTE=0 agent …` 로 서버 없이 인프로세스 실행도 가능. 포트/호스트는 `AGENT_PORT`/`AGENT_HOST`.

```bash
agent "재즈 곡 골라줘"    # one-shot — 실행한 디렉토리가 workspace
agent                    # 대화형 REPL (같은 workspace 로 멀티턴)
```

REPL/텔레그램 명령: `/help` · `/status`(상태·결정론) · `/soul [이름|off]`(페르소나 전환) · `/reset`(세션 맥락 초기화).
포트/호스트: `AGENT_PORT`/`AGENT_HOST`(서버·CLI 동일하게).

텔레그램 봇(선택): `.env` 에 `TELEGRAM_BOT_TOKEN=<@BotFather>` 후 `npm run bot`.
`chat.id` 를 세션 키로 채팅방 단위 멀티턴(계획 확인·프로젝트 컨텍스트)이 이어진다.

---

## 무엇을 할 수 있나 (intent 23개)

| 분류 | intent | 발화 예 |
|---|---|---|
| 대화 | `chitchat` (+ `unknown`→LLM fallback) | "안녕", "잘 지내?" |
| 복합 실행 | `plan_and_run` | "스프링 만들고 주문 도메인 설계해줘" |
| 작업 계획 | `plan_tasks` | "할 일 체크리스트로 정리해줘" |
| 프로젝트 | `scaffold_project`(실행) | "스프링 프로젝트 만들어줘" |
| 코드 | `change_code`, `review_code`, `explain_code` | "음수 검증 추가해줘", "보안 점검", "이 함수 뭐 하는지 설명" |
| 설계 | `design_system` | "postgres 스키마 설계" |
| 문서/변환 | `analyze_document`, `write_docs`, `convert_document`, `translate` | "이 pdf 분석", "ADR 써줘", "docx→md 변환", "영어로 번역" |
| VCS/배포 | `git_artifact`, `setup_deployment` | "커밋 메시지", "배포 빌드 스크립트" |
| 테스트/실행 | `write_tests`, `run_command` | "단위테스트 짜줘", "타입체크 돌려줘" |
| 조사 | `research_topic` | "REST랑 GraphQL 차이 정리" |
| 콘텐츠·사무 | `write_proposal`, `write_message`, `meeting_minutes`, `write_story`, `run_game_session` | "제안서 초안", "안내 메일", "회의록 정리", "단편 하나" |

> 상태 점검은 intent 가 아니라 **`/status` 명령**(또는 "헬스체크"·"상태 확인" 같은 명시적 상태 질의)으로 —
> LLM 라우터를 안 거치는 결정론 경로다. 전체 매핑은 [config/intents.yaml](config/intents.yaml).

---

## 설정 (`config/settings.yaml`)

```yaml
profile: m4                 # m4 | m2 — 하드웨어 프로필 하나로 전환 (둘 다 로컬 Ollama)
m4:                         # Mac M4 24GB 평상시 주력
  baseURL: http://localhost:11434/v1
  chatModel: qwen3-8b-daily          # 베이스 qwen3:8b (num_ctx 8192)
  embedModel: bge-m3
  coderModel: qwen25-coder-7b-daily  # 코드 생성 전용. 비우면 chatModel
  maxOutputTokens: 3584              # 자유생성 출력 상한(ctx 예산 내 입력+출력)
  noThinkFreeGen: true               # produce 자유생성만 qwen3 사고 off(reasoning_effort:none) — 지연↓
m2:                         # Mac M2 16GB 평상시 (경량)
  baseURL: http://localhost:11434/v1
  chatModel: gemma3n-e4b-daily       # 베이스 gemma3n:e4b (num_ctx 4096)
  embedModel: bge-m3
  coderModel:                        # 비우면 chatModel(gemma3n)
  maxOutputTokens: 2560              # 4096 ctx 예산 내(실측 여유)
# plan: { maxSteps: 4 }      # 계획 단계 상한(기본 4). AGENT_MAX_STEPS env 로도 조정
router:
  directThreshold: 0.94     # 이상이면 임베딩만으로 직행(LLM 분류 스킵)
  unknownThreshold: 0.60    # 미만이면 unknown → fallback. 중간 밴드는 LLM 분류
  candidateK: 8             # 중간 밴드에서 LLM 에 넘길 top-K 후보 수
response:
  polishWithLlm: false      # true면 응답을 LLM이 한 번 다듬음
soul: ''                    # 기본 페르소나(souls/<이름>.md). 비우면 기본 에이전트
skills:
  root: skills              # 활성 스킬 루트
```

- **접속 주소**: `AGENT_HOST`/`AGENT_PORT` 로 override (기본 `127.0.0.1:7000`).
- **threshold 는 임베딩 모델 의존적** — 모델을 바꾸면 재보정 필요(ARCHITECTURE §11.2).

---

## 디렉토리

```
bin/agent.mjs        전역 CLI 클라이언트 (순수 Node)
src/
  server.ts          상주 서버 (TCP 7000)
  index.ts           텔레그램 봇 진입점
  pipeline.ts        Router→(복합 승격)→Runtime→Skill→Response 조립 + 확인 상태머신
  cli.ts             서버리스/원격 겸용 CLI 하네스(REPL·one-shot)
  core/              llmClient · router · classifier · extractor · runtime · executor ·
                     session · soul · config · serverAddr · tui · types
  skills/            registry · markdownSkill · agentStatus · chitchat · fallbackReply · orchestrator
config/
  settings.yaml      provider · 모델 · threshold · soul
  intents.yaml       intent → 단일 skill 매핑 (23개)
skills/              활성 스킬 (dev/ · docs-analyze/ · domains/, SKILL.md 21개)
souls/               페르소나 (oliver · claire)
```

코드 스킬 3개(외부 의존 0/오케스트레이션): `chitchat` · `fallback_reply` · `plan-and-run`. 총 스킬 24개.
(상태는 스킬이 아니라 `/status`·`STATUS_QUERY` 결정론 인터셉트 — `agentStatus.ts`의 `statusFactsBlock`.)

---

## 스킬 추가/편집

1. `skills/` 아래 `<카테고리>/<스킬>/SKILL.md` 로 둔다(재귀 스캔 — 폴더명으로 인덱싱, 고유해야 함).
   본문(프론트매터 제외)이 그대로 시스템 프롬프트가 된다. 짧게·출력전용으로(§SKILL 포맷은 INVENTORY).
2. `config/intents.yaml` 에 intent 추가 — `description`·`examples`(5~9개)·`skill`(단일, 또는 `"{slot}"`)·
   필요 시 `slot`(enum).
3. 서버 재시작(`npm run server:restart`). examples 가 바뀌면 centroid 캐시(`.cache/`)는 자동 무효화.

> 저사양 원칙: intent 는 적게(거친 단위 + 슬롯), 스킬 프롬프트는 짧고 출력전용으로.

---

## 트러블슈팅

| 증상 | 원인/해결 |
|---|---|
| 모든 라우팅이 `unknown`, sim 0 | 임베딩 0 벡터. `encoding_format:'float'`(코드 반영됨). 임베딩 모델 로드 확인 |
| CLI "서버 연결 실패" | 서버 미실행. `npm run server`. 포트는 `AGENT_PORT` |
| 코드 고쳤는데 옛 동작 | 서버가 구 파이프라인 상주 중 → `npm run server:restart` |
| 정상 발화인데 `unknown` | `unknownThreshold`(0.60)·예제 커버리지. 해당 intent examples 보강 |
| 엉뚱한 intent | examples 를 더 변별력 있게(중간 밴드는 LLM 분류가 선택) |
| 텔레그램 `getMe 401` | `TELEGRAM_BOT_TOKEN` 확인 |

---

## 비고

- 코드 생성은 **CLI 명령 안내 + 확인 후 실제 실행**(scaffold). 명령은 모델이 아니라 코드가 조립해
  오타·환각이 없다. 멀티턴(예: "여기에 auth 추가")은 세션이 대상 프레임워크를 기억한다.
- 복합 요청은 `plan_and_run`이 계획→확인→순차 실행하며, 단계 산출물을 이어받아(체이닝)
  workspace 의 `agent-output/<목표>/` 에 저장한다.
