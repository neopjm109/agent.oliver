import { createInterface, type Interface } from "node:readline/promises";

/**
 * 위험한 도구 실행 전 사용자 승인을 받는 게이트.
 * autoApprove=true 면 항상 허용, 아니면 터미널로 y/n 질의.
 * 세션 동안 특정 종류의 작업을 계속 허용하는 'a'(always) 옵션 지원.
 */
export class PermissionGate {
  private alwaysAllow = new Set<string>();
  constructor(
    private rl: Interface,
    private autoApprove: boolean,
  ) {}

  async request(action: string, detail: string): Promise<boolean> {
    if (this.autoApprove || this.alwaysAllow.has(action)) return true;

    console.log(`\n⚠️  승인 요청 — ${action}`);
    console.log(`   ${detail}`);
    const answer = (
      await this.rl.question("   허용하시겠습니까? [y=예 / n=아니오 / a=이 세션 항상 허용] ")
    )
      .trim()
      .toLowerCase();

    if (answer === "a") {
      this.alwaysAllow.add(action);
      return true;
    }
    return answer === "y" || answer === "yes";
  }
}

/**
 * '/스킬명' 슬래시 명령을 Tab 으로 자동완성하는 completer 를 만든다.
 * 줄이 '/' 로 시작하고 아직 공백(=인자)이 없을 때의 첫 토큰만 완성 대상이며,
 * 그 외 입력(자유 텍스트·승인 y/n/a 프롬프트)에는 관여하지 않는다.
 */
function makeSkillCompleter(skillNames: string[]) {
  return (line: string): [string[], string] => {
    if (!line.startsWith("/") || line.includes(" ")) return [[], line];
    const token = line.slice(1);
    const matches = skillNames.filter((n) => n.startsWith(token)).map((n) => `/${n}`);
    // 접두사 일치가 없고 '/' 만 친 상태면 전체 목록을 힌트로 보여준다.
    const hits = matches.length ? matches : token ? [] : skillNames.map((n) => `/${n}`);
    return [hits, line];
  };
}

export function makeReadline(skillNames: string[] = []): Interface {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: skillNames.length ? makeSkillCompleter(skillNames) : undefined,
  });
}

/**
 * 키 입력이 '전송 없이 줄바꿈'을 의미하는지 판별한다.
 * 터미널은 기본적으로 Enter 와 Shift+Enter 를 같은 바이트(\r)로 보내 구분이 불가능하다.
 * 다만 다음은 실측상 Node readline 이 안전하게 구분해 준다:
 *  - Alt/Option+Enter → meta+return (거의 모든 터미널에서 바로 동작)
 *  - kitty keyboard protocol 의 수식키+Enter → ESC[13;<mods>u (kitty·ghostty 등)
 * modifyOtherKeys(ESC[27;2;13~)는 Node 파서가 "13~"를 본문에 흘려 오염시키므로 쓰지 않는다.
 */
function isNewlineKey(str: string | undefined, key: KeyEvent | undefined): boolean {
  const seq = key?.sequence ?? str;
  // 수식키(Alt/Shift/Ctrl) + Enter → 줄바꿈
  if (key && (key.name === "return" || key.name === "enter") && (key.meta || key.shift || key.ctrl)) {
    return true;
  }
  // kitty 프로토콜의 수식키+Enter (ESC[13;<mods>u). 수식키 없는 ESC[13u(=일반 Enter)는 제외.
  if (typeof seq === "string" && /^\x1b\[13;\d+u$/.test(seq)) return true;
  // 일부 터미널의 Alt+Enter 원문(ESC + CR/LF)
  if (str === "\x1b\r" || str === "\x1b\n") return true;
  return false;
}

interface KeyEvent {
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  sequence?: string;
}

export interface MultilinePrompts {
  /** 첫 줄 프롬프트 (예: "👤 ") */
  prompt: string;
  /** 이어지는 줄 프롬프트 (예: 흐린 "… ") */
  continuation: string;
}

/**
 * 여러 줄 입력을 읽는다. Enter 는 전송, 아래 두 방법으로 '전송 없이 줄바꿈' 가능:
 *  1) 줄 끝에 백슬래시 `\` — 모든 터미널에서 100% 동작(한글·Tab 자동완성 그대로).
 *     끝의 `\\`(두 개)는 리터럴 백슬래시 한 개로 처리.
 *  2) Option(⌥)+Enter (또는 kitty 계열의 Shift+Enter) — 터미널이 구분 시퀀스를 보내면 자동 감지.
 *
 * readline 라인 모드를 유지하므로 한글 IME 조합 입력이 깨지지 않는다.
 */
export async function askMultiline(rl: Interface, prompts: MultilinePrompts): Promise<string> {
  const isTTY = !!process.stdin.isTTY;
  let forceNewline = false;
  // 줄바꿈 키가 오면 현재 줄을 강제 제출하고(=readline 자체로는 제출되지 않음) 이어읽기 플래그를 세운다.
  const onKeypress = (str: string | undefined, key: KeyEvent | undefined) => {
    if (isNewlineKey(str, key)) {
      forceNewline = true;
      rl.write(null as unknown as string, { name: "return" });
    }
  };
  if (isTTY) process.stdin.prependListener("keypress", onKeypress);

  const lines: string[] = [];
  try {
    while (true) {
      const line = await rl.question(lines.length === 0 ? prompts.prompt : prompts.continuation);
      if (forceNewline) {
        forceNewline = false;
        lines.push(line);
        continue;
      }
      // 백슬래시 연속: 끝이 `\`(단, `\\`는 리터럴)면 다음 줄로 이어간다.
      if (line.endsWith("\\") && !line.endsWith("\\\\")) {
        lines.push(line.slice(0, -1));
        continue;
      }
      lines.push(line.endsWith("\\\\") ? line.slice(0, -1) : line);
      break;
    }
  } finally {
    if (isTTY) process.stdin.removeListener("keypress", onKeypress);
  }
  return lines.join("\n");
}
