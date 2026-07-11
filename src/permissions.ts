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
