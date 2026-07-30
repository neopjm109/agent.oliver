import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { ChatCompletionMessageParam } from "./llm.js";

// 이 모듈은 Agent 의 상태에 의존하지 않는 순수 헬퍼만 모은다.
// (히스토리 예산 계산·문자열 정규화·자동저장 파일명 등) — 단위 테스트하기 쉽고 재사용 가능하다.

// ─────────────────────────────────────────────────────────────────────────────
// 히스토리 예산 (컨텍스트 압축)
// ─────────────────────────────────────────────────────────────────────────────

/** 메시지 하나의 대략적 크기(문자 수). tool_calls 의 이름·인자 길이도 더한다. */
export function messageSize(m: ChatCompletionMessageParam): number {
  let n = (typeof m.content === "string" ? m.content.length : 0) + 20;
  const tc = (m as any).tool_calls;
  if (Array.isArray(tc)) {
    for (const c of tc) n += (c.function?.name?.length ?? 0) + (c.function?.arguments?.length ?? 0) + 10;
  }
  return n;
}

/**
 * 히스토리를 예산 기준으로 { system, dropped, kept } 로 나눈다.
 * - system 메시지(messages[0])는 항상 유지.
 * - 최신부터 예산까지가 kept, 그보다 오래된 앞부분이 dropped.
 * - tool_call 짝을 깨지 않도록 kept 는 user 메시지에서 시작 (앞쪽 orphan 은 dropped 로).
 * (OpenAI 규칙: assistant(tool_calls) 뒤엔 반드시 대응 tool 메시지가 와야 함)
 */
export function splitHistory(
  messages: ChatCompletionMessageParam[],
  maxChars: number,
): {
  system: ChatCompletionMessageParam[];
  dropped: ChatCompletionMessageParam[];
  kept: ChatCompletionMessageParam[];
} {
  const system = messages[0]?.role === "system" ? [messages[0]] : [];
  const rest = messages.slice(system.length);
  const systemChars = system.reduce((s, m) => s + messageSize(m), 0);
  const budget = Math.max(0, maxChars - systemChars);

  let startIdx = rest.length; // kept = rest.slice(startIdx)
  let total = 0;
  for (let i = rest.length - 1; i >= 0; i--) {
    const size = messageSize(rest[i]);
    if (total + size > budget && startIdx <= rest.length - 1) break; // 최소 1개는 유지
    total += size;
    startIdx = i;
  }
  // 앞쪽 orphan(비 user)을 버려 user 경계에서 시작
  while (startIdx < rest.length && rest[startIdx].role !== "user") startIdx++;
  return { system, dropped: rest.slice(0, startIdx), kept: rest.slice(startIdx) };
}

/** 히스토리가 예산을 넘으면 오래된 메시지를 잘라낸다 (요약 없이 버림). */
export function truncateHistory(
  messages: ChatCompletionMessageParam[],
  maxChars: number,
): ChatCompletionMessageParam[] {
  if (messages.length === 0) return messages;
  const { system, kept } = splitHistory(messages, maxChars);
  return [...system, ...kept];
}

// ─────────────────────────────────────────────────────────────────────────────
// 반복 호출·응답 감지
// ─────────────────────────────────────────────────────────────────────────────

/** 키 순서와 무관하게 안정적인 JSON 문자열 (반복 호출 시그니처용) */
export function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj) ?? "null";
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(",")}]`;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

/** 크로스턴 반복 감지용 정규화 (공백 접기·소문자화). */
export function normalizeForCompare(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * '실제로 하진 않고 하겠다고 서술만' 하거나 사용자에게 되묻는 '중도 멈춤' 문장인지 판정한다.
 * 계획 미완 상태에서 이 신호가 있을 때만 다음 단계 수행을 밀어붙여, 모델이 작업을 다 하고도
 * update_plan 으로 완료 표시를 안 해 '미완'으로 보이는 경우 이미 끝낸 작업을 다시 시키는
 * 오작동(false positive → 같은 동작 반복)을 막는다. 완료 요약으로 끝나면 밀어붙이지 않는다.
 */
export function looksLikeStall(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // (1) 미래/진행 의도: 하겠·할게·하려·진행하·만들겠·작성하·시작하·준비하·이어서·다음 단계·계속 진행·하고 있·하는 중
  const intent =
    /(하겠|할게|할 것|하려|진행하|만들겠|작성하|시작하|준비하|이어서|다음\s*단계|다음으로|계속\s*진행|하고\s*있|하는\s*중)/;
  // (2) 되묻기: 물음표로 끝나거나 선택/의향을 물음
  const asking = /[?？]\s*$/.test(t) || /(알려\s*주|원하시|어떻게\s*(할|하|진행)|무엇을|어느\s*것|선택해|골라)/.test(t);
  return intent.test(t) || asking;
}

// ─────────────────────────────────────────────────────────────────────────────
// 텍스트/에러 정제
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 모델이 도구 호출을 API(tool_calls) 가 아니라 '텍스트'로 뱉는 경우의 마크업을 제거한다.
 * 특히 도구를 끈 호출(forceFinal)에서 qwen/Hermes 계열이 [TOOL_REQUEST]…나 <tool_call>… 를
 * 본문에 그대로 흘리는데, 그게 사용자에게 노출·히스토리에 저장되지 않도록 걷어낸다.
 * (닫는 태그 없이 잘린 경우도 뒤까지 통째로 제거)
 */
export function stripTextToolCalls(text: string): string {
  return text
    .replace(/\[TOOL_REQUEST\][\s\S]*?\[END_TOOL_REQUEST\]/g, "")
    .replace(/\[TOOL_REQUEST\][\s\S]*$/g, "")
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
    .replace(/<tool_call>[\s\S]*$/g, "")
    .replace(/<\|tool_call\|>[\s\S]*$/g, "")
    .replace(/```tool_code[\s\S]*?```/g, "")
    .trim();
}

/**
 * 컨텍스트 창 초과 계열 에러인지 판별한다. 서버·SDK 마다 문구가 달라(LM Studio·Ollama·vLLM 등)
 * 메시지와 파싱된 본문(err.error)을 폭넓게 매칭한다.
 *
 * 본문에 '창 초과'가 명시된 경우만 true (키워드 기반). 일반 5xx 는 호출부에서 히스토리 크기를
 * 함께 보고 축소 여부를 판단한다 — 키워드 없는 5xx 를 무조건 창 초과로 보면 예산이 과잉 붕괴한다.
 */
export function isContextOverflow(err: any): boolean {
  const body = err?.error ?? err?.response?.data ?? err?.response?.body ?? "";
  const s = `${err?.message ?? ""} ${typeof body === "string" ? body : JSON.stringify(body)}`.toLowerCase();
  return (
    s.includes("context length") ||
    s.includes("context window") ||
    s.includes("context size") ||
    s.includes("maximum context") ||
    s.includes("tokens to keep") ||
    s.includes("too many tokens") ||
    s.includes("exceeds") ||
    (s.includes("token") && (s.includes("maximum") || s.includes("limit") || s.includes("too long")))
  );
}

/** 로그에 찍을 도구 인자 요약 (길면 자름) */
export function summarizeArgs(args: Record<string, any>): string {
  const s = Object.entries(args)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(", ");
  return s.length > 120 ? s.slice(0, 117) + "..." : s;
}

// ─────────────────────────────────────────────────────────────────────────────
// 산출물 자동 저장 (파일명·순번·히스토리 포인터)
// ─────────────────────────────────────────────────────────────────────────────

/** 문서 본문에서 제목(첫 마크다운 헤더 또는 첫 줄)을 뽑는다. */
function docHeading(body: string): string {
  return body.match(/^#{1,6}\s+(.+)$/m)?.[1] ?? body.split("\n")[0] ?? "산출물";
}

/**
 * 저장한 문서 원문을 대신해 히스토리에 남길 짧은 포인터. 원문은 파일에 보존되므로
 * 모델은 "무엇을 만들어 어디에 저장했는지"만 알면 되고, 히스토리는 가볍게 유지된다.
 */
export function interimPointer(filename: string, body: string): string {
  return `📄 [문서 「${docHeading(body).trim().slice(0, 60)}」 을(를) 파일로 저장함: ${filename}] (원문은 파일에 보존 — 히스토리에서는 생략)`;
}

/** 이미 파일로 저장된(파일명 불명) 문서 원문을 대신할 히스토리 포인터. */
export function interimPointerSaved(body: string): string {
  return `📄 [문서 「${docHeading(body).trim().slice(0, 60)}」 를 파일로 저장함] (원문은 파일에 보존 — 히스토리에서는 생략)`;
}

/** 자동 저장할 산출물의 파일명을 만든다 (첫 마크다운 헤더/첫 줄에서 유도 + 타임스탬프). */
export function artifactFilename(body: string, now: Date = new Date()): string {
  let base = docHeading(body)
    .replace(/[^\p{L}\p{N}\s-]/gu, "") // 문자·숫자·공백·하이픈만 남김(이모지·괄호·기호 제거)
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40)
    .replace(/^-+|-+$/g, "");
  if (!base) base = "산출물";
  const ts = now.toISOString().replace(/[:.]/g, "-").slice(0, 19); // YYYY-MM-DDTHH-MM-SS
  return `${base}-${ts}.md`;
}

/** 정수를 최소 두 자리로 0 채움 (01, 02 … 100). 자동 저장 파일 순번용. */
export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * 폴더 안의 자동 저장 파일(`NN-...`) 중 가장 큰 순번을 반환한다(없으면 0).
 * run 시작 시 이 값에서 이어 번호를 매겨, 여러 턴에 걸쳐도 순번이 겹치거나 되돌아가지 않게 한다.
 */
export function maxArtifactSeq(dir: string): number {
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return 0; // 폴더가 아직 없으면 0부터
  }
  let max = 0;
  for (const f of files) {
    const m = f.match(/^(\d{2,})-/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

// ─────────────────────────────────────────────────────────────────────────────
// 산출물 존재 검증 (파일 없이 '완료' 마킹·거짓 자기점검 방지)
// ─────────────────────────────────────────────────────────────────────────────

/** 산출물로 취급할 파일 확장자(문서·코드·데이터). 일반 산문 속 낱말의 오탐을 줄이려 화이트리스트만 본다. */
const ARTIFACT_EXT =
  "md|markdown|txt|json|ya?ml|toml|tsx?|jsx?|mjs|cjs|py|java|kt|go|rs|rb|php|cc?|cpp|hpp|h|cs|swift|sql|csv|tsv|html?|s?css|sh|xml";
const FILENAME_RE = new RegExp(`([\\w-]+\\.(?:${ARTIFACT_EXT}))\\b`, "gi");
/** '만들지 못했다/없다/실패' 처럼 파일이 없음을 스스로 인정하는 단서 — 정직한 실패 보고를 오탐하지 않기 위함. */
const NEG_CUE =
  /(못\s?만들|못\s?했|만들지\s?못|생성되지|생성하지\s?못|미생성|없|누락|실패|not\s+(created|generated|saved|found)|missing|failed?|unable|couldn['’]?t|could\s+not)/i;
const WS_IGNORE = new Set([".git", "node_modules", ".next", "dist", "build", ".turbo", ".cache"]);

/** 텍스트에서 산출물 파일명(basename)을 중복 없이 뽑는다. 경로가 붙어 있어도 파일명만 남는다. */
export function extractFilenames(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of text.matchAll(FILENAME_RE)) {
    const key = m[1].toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(m[1]);
    }
  }
  return out;
}

/** 워크스페이스 루트 하위의 모든 파일 basename(소문자) 집합을 수집한다. 노이즈 폴더 제외, 순회량 상한. */
export function collectWorkspaceFiles(root: string): Set<string> {
  const names = new Set<string>();
  const stack = [root];
  let budget = 20000; // 과도 순회 방지(대형 트리 안전장치)
  while (stack.length && budget > 0) {
    const dir = stack.pop()!;
    let entries: any[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      budget--;
      if (e.isDirectory()) {
        if (!WS_IGNORE.has(e.name)) stack.push(resolve(dir, e.name));
      } else {
        names.add(String(e.name).toLowerCase());
      }
    }
  }
  return names;
}

/** name 이 텍스트에서 '없음/실패' 단서 없이 언급된 곳이 하나라도 있으면 true(= 생성됐다는 주장으로 간주). */
function mentionedAsCreated(text: string, name: string): boolean {
  const lower = text.toLowerCase();
  const target = name.toLowerCase();
  for (let idx = lower.indexOf(target); idx !== -1; idx = lower.indexOf(target, idx + target.length)) {
    const win = text.slice(Math.max(0, idx - 30), idx + target.length + 30);
    if (!NEG_CUE.test(win)) return true; // 부정 단서 없는 등장 = 생성됐다는 주장
  }
  return false;
}

/**
 * 텍스트가 '생성했다'고 제시하지만 워크스페이스에 실제로는 없는 산출물 파일명들을 돌려준다.
 * 모든 등장 위치가 '없음/실패' 문맥인 파일(정직하게 실패를 보고한 경우)은 제외한다.
 */
export function claimedButMissing(text: string, root: string): string[] {
  const claimed = extractFilenames(text);
  if (!claimed.length) return [];
  const present = collectWorkspaceFiles(root);
  return claimed.filter((f) => !present.has(f.toLowerCase()) && mentionedAsCreated(text, f));
}

/**
 * 토픽(작업) 폴더명에 쓸 안전한 slug 를 만든다. 스킬명이나 사용자 입력에서
 * 문자·숫자·공백·하이픈만 남기고 소문자화해 30자로 제한한다. 비면 'task'.
 * 경로 구분자·상위경로(`..`)가 될 수 있는 문자는 위 필터로 모두 제거되므로 항상 단일 폴더명이다.
 */
export function topicSlug(raw: string): string {
  const s = raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 30)
    .replace(/^-+|-+$/g, "");
  return s || "task";
}
