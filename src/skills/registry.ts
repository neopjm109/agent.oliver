// 스킬 레지스트리 — 이름으로 Skill 인스턴스 해결.
// 코드 스킬(status/chitchat/fallback) 우선, 나머지는 skills/**/SKILL.md → MarkdownSkill.
import { existsSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import type { Skill } from '../core/types.js';
import type { LLMClient } from '../core/llmClient.js';
import { MarkdownSkill } from './markdownSkill.js';

export class SkillRegistry {
  private code = new Map<string, Skill>();
  private mdIndex = new Map<string, string>(); // skill 이름 → SKILL.md 경로
  private mdCache = new Map<string, Skill>();

  constructor(
    private llm: LLMClient,
    skillsRoot: string,
    codeSkills: Skill[],
  ) {
    // 코드 스킬 등록 (파이프라인이 주입)
    for (const s of codeSkills) this.code.set(s.name, s);
    // 마크다운 스킬 인덱싱 (<root>/<cat>/<skill>/SKILL.md)
    this.indexMarkdown(resolve(process.cwd(), skillsRoot));
  }

  /** 임의 깊이(n중첩) 재귀 스캔. SKILL.md 가 있는 폴더를 그 폴더명으로 등록. */
  private indexMarkdown(root: string): void {
    if (!existsSync(root)) return;
    this.walk(root, true);
  }

  private walk(dir: string, isRoot: boolean): void {
    const entries = readdirSync(dir, { withFileTypes: true });
    // 루트 자체는 스킬 폴더로 보지 않음 (루트에 SKILL.md 가 있어도 무시)
    if (!isRoot && entries.some((e) => e.isFile() && e.name === 'SKILL.md')) {
      this.mdIndex.set(basename(dir), resolve(dir, 'SKILL.md'));
    }
    for (const e of entries) {
      if (e.isDirectory()) this.walk(resolve(dir, e.name), false);
    }
  }

  /** 이름으로 Skill 반환. 미존재 시 안내용 stub. */
  get(name: string): Skill {
    const code = this.code.get(name);
    if (code) return code;

    const cached = this.mdCache.get(name);
    if (cached) return cached;

    const path = this.mdIndex.get(name);
    if (path) {
      const s = new MarkdownSkill(name, path, this.llm);
      this.mdCache.set(name, s);
      return s;
    }
    return missingSkill(name);
  }

  has(name: string): boolean {
    return this.code.has(name) || this.mdIndex.has(name);
  }

  get markdownCount(): number {
    return this.mdIndex.size;
  }

  get codeCount(): number {
    return this.code.size;
  }
}

function missingSkill(name: string): Skill {
  return {
    name,
    async run() {
      return { ok: false, text: `[미구현 스킬: ${name}] 레지스트리에 없음` };
    },
  };
}
