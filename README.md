# Skillful Agent

스킬 기반 범용 AI 에이전트 프레임워크. **완전 자체 구현**이며, OpenAI 호환 tool-calling 을 지원하는
**어떤 로컬 LLM**(Ollama · LM Studio · vLLM)이나 OpenAI API 뒤에서도 동작합니다.

Claude Code 의 핵심 구조 — *에이전트 루프 + 스킬 + 도구 + 권한 게이트* — 를 그대로 옮겨온
구현이며, 여기에 여러분의 스킬과 도구를 얹어 확장하도록 설계했습니다.

**주요 기능**

- 🔌 OpenAI 호환 tool-calling — 로컬 LLM(Ollama·LM Studio·vLLM) 또는 OpenAI
- 🧩 재귀 스킬 로딩 + 카테고리 기반 2단계 탐색 (수백 개 스킬 확장 가능)
- 📋 플래닝 — 다단계 작업을 할 일 목록으로 쪼개 추적 (`update_plan`)
- 💬 스트리밍 출력 (CLI)
- 🤖 서브에이전트 — 에이전트가 하위 작업을 다른 에이전트에게 위임 (`spawn_agent`)
- 💾 대화 영속화 — 세션별 히스토리를 디스크에 저장, 멀티턴 이어가기
- 🔎 웹 검색·가져오기 — `web_search`(Tavily/DuckDuckGo) · `web_fetch`(SSRF 가드)
- 🔒 보안 — 도구 비활성화(`DISABLED_TOOLS`) · 위험 조합 경고 · 텔레그램 chat_id 허용목록
- 🌐 HTTP 서버 모드 + 📱 텔레그램 봇 연동

## 동작 원리

```
사용자 입력
   │
   ▼
┌───────────────────────────────────────────────┐
│  에이전트 루프 (src/agent.ts)                   │
│                                                 │
│  1. LLM 호출 (대화 + 도구 목록 전달)             │
│  2. 응답에 tool_calls 가 있으면 → 도구 실행      │
│  3. 실행 결과를 대화에 되먹임 → 1 로 반복        │
│  4. tool_calls 가 없으면 → 최종 답변 반환        │
└───────────────────────────────────────────────┘
        │                          │
        ▼                          ▼
   도구 (src/tools/)          스킬 (skills/**/SKILL.md)
   read_file / write_file     list_skills 로 카테고리 탐색
   list_dir / run_shell       invoke_skill 로 지침 로드
   list_skills / invoke_skill → SKILL.md 지침을 모델이 따름
```

- **스킬**은 `skills/` 아래 **어느 깊이든** `SKILL.md` 파일이면 됩니다. 로더가 재귀적으로 찾습니다.
  frontmatter(`name`, `description`, `allowed-tools`)로 "언제 쓰는지"를 선언하고, 본문에 절차를 적습니다.
- **카테고리**는 `skills/` 바로 밑 폴더명입니다. 예: `skills/web/form-generator/SKILL.md` → 카테고리 `web`.
  `skills/foo/SKILL.md` 처럼 바로 밑에 있으면 카테고리는 `general`.
- **2단계 스킬 탐색** — 스킬이 많을 때 설명을 전부 시스템 프롬프트에 넣으면 폭증하므로(예: 300개 ≈ 72KB),
  기본적으로 시스템 프롬프트엔 **카테고리 개요만** 싣습니다. 모델은 `list_skills(category)` 로 후보를 펼쳐 본 뒤
  `invoke_skill(name)` 으로 지침을 로드합니다. (스킬이 30개 이하면 전체 목록을 바로 노출 — `overview()` 임계값)
- **스킬 발동 확인** — 자연어 요청에선 모델이 스킬을 쓸지 스스로 정하므로, 실제로 어떤 스킬이
  발동했는지 매 요청마다 추적해 알려줍니다. CLI 는 `🧩 사용한 스킬: ...` 를 출력하고, 서버 응답엔
  `skills` 필드가, 텔레그램엔 답변 하단에 표시됩니다. (아무 스킬도 안 썼으면 목록은 비어 있음)
- **반복 호출 가드** — 소형 모델(4B급)이 같은 도구를 같은 인자로 반복 호출하는 루프에 빠지기 쉬운데,
  한 요청 안에서 동일 호출이 감지되면 재실행 없이 넛지를 반환하고, 3번째면 **도구를 제거한 채 최종 답변을
  강제 생성**해 루프를 끊습니다. (agent.ts)
- **위험한 도구**(`write_file`, `run_shell`)는 실행 전 터미널에서 사용자 승인을 받습니다.

## 빠른 시작

```bash
# 1. 의존성 설치
npm install

# 2. 설정
cp .env.example .env
#   .env 에서 LLM_BASE_URL / LLM_MODEL 을 로컬 환경에 맞게 수정

# 3-a. 대화형 실행
npm run dev

# 3-b. 단발 실행 (스크립트 모드)
npm run dev -- "src 디렉터리 구조를 설명해줘"
```

### 로컬 LLM 예시 (Ollama)

```bash
ollama pull qwen2.5:14b-instruct
ollama serve
# .env:  LLM_BASE_URL=http://localhost:11434/v1
#        LLM_MODEL=qwen2.5:14b-instruct
```

> 도구 호출(tool calling) 품질은 모델에 크게 좌우됩니다.
> 로컬은 `qwen2.5:14b` 이상 또는 `llama3.3:70b` 급을 권장합니다.

## 실행 모드

### 1) CLI (스트리밍 + 대화 영속화)

```bash
npm run dev                      # 대화형 REPL (응답이 토큰 단위로 스트리밍)
npm run dev -- "질문"            # 단발 실행
npm run dev -- --session work    # 세션 지정 (대화가 .sessions/work.json 에 저장/복원)
```

대화는 세션별로 `.sessions/<id>.json` 에 저장되어, 다시 실행하면 이어집니다. (기본 세션 `cli`)

### 2) HTTP 서버 (외부 연동용)

```bash
npm run serve                    # http://localhost:8787
```

| 엔드포인트 | 설명 |
|---|---|
| `GET  /health` | 상태 확인 |
| `POST /chat`   | `{ "session": "...", "message": "..." }` → `{ "reply": "..." }` |
| `POST /reset`  | `{ "session": "..." }` → 해당 세션 대화 초기화 |

- 세션별로 대화가 영속화되어 멀티턴이 유지됩니다.
- 서버엔 터미널이 없으므로 위험 도구(쓰기·셸)는 `AUTO_APPROVE=true` 일 때만 실행됩니다.
- `AGENT_SERVER_TOKEN` 을 설정하면 요청 헤더 `x-api-key` 로 인증합니다.

### 3) 텔레그램 봇 ([bot/](bot/), Python · python-telegram-bot)

```bash
# 터미널 1 — 에이전트 서버
npm run serve

# 터미널 2 — 텔레그램 봇 (venv 권장)
cd bot
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # TELEGRAM_BOT_TOKEN (BotFather 발급) 입력
python telegram_bot.py
```

텔레그램 채팅별로 세션이 분리(`tg-<chat_id>`)되어 대화가 유지됩니다.
봇은 서버의 `/chat` 을 호출할 뿐이라, 서버가 로컬 LLM을 쓰든 무엇을 쓰든 무관합니다.

봇 명령어:
- `/reset` — 대화 초기화
- `/soul` — 페르소나 목록 보기 / `/soul <이름>` 변경 / `/soul off` 일반 모드
  (페르소나는 채팅별로 서버에 저장되어 유지됩니다. `souls/<이름>.md` 로 추가.)

봇은 서버의 `POST /chat/stream`(NDJSON) 을 구독해, 처리 중 도구 호출·계획 같은 **진행 상황을
메시지 하나를 편집하며 실시간으로** 보여준 뒤 최종 답변으로 교체합니다. 최종 답변은
`telegramify-markdown` 으로 텔레그램 **MarkdownV2** 로 변환해 전송합니다(변환/전송 실패 시 평문 폴백).

> ⚠️ **보안** — 에이전트는 셸/파일 도구를 쓸 수 있고, 텔레그램 봇은 봇 이름만 알면 누구나
> 말을 걸 수 있습니다. 특히 서버가 `AUTO_APPROVE=true` 이면 **원격 셸 실행**이 열립니다.
> 반드시 `bot/.env` 의 `TELEGRAM_ALLOWED_CHAT_IDS` 에 **본인 chat_id 만** 넣으세요.
> (봇 실행 후 `/start` 를 보내면 답장/로그에 본인 chat_id 가 표시됩니다.)

## 플래닝 (update_plan)

3단계 이상 걸리는 작업이면 에이전트가 `update_plan` 도구로 할 일 목록을 세우고, 각 단계를
진행하며 상태(`pending` → `in_progress` → `completed`)를 갱신합니다. 사용자에겐 체크리스트로 보입니다.

```
📋 계획
  ☑ package.json 읽기
  ▸ bot 폴더 확인  ⟵ 진행 중
  ☐ 결과 요약
```

계획은 호출할 때마다 전체 목록으로 교체되며(TodoWrite 방식), 항상 하나만 `in_progress` 입니다.

## 서브에이전트 (spawn_agent)

에이전트는 크고 자기완결적인 하위 작업을 `spawn_agent` 도구로 **서브에이전트**에게 위임할 수 있습니다.
서브에이전트는 자신만의 대화로 도구·스킬을 모두 써서 작업을 마치고 결과 요약만 돌려줍니다.
무한 위임을 막기 위해 재귀 깊이는 `MAX_DEPTH`(기본 3)로 제한됩니다.

## 새 스킬 추가하기

`SKILL.md` 를 만들면 끝입니다. 재시작하면 자동 등록됩니다. 위치는 자유입니다:

- 카테고리로 묶기: `skills/<카테고리>/<스킬>/SKILL.md` (권장, 카테고리 = `<카테고리>`)
- 최상위 직속: `skills/<스킬>/SKILL.md` (카테고리 = `general`)

```markdown
---
name: my-skill
description: 언제 이 스킬을 쓰는지 — 모델이 이 문장으로 선택합니다.
allowed-tools: [read_file, run_shell]
---

# 스킬 제목
## 절차
1. ...
```

## 새 도구 추가하기

`src/tools/` 에 `Tool` 인터페이스를 구현하고 `src/tools/index.ts` 의 `defaultTools` 에 추가합니다.

```ts
export const myTool: Tool = {
  name: "my_tool",
  description: "무엇을 하는 도구인지",
  parameters: { type: "object", properties: { x: { type: "string" } }, required: ["x"] },
  dangerous: false, // true 면 실행 전 승인
  async run(args, ctx) { return "결과 문자열"; },
};
```

## 프로젝트 구조

| 경로 | 역할 |
|---|---|
| `src/agent.ts` | 에이전트 루프 (핵심) + 서브에이전트 |
| `src/llm.ts` | OpenAI 호환 LLM 클라이언트 (비스트리밍/스트리밍) |
| `src/skills.ts` | SKILL.md 재귀 로더 / 카테고리 레지스트리 |
| `src/tools/` | 도구 정의 (fs, bash, web_search/web_fetch, update_plan, list_skills/invoke_skill, spawn_agent) |
| `src/session.ts` | 대화 영속화 세션 스토어 |
| `src/permissions.ts` | 위험 작업 승인 게이트 |
| `src/config.ts` | .env 설정 로더 |
| `src/index.ts` | CLI 진입점 (REPL, 스트리밍) |
| `src/server.ts` | HTTP 서버 모드 |
| `bot/` | Python 텔레그램 봇 |
| `skills/` | 스킬 정의 폴더 |
| `test/` | 유닛 테스트 (node:test) |

## 테스트

```bash
npm test        # node:test + tsx 로 유닛 테스트 실행
npm run typecheck
```

LLM 없이 도는 순수 로직을 검증합니다 — 스킬 로더/카테고리/2단계 탐색/suggest, 세션 영속화,
컨텍스트 절삭(`truncateHistory`), 에이전트 루프·반복 가드·강제 종료(가짜 LLM 사용).

## 안전 장치

- `write_file` / `run_shell` 은 실행 전 사용자 승인 (y / n / a=세션 항상 허용).
- 파일 접근은 작업 디렉터리 밖으로 나갈 수 없음 (경로 탈출 방어).
- `MAX_STEPS` 로 무한 루프, `MAX_DEPTH` 로 무한 서브에이전트 위임 방지.
- **반복 호출 가드**로 소형 모델의 동일-도구 루프를 억제·강제 종료.
- **컨텍스트 관리**(`CONTEXT_MAX_CHARS`)로 히스토리가 모델 컨텍스트를 넘지 않게 함
  (tool_call 짝을 깨지 않도록 user 경계에서 처리). 기본적으로 잘려나갈 오래된 대화를
  **LLM 으로 압축 요약**해 누적 유지하므로(`CONTEXT_SUMMARIZE`, 세션에 영속화) 핵심 맥락을 잃지 않고
  세션을 오래 이어갈 수 있음. 끄면(`=false`) 요약 없이 절삭.
- 서버 모드는 위험 도구를 `AUTO_APPROVE=true` 일 때만 실행 (+ 선택적 토큰 인증).
- `AUTO_APPROVE=true` 로 승인 생략 가능 (자동화 시에만 권장).
- **도구 비활성화**(`DISABLED_TOOLS=run_shell,write_file`)로 공개/서버 배포 시 위험 도구를 아예 제거.
- 서버는 위험 조합(자동승인 + 위험 도구 + 토큰 없음) 감지 시 **기동 경고**를 출력.
- **`web_fetch` SSRF 가드** — localhost/사설 IP·비 http(s) URL 차단 (내부망 접근 방지).
