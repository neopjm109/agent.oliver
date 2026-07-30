# 스킬 인벤토리 (v3)

현행 카탈로그: **intent 23개 / 스킬 24개**(마크다운 21 + 코드 3).
모델: `1 intent → 1 skill → 1 LLM 호출` 기본 + 복합 요청은 `plan_and_run`(계획→**단계별 승인 진행**,
human-in-the-loop). 정의는 `config/intents.yaml`, 스킬 본문은 `skills/**/SKILL.md`.

> v3 재정립(업무 보조로 방향 확정): `add_capability`→`change_code` 흡수(안내 아니라 **실제 코드 생성**),
> `check_quality`→`review_code` 흡수, 콘텐츠 식단·여행·음악 제거(게임·소설만 유지).
> 오케스트레이터 설계는 [hitl-orchestrator-spec.md](hitl-orchestrator-spec.md), 런타임은 `ARCHITECTURE.md §0`.

---

## intent → skill 매핑

### 오케스트레이션 (2)

| intent | 실행 스킬 | 비고 |
|---|---|---|
| `plan_and_run` | `plan-and-run` (코드) | 복합 요청을 계획 → **한 단계씩 사람이 승인하며 진행**(자동 실행 없음). 부작용 단계는 미리보기→승인→커밋. 산출물 체이닝. 룰(`looksMultiStep`)+LLM(`isComplexRequest`)로 자동 승격 |
| `plan_tasks` | `task-planner` | 실행 없이 순서 있는 Todo 체크리스트만 작성 |

### 개발 (14)

| intent | 슬롯 | 실행 스킬 |
|---|---|---|
| `scaffold_project` | framework[spring,nestjs,django,nextjs,flutter,tauri] | **코드 경로**(pipeline+step): CLI 명령 결정론 조립 → 미리보기 후 실제 실행. `project-scaffolder` SKILL.md 는 폴백용 |
| `convert_document` | — | **코드 경로**(pipeline+convert.ts): 입력(+샘플) 파일을 목표 포맷으로 변환. 단순/샘플 기반(구조 따라감) 2모드. 오피스=pandoc, 텍스트=직접 저장, 결과는 파일 첨부 |
| `translate` | — | **코드 경로**(pipeline+translate.ts): 문서·텍스트를 목표 언어로 번역(한↔영 중심). 방향 자동/명시, 파일이면 `<원본>_<lang>` 첨부, 짧으면 인라인 |
| `write_tests` | — | **코드 경로**(pipeline+tests.ts): 소스 파일→단위 테스트 생성. 언어·러너 자동 판단(node:test/vitest/jest·pytest·JUnit·go test 등), 테스트경로 결정론, 확인 후 저장 |
| `run_command` | — | **코드 경로**(pipeline+runner.ts): 테스트·빌드·린트·타입체크를 화이트리스트로 조립(임의 명령 주입 불가)해 확인 후 실제 실행·결과 보고 |
| `change_code` | — | **코드 경로**(pipeline+step): 파일 경로 있으면 편집(diff→승인), "기능 추가"면 실제 코드 파일 생성(add_capability 흡수), 인라인 코드는 `code-editor` 폴백 |
| `review_code` | — | `code-reviewer` — 버그·설계·가독성 + 보안·성능·취약점·테스트 축 점검(check_quality 흡수) |
| `explain_code` | — | `code-explainer` — 낯선 코드/함수가 뭐 하는지 설명(온보딩·인수인계). 비평은 review_code |
| `design_system` | db_engine[none,mysql,postgresql,mariadb,mongodb] | `architect` — 아키텍처·도메인·API·DB 스키마 1회 설계 |
| `analyze_document` | doc_type[docs-analyze-{docx,xlsx,pptx,pdf,markdown,csv}] | `{doc_type}` — 확장자별 문서 분석 |
| `write_docs` | doc_type[api-guide,release-notes,adr,readme] | `doc-writer` — 개발 문서 작성 |
| `git_artifact` | kind[commit,pr,changelog] | `git-writer` — git 산출물 작성 |
| `setup_deployment` | — | **코드 경로**(pipeline+deploy.ts): 스택 감지 → 빌드 명령·산출물 경로·실행법 + `build.sh` 생성(Docker·CI 없음). 감지 실패 시 `deploy-advisor`(LLM 안내) 폴백 |
| `research_topic` | — | `researcher` — 주제 조사·정리 |

### 콘텐츠·사무 (5)

| intent | 실행 스킬 |
|---|---|
| `write_proposal` | `proposal-writer` (사무/기획) |
| `write_message` | `message-writer` — 업무 메일·메신저 초안 |
| `meeting_minutes` | `meeting-minutes` — 녹취/메모 → 회의록+액션아이템(담당·기한) |
| `write_story` | `story-writer` |
| `run_game_session` | `game-builder` |

### 메타 / fallback (2, 코드 스킬)

| intent | 실행 스킬 | 비고 |
|---|---|---|
| `chitchat` | `chitchat` | 인사·잡담 즉답(소울 시 LLM) |
| `unknown` | `fallback_reply` | threshold 미달·범위밖 → LLM 대화 |

> **상태(status)는 intent 가 아니다.** 인프라 조회라 LLM 라우터를 안 거치고, 파이프라인의 결정론
> 인터셉트가 처리한다: `/status` 명령 + 발화 전체가 상태 질의일 때(`STATUS_QUERY`, 앵커드 정규식).
> `statusFactsBlock`(외부/LLM 의존 0)을 즉시 반환. "잘 돌아가?"(status) vs "잘 지내?"(chitchat)를
> 정규식이 정확히 가른다(임베딩 라우팅이 뭉개던 오분류 제거).

---

## 스킬 목록 (24)

### `skills/dev/` (10)
`architect` · `code-editor` · `code-explainer` · `code-reviewer` · `deploy-advisor` · `doc-writer` ·
`git-writer` · `project-scaffolder` · `researcher` · `task-planner`

### `skills/docs-analyze/` (6)
`docs-analyze-docx` · `docs-analyze-xlsx` · `docs-analyze-pptx` · `docs-analyze-pdf` ·
`docs-analyze-markdown` · `docs-analyze-csv`

### `skills/domains/` (5)
`story-writer` · `game-builder` · `proposal-writer` · `message-writer` · `meeting-minutes`

### 코드 스킬 (3, `src/skills/`)
`chitchat`([chitchat.ts](src/skills/chitchat.ts)) ·
`fallback_reply`([fallbackReply.ts](src/skills/fallbackReply.ts)) ·
`plan-and-run`([orchestrator.ts](src/skills/orchestrator.ts)) — 파이프라인이 주입, 레지스트리 우선순위 최상위.
(상태는 스킬이 아니라 결정론 인터셉트 — `statusFactsBlock`([agentStatus.ts](src/skills/agentStatus.ts)).)

---

## SKILL.md 포맷 규약

마크다운 스킬은 본문(프론트매터 제외)이 그대로 **시스템 프롬프트**가 된다. 런타임은 프론트매터를
벗겨내고 무시하므로 형식 필드는 문서용이다. 스킬명 = **폴더명**(레지스트리가 basename 으로 등록).

```markdown
---
name: <스킬명 = 폴더명>
description: <한 줄 요약 — 문서용>
kind: code | content | meta
tags: [ ... ]
model: inherit
---

# 역할        # 1~2줄
# 지침        # 불릿. 슬롯은 `슬롯: {"key": ...}` 로 user 메시지에 주입됨
# 출력 규칙   # 출력전용: YAML·JSON·메타·머리말 금지, 한국어
# 예시        # 1개
```

원칙: 짧게(~30~50줄) · 출력전용 · 교차 스킬 참조 금지 · `invokes`/`inputs`/`outputs` 미사용.

> 부작용(코드 생성·파일 편집·스캐폴드)은 SKILL.md 가 아니라 `core/step.ts`(prepareStep/commitStep)가
> 담당한다 — 단일턴과 plan 스텝이 같은 생성·커밋 코드를 공유한다.
