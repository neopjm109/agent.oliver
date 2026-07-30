// 소울(페르소나) 로더 — souls/<이름>.md 를 시스템 프롬프트 조각으로 읽는다.
// 대화 표면(fallback·chitchat·응답 다듬기)에만 주입한다. 생성 스킬(SKILL.md)엔 넣지 않는다
// (§10.3: 작은 모델은 좁고 집중된 프롬프트에서 안정적 → 작업 스킬에 페르소나를 얹으면 희석).
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOULS_DIR = resolve(process.cwd(), 'souls');

/** 프론트매터(--- ... ---)가 있으면 제거하고 본문만 반환 */
function stripFrontmatter(md: string): string {
  if (md.startsWith('---')) {
    const end = md.indexOf('\n---', 3);
    if (end !== -1) return md.slice(md.indexOf('\n', end + 1) + 1);
  }
  return md;
}

const cache = new Map<string, string>();

/** souls/ 의 사용 가능한 소울 이름 목록 (확장자 제거, 소문자). */
export function listSouls(): string[] {
  try {
    return readdirSync(SOULS_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.slice(0, -3).toLowerCase())
      .sort();
  } catch {
    return [];
  }
}

/** 소울 본문 반환. 없으면 undefined. (파일 1회 로드 후 캐시) */
export function loadSoul(name: string): string | undefined {
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  if (cache.has(key)) return cache.get(key);
  try {
    const body = stripFrontmatter(readFileSync(resolve(SOULS_DIR, `${key}.md`), 'utf8')).trim();
    cache.set(key, body);
    return body;
  } catch {
    return undefined;
  }
}
