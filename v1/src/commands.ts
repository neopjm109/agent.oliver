import { resolve } from "node:path";
import { existsSync } from "node:fs";
import type { SkillRegistry, Skill } from "./skills.js";
import type { SessionStore } from "./session.js";
import { loadSoul, listSouls } from "./soul.js";

/**
 * CLI·서버(텔레그램 봇)가 공유하는 슬래시 명령 해석기.
 * 한 곳에서 명령을 파싱/처리해, 어느 인터페이스든 동일한 명령 체계를 갖게 한다.
 *
 * 공용 명령:
 *   /help              명령 도움말
 *   /skills            카테고리 대표(짧은 진입점) 스킬 목록
 *   /soul [이름|off]   페르소나 목록 / 변경 / 해제 (세션에 영속)
 *   /sessions          저장된 세션 목록
 *   /session [id|new [id]|delete id]  현재 세션 정보 / 전환 / 생성 / 삭제
 *   /pwd               현재 작업 경로 (워크스페이스 루트 + 작업 하위 폴더)
 *   /reset             현재 세션 대화 초기화 (페르소나는 유지)
 *   /<스킬명> [요청]    스킬 직접 실행
 */

export interface CommandCtx {
  skills: SkillRegistry;
  store: SessionStore;
  session: string;
  soulsDir: string;
  /**
   * 현재 세션의 워크스페이스 루트(절대경로). '/pwd' 가 현재 작업 경로를 계산하는 데 쓴다.
   * workspacePerSession=true 면 cwd/<세션ID>, 아니면 cwd 루트. 생략하면 '/pwd' 는 상대 workdir 만 표시.
   */
  workspaceRoot?: string;
  /**
   * '/<스킬명>' 으로 리프(비-카테고리) 스킬을 직접 호출하도록 허용할지.
   * false 면 카테고리 대표 스킬만 직접 호출 가능(리프는 안내 후 거부).
   * 생략(undefined)하면 허용 — 이 제약은 사람용 CLI 에만 적용하기 위함이며,
   * LLM 의 invoke_skill 자율 호출과는 무관하다(레지스트리를 건드리지 않음).
   */
  allowLeafSkill?: boolean;
}

/** 명령 처리 결과의 부수효과 — 호출측(특히 CLI)이 인메모리 상태를 갱신하는 신호 */
export type Effect =
  | { kind: "reset" }
  | { kind: "persona"; persona: string | null }
  | { kind: "session"; session: string }; // 다른 세션으로 전환 (CLI 전용; 서버는 무시)

export type Interpretation =
  | { type: "message"; text: string } // 명령이 아님 → 일반 입력으로 처리
  | { type: "reply"; text: string; effect?: Effect } // 텍스트만 응답 (에이전트 미실행)
  | { type: "skill"; skill: Skill; text: string } // 스킬을 실어 에이전트 실행
  | { type: "error"; text: string }; // 잘못된 명령/스킬 안내

/** /help 등에서 보여줄 공용 내장 명령 목록 (단일 출처) */
export const BUILTIN_COMMANDS: { usage: string; desc: string }[] = [
  { usage: "/help", desc: "이 도움말" },
  { usage: "/skills", desc: "카테고리 스킬(짧은 진입점) 목록" },
  { usage: "/soul [이름|off]", desc: "페르소나 목록 / 변경 / 해제" },
  { usage: "/sessions", desc: "저장된 세션 목록" },
  { usage: "/session [id]", desc: "세션 정보 / 전환 / 생성(new [id]) / 삭제(delete id)" },
  { usage: "/history [n]", desc: "최근 대화 n개 표시 (기본 5)" },
  { usage: "/pwd", desc: "현재 작업 경로 표시 (워크스페이스 루트 + 작업 하위 폴더)" },
  { usage: "/reset", desc: "현재 세션 대화 초기화 (페르소나 유지)" },
];

export function helpText(): string {
  const lines = BUILTIN_COMMANDS.map((c) => `  ${c.usage.padEnd(18)}${c.desc}`);
  return (
    "사용 가능한 명령어:\n" +
    lines.join("\n") +
    "\n  " +
    "/<스킬명> [요청]".padEnd(18) +
    "스킬 직접 실행 (목록: /skills)"
  );
}

/** 카테고리 대표 스킬 목록을 한 줄씩 정렬해 문자열로 만든다. ('/skills' 출력) */
export function categorySkillsText(skills: SkillRegistry): string {
  const entries = skills.categoryEntries();
  if (!entries.length) return "카테고리 대표 스킬이 없습니다. (skills/<카테고리>/SKILL.md 로 추가)";
  const lines = entries.map((s) => {
    // 대표 스킬 설명 앞의 정형 문구를 걷어내고 한 줄로 축약
    const desc = s.description
      .replace(/^Short entry point for the .*? category\.\s*/i, "")
      .replace(/\s*Invoke as '.*$/i, "")
      .trim();
    const short = desc.length > 100 ? desc.slice(0, 99) + "…" : desc;
    return `  /${s.name}${" ".repeat(Math.max(1, 16 - s.name.length))}${short}`;
  });
  return `카테고리 스킬 ${entries.length}개 — '/이름 [요청]' 으로 실행:\n` + lines.join("\n");
}

/** '/pwd' — 현재 작업 경로(워크스페이스 루트 + 작업 하위 폴더)를 사람이 읽기 좋게 만든다. */
function pwdText(ctx: CommandCtx): string {
  const wd = ctx.store.loadWorkdir(ctx.session); // 마지막 턴에 영속된 작업 하위 폴더 ("" = 루트)
  const root = ctx.workspaceRoot;
  if (!root) {
    // 워크스페이스 루트를 못 받은 컨텍스트 — 상대 하위 폴더만 안내
    return `현재 작업 하위 폴더: ${wd || "(루트)"}`;
  }
  const abs = wd ? resolve(root, wd) : root;
  const missing = wd && !existsSync(abs) ? "  ⚠️ (폴더가 존재하지 않아 다음 작업은 루트에서 시작됩니다)" : "";
  return (
    `현재 작업 경로: ${abs}${missing}\n` +
    `  • 워크스페이스 루트: ${root}\n` +
    `  • 작업 하위 폴더  : ${wd || "(루트)"}`
  );
}

function soulCommand(args: string, ctx: CommandCtx): Interpretation {
  const arg = args.trim();
  // 인자 없음 → 목록 + 현재 페르소나
  if (!arg) {
    const avail = listSouls(ctx.soulsDir);
    const cur = ctx.store.loadPersona(ctx.session);
    const listing = avail.length ? avail.map((n) => `• ${n}`).join("\n") : "(등록된 페르소나 없음)";
    return {
      type: "reply",
      text:
        `현재 페르소나: ${cur ?? "(일반 모드)"}\n사용 가능한 페르소나:\n${listing}\n\n` +
        "변경: /soul <이름>   |   일반 모드: /soul off",
    };
  }
  // 해제
  if (["off", "none", "해제", "일반"].includes(arg.toLowerCase())) {
    ctx.store.savePersona(ctx.session, null);
    return {
      type: "reply",
      text: "일반 모드로 변경했습니다.",
      effect: { kind: "persona", persona: null },
    };
  }
  // 변경
  const name = arg.split(/\s+/)[0];
  if (!loadSoul(ctx.soulsDir, name)) {
    const avail = listSouls(ctx.soulsDir);
    return {
      type: "error",
      text: `페르소나 '${name}' 을(를) 찾을 수 없습니다.\n사용 가능: ${avail.join(", ") || "(없음)"}`,
    };
  }
  ctx.store.savePersona(ctx.session, name);
  return {
    type: "reply",
    text: `페르소나를 '${name}' 로 변경했습니다.`,
    effect: { kind: "persona", persona: name },
  };
}

/** 저장된 세션 목록을 문자열로 만든다 ('/sessions' 출력). 현재 세션엔 ▸ 표시. */
export function sessionsText(ctx: CommandCtx): string {
  const list = ctx.store.list();
  if (!list.length) return "저장된 세션이 없습니다.";
  const lines = list.map((s) => {
    const mark = s.id === ctx.session ? "▸" : " ";
    const persona = s.persona ? `, ${s.persona}` : "";
    return `  ${mark} ${s.id}${" ".repeat(Math.max(1, 16 - s.id.length))}(${s.messages}개 메시지${persona})`;
  });
  return `세션 ${list.length}개 — '/session <id>' 로 전환:\n` + lines.join("\n");
}

/** 프레임워크가 주입한 내부 user 메시지(스킬 지침·교정 넛지 등)는 대화 표시에서 제외한다. */
function isInjectedUserMessage(content: string): boolean {
  return /SKILL 지침 시작|이 요청에 맞는 스킬을 로드|아직 계획에 남은 단계|직전 턴과 거의 동일|도구를 반복 호출하고 있습니다/.test(
    content,
  );
}

/**
 * 현재 세션의 최근 대화 n개(사용자·어시스턴트 텍스트만)를 보기 좋게 만든다.
 * '/history' 명령과 CLI 시작 시 복원 세션 미리보기에 공유된다. 프레임워크 내부 주입 메시지는 뺀다.
 */
export function recentMessagesText(store: SessionStore, session: string, n = 5): string {
  const msgs = store.load(session).filter((m) => {
    if (m.role !== "user" && m.role !== "assistant") return false;
    if (typeof m.content !== "string" || !m.content.trim()) return false;
    if (m.role === "user" && isInjectedUserMessage(m.content)) return false;
    return true;
  });
  if (!msgs.length) return "(이 세션에 표시할 대화가 없습니다.)";
  const recent = msgs.slice(-Math.max(1, n));
  const lines = recent.map((m) => {
    const who = m.role === "user" ? "👤" : "🤖";
    const text = String(m.content).replace(/\s+/g, " ").trim();
    const clipped = text.length > 300 ? text.slice(0, 300) + " …" : text;
    return `${who} ${clipped}`;
  });
  return `─ 최근 대화 ${recent.length}개 (세션 ${session}) ─\n` + lines.join("\n");
}

/** 기존 세션과 겹치지 않는 새 세션 ID(로컬 타임스탬프 YYYY-MM-DD_HH-MM-SS)를 만든다. */
function freshSessionId(ctx: CommandCtx): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const base =
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
  const existing = new Set(ctx.store.list().map((s) => s.id));
  if (!existing.has(base)) return base;
  // 같은 초에 여러 개 생성 시 접미 번호로 유일성 확보
  let n = 2;
  while (existing.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** '/session' 명령: 인자 없음=현재 정보, 'new [id]'=생성, 'delete <id>'=삭제, '<id>'=전환. */
function sessionCommand(args: string, ctx: CommandCtx): Interpretation {
  const parts = args.trim().split(/\s+/).filter(Boolean);

  // 인자 없음 → 현재 세션 정보
  if (!parts.length) {
    const count = ctx.store.load(ctx.session).length;
    const persona = ctx.store.loadPersona(ctx.session);
    return {
      type: "reply",
      text:
        `현재 세션: ${ctx.session} (${count}개 메시지, 페르소나: ${persona ?? "없음"})\n` +
        "새 세션: /session new [id]   |   전환: /session <id>   |   목록: /sessions   |   삭제: /session delete <id>",
    };
  }

  // /session new [id] → 빈 세션을 만들고 전환 (id 없으면 자동 생성)
  if (["new", "create"].includes(parts[0].toLowerCase())) {
    const id = parts[1] ?? freshSessionId(ctx);
    if (parts[1] && ctx.store.exists(id)) {
      return { type: "error", text: `세션 '${id}' 이(가) 이미 있습니다. 전환하려면 /session ${id}` };
    }
    ctx.store.resetConversation(id); // 빈 세션 파일을 즉시 생성 → 목록에 바로 노출
    return {
      type: "reply",
      text: `새 세션 '${id}' 을(를) 만들고 전환했습니다.`,
      effect: { kind: "session", session: id },
    };
  }

  // /session delete <id>
  if (["delete", "del", "rm"].includes(parts[0].toLowerCase())) {
    const id = parts[1];
    if (!id) return { type: "error", text: "삭제할 세션 ID를 지정하세요: /session delete <id>" };
    if (!ctx.store.exists(id)) {
      return { type: "error", text: `세션 '${id}' 이(가) 없습니다. (/sessions 로 확인)` };
    }
    ctx.store.clear(id);
    // 현재 세션을 지웠다면 인메모리 상태도 초기화하도록 신호를 보낸다.
    if (id === ctx.session) {
      return { type: "reply", text: `현재 세션 '${id}' 을(를) 삭제하고 초기화했습니다.`, effect: { kind: "reset" } };
    }
    return { type: "reply", text: `세션 '${id}' 을(를) 삭제했습니다.` };
  }

  // /session <id> → 전환 (없는 ID면 새로 시작)
  const id = parts[0];
  if (id === ctx.session) return { type: "reply", text: `이미 '${id}' 세션입니다.` };
  const existed = ctx.store.exists(id);
  const count = existed ? ctx.store.load(id).length : 0;
  return {
    type: "reply",
    text: existed
      ? `세션 '${id}' 로 전환했습니다 (${count}개 메시지 복원).`
      : `새 세션 '${id}' 로 전환했습니다.`,
    effect: { kind: "session", session: id },
  };
}

/** 입력 한 줄을 해석한다. '/' 로 시작하지 않으면 일반 메시지로 돌려준다. */
export function interpret(input: string, ctx: CommandCtx): Interpretation {
  const trimmed = input.trim();
  const m = trimmed.match(/^\/(\S+)\s*([\s\S]*)$/);
  if (!m) return { type: "message", text: trimmed };
  const token = m[1];
  const args = m[2].trim();

  switch (token.toLowerCase()) {
    case "help":
    case "start": // 텔레그램 관례: /start → 도움말
      return { type: "reply", text: helpText() };
    case "skills":
      return { type: "reply", text: categorySkillsText(ctx.skills) };
    case "soul":
      return soulCommand(args, ctx);
    case "sessions":
      return { type: "reply", text: sessionsText(ctx) };
    case "session":
      return sessionCommand(args, ctx);
    case "history":
    case "recent": {
      const n = Math.min(50, Math.max(1, parseInt(args, 10) || 5));
      return { type: "reply", text: recentMessagesText(ctx.store, ctx.session, n) };
    }
    case "pwd":
    case "cwd":
    case "where":
    case "workdir":
      return { type: "reply", text: pwdText(ctx) };
    case "reset":
      // 대화·요약만 비우고 페르소나는 유지한다.
      ctx.store.resetConversation(ctx.session);
      return { type: "reply", text: "현재 세션의 대화 기록을 초기화했습니다. (페르소나는 유지)", effect: { kind: "reset" } };
  }

  // 그 외 → 스킬 직접 호출 (원래 대소문자로 조회)
  const skill = ctx.skills.get(token);
  if (skill) {
    // CLI 등에서 리프 스킬 직접 호출을 막은 경우 — 카테고리 진입점만 허용
    if (ctx.allowLeafSkill === false && !skill.isCategoryEntry) {
      return {
        type: "error",
        text:
          `'/${token}' 은 리프 스킬이라 직접 호출이 비활성화되어 있습니다.\n` +
          `카테고리 진입점(/skills 로 목록 확인)을 쓰거나, 자연어로 요청하면 에이전트가 알아서 부릅니다.\n` +
          `리프 직접 호출을 켜려면 CLI_ALLOW_LEAF_SKILL=true.`,
      };
    }
    return { type: "skill", skill, text: args };
  }

  const suggestions = ctx.skills.suggest(token);
  return {
    type: "error",
    text:
      `알 수 없는 명령/스킬: /${token}` +
      (suggestions.length
        ? `\n혹시 이건가요? ${suggestions.map((s) => "/" + s).join(", ")}`
        : "\n/skills 로 목록을 확인하거나 /help 를 입력하세요."),
  };
}
