import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, relative } from "node:path";

export interface Skill {
  /** frontmatter 의 name (고유 식별자) */
  name: string;
  /** 언제 이 스킬을 써야 하는지 — 모델의 스킬 선택 근거가 된다 */
  description: string;
  /** 최상위 폴더명 = 카테고리 (예: skills/web/foo/SKILL.md → "web") */
  category: string;
  /** 이 스킬 실행 중 허용할 도구 이름 목록 (없으면 전체 허용) */
  allowedTools?: string[];
  /** frontmatter invokes: 위임 대상 하위 스킬 이름들 (오케스트레이터) */
  invokes?: string[];
  /** SKILL.md 의 본문 — 스킬이 호출되면 모델에게 지침으로 주입된다 */
  body: string;
  /** SKILL.md 가 위치한 폴더 절대경로 (스킬이 참조하는 부속 파일의 기준) */
  dir: string;
}

/**
 * 아주 단순한 YAML frontmatter 파서.
 * 최상위 키의 스칼라 값, 인라인 배열([a, b]), 여러 줄 리스트(key:\n  - a\n  - b)를 지원한다.
 * (name / description / allowed-tools / invokes 등에 사용)
 */
function parseFrontmatter(raw: string): { meta: Record<string, any>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const [, fm, body] = match;
  const meta: Record<string, any> = {};
  const unquote = (s: string) => s.trim().replace(/^["']|["']$/g, "");
  const lines = fm.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s/.test(line)) continue; // 들여쓴 줄(리스트 항목·하위 필드)은 lookahead 로 처리
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      meta[key] = value.slice(1, -1).split(",").map(unquote).filter(Boolean);
    } else if (value === "") {
      // 다음 줄들이 "  - item" 이면 여러 줄 리스트로 수집
      const items: string[] = [];
      let j = i + 1;
      while (j < lines.length && /^\s*-\s+/.test(lines[j])) {
        items.push(unquote(lines[j].replace(/^\s*-\s+/, "")));
        j++;
      }
      if (items.length) {
        meta[key] = items.filter(Boolean);
        i = j - 1;
      } else {
        meta[key] = "";
      }
    } else {
      meta[key] = unquote(value);
    }
  }
  return { meta, body: body.trim() };
}

/** skillsDir 하위를 재귀적으로 돌며 SKILL.md 파일의 경로를 모두 수집한다 */
function findSkillFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue; // .git, .DS_Store 등 무시
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "SKILL.md") found.push(full);
    }
  };
  walk(root);
  return found;
}

/**
 * 스킬을 모델에게 주입할 지침 텍스트로 렌더링한다.
 * invoke_skill 도구와 CLI 의 '/스킬명' 직접 호출이 동일한 형식을 공유한다.
 */
export function renderSkillInstructions(skill: Skill): string {
  const toolNote = skill.allowedTools
    ? `\n\n[이 스킬에서 사용 권장 도구: ${skill.allowedTools.join(", ")}]`
    : "";
  // 오케스트레이터(invokes 선언)에는 이 프레임워크의 위임 방식을 자동 안내한다.
  // (SKILL.md 를 수정하지 않고 프레임워크가 일괄 적용)
  const delegationNote = skill.invokes?.length
    ? `\n\n[위임 안내 — 프레임워크 규칙] 이 스킬은 다음 하위 스킬에 위임합니다: ${skill.invokes.join(", ")}.\n` +
      `하위 스킬에 위임할 때는 invoke_skill 로 직접 불러오지 말고(문맥이 섞임), spawn_agent 로 서브에이전트를 띄워 ` +
      `그 서브에이전트가 해당 스킬을 invoke_skill 로 불러와 작업을 수행하고 결과만 반환하도록 지시하세요. ` +
      `각 하위 스킬은 독립된 서브에이전트에서 격리 실행됩니다.`
    : "";
  return (
    `스킬 '${skill.name}' 지침을 로드했습니다. 아래 지침을 따르세요.\n` +
    `스킬 폴더: ${skill.dir}\n\n----- SKILL 지침 시작 -----\n${skill.body}\n----- SKILL 지침 끝 -----${toolNote}${delegationNote}`
  );
}

export class SkillRegistry {
  private skills = new Map<string, Skill>();
  /** true 면 오케스트레이터(invokes 선언 스킬)를 발견 대상에서 제외 (소형 모델용 single 모드) */
  private hideOrchestrators = false;

  /** 발견(list_skills·overview·자동완성·suggest) 대상 스킬. single 모드면 리프만. */
  private discoverable(): Skill[] {
    return this.hideOrchestrators
      ? this.all().filter((s) => !s.invokes?.length)
      : this.all();
  }

  /**
   * skillsDir 하위에서 SKILL.md 를 재귀적으로 찾아 모두 로드한다.
   * 카테고리 = skillsDir 기준 상대경로의 첫 번째 세그먼트.
   * hideOrchestrators=true 면 위임 스킬을 발견에서 숨긴다(로드는 하되 노출 안 함).
   */
  static load(skillsDir: string, opts: { hideOrchestrators?: boolean } = {}): SkillRegistry {
    const reg = new SkillRegistry();
    reg.hideOrchestrators = !!opts.hideOrchestrators;
    if (!existsSync(skillsDir)) return reg;

    for (const file of findSkillFiles(skillsDir)) {
      const { meta, body } = parseFrontmatter(readFileSync(file, "utf8"));
      const dir = resolve(file, "..");
      const rel = relative(skillsDir, file).split(/[\\/]/);
      // 최상위 폴더가 카테고리. 바로 skills/ 밑이면 "general".
      const category = rel.length > 2 ? rel[0] : "general";
      const name = meta.name || rel.slice(0, -1).join("-");

      // 이름 충돌 시 카테고리로 구분 (frontmatter name 이 유일하지 않은 경우 대비)
      let key = name;
      if (reg.skills.has(key)) key = `${category}/${name}`;

      reg.skills.set(key, {
        name: key,
        description: meta.description ?? "",
        category,
        allowedTools: meta["allowed-tools"],
        invokes: Array.isArray(meta.invokes) ? meta.invokes : undefined,
        body,
        dir,
      });
    }
    return reg;
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  all(): Skill[] {
    return [...this.skills.values()];
  }

  /** 발견 가능한 스킬 이름 (자동완성용, 사전순 정렬) */
  names(): string[] {
    return this.discoverable()
      .map((s) => s.name)
      .sort((a, b) => a.localeCompare(b));
  }

  /**
   * 주어진 이름과 비슷한 스킬 이름을 추천한다 (오탈자/미존재 이름 복구용).
   * 부분 일치 · 끝단어 일치 · 토큰 겹침을 점수화해 상위 limit 개를 돌려준다.
   */
  suggest(query: string, limit = 8): string[] {
    const q = query.toLowerCase();
    const qSegs = q.split(/[-/]/).filter(Boolean);
    const scored = this.discoverable()
      .map((s) => {
        const n = s.name.toLowerCase();
        const segs = n.split(/[-/]/);
        let score = 0;
        if (n === q) score = 100;
        else if (n.includes(q) || q.includes(n)) score = 60;
        else if (qSegs.some((qs) => segs.includes(qs)))
          score = 40; // 토큰 하나가 통째로 일치 (예: web-serch ↔ web-search)
        else if (qSegs.some((qs) => segs.some((t) => t.includes(qs) || qs.includes(t))))
          score = 20; // 토큰 부분 겹침
        return { name: s.name, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, limit);
    return scored.map((x) => x.name);
  }

  size(): number {
    return this.skills.size;
  }

  /** 카테고리명 → 스킬 수 (발견 가능한 것만) */
  categories(): { name: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const s of this.discoverable()) {
      counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** 특정 카테고리의 발견 가능한 스킬만 반환 */
  inCategory(category: string): Skill[] {
    return this.discoverable().filter((s) => s.category === category);
  }

  /**
   * 시스템 프롬프트용 카테고리 개요 (발견 가능한 스킬 기준).
   * 스킬 수가 적으면(임계값 이하) 전체 목록을, 많으면 카테고리 요약만 보여준다.
   */
  overview(flatThreshold = 30): string {
    const n = this.discoverable().length;
    if (n === 0) return "(등록된 스킬 없음)";
    if (n <= flatThreshold) return this.flatCatalog();
    const cats = this.categories()
      .map((c) => `- ${c.name} (${c.count}개)`)
      .join("\n");
    return (
      `총 ${n}개 스킬이 다음 카테고리에 있습니다:\n${cats}\n` +
      `특정 카테고리의 스킬 목록을 보려면 list_skills(category) 도구를 사용하세요.`
    );
  }

  /** 이름 + 설명 전체 나열 (발견 가능한 것만; 스킬이 적을 때 권장) */
  flatCatalog(): string {
    const list = this.discoverable();
    if (!list.length) return "(등록된 스킬 없음)";
    return list.map((s) => `- ${s.name}: ${s.description}`).join("\n");
  }
}
