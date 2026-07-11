import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 페르소나(SOUL) 로더.
 * souls/<name>.md 본문을 에이전트의 "정체성" 프롬프트로 읽는다.
 * 시작 플래그(--oliver 등)로 특정 페르소나를 선택하며, 없으면 일반 모드(soul=null).
 */

/** souls/<name>.md 본문을 반환. 파일이 없거나 비어 있으면 null. */
export function loadSoul(soulsDir: string, name: string): string | null {
  // 경로 주입 방지: 이름을 안전한 문자로 제한
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const p = resolve(soulsDir, `${safe}.md`);
  if (!existsSync(p)) return null;
  const body = readFileSync(p, "utf8").trim();
  return body || null;
}

/** souls/ 에 존재하는 페르소나 이름 목록 (.md 제거, 정렬) */
export function listSouls(soulsDir: string): string[] {
  if (!existsSync(soulsDir)) return [];
  return readdirSync(soulsDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("."))
    .map((f) => f.slice(0, -3))
    .sort();
}

/**
 * argv 에서 페르소나 플래그를 분리한다.
 * 남은 인자 중 첫 번째 `--name` 을 페르소나로 보고, 나머지는 그대로 돌려준다.
 * (--session 등은 호출 전에 이미 제거되어 있다고 가정)
 * 반환: { persona, rest } — persona 는 이름(없으면 null).
 */
export function extractPersonaFlag(argv: string[]): { persona: string | null; rest: string[] } {
  const rest: string[] = [];
  let persona: string | null = null;
  for (const a of argv) {
    if (persona === null && a.startsWith("--") && a.length > 2) {
      persona = a.slice(2);
    } else {
      rest.push(a);
    }
  }
  return { persona, rest };
}
