// Intent Router — 임베딩 분류 + threshold/ambiguous fallback.
// 점수 = max(centroid 유사도, 개별 예제 최대 유사도).
//   centroid: 다양한 예제의 평균 → 노이즈에 강하지만 예제가 다양하면 희석됨.
//   max-example: 특정 예제와 유사한 발화를 확실히 잡음(희석 보완).
//   둘의 max 를 써서 "예제엔 있는데 centroid 가 희석돼 놓치는" 경계 케이스를 구제.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Intent, Settings } from './types.js';
import type { LLMClient } from './llmClient.js';

/**
 * 라우팅용 쿼리 정제 — 발화에 코드가 섞이면 임베딩이 코드 토큰 쪽으로 끌려가
 * 자연어 의도(예: "코드 리뷰해줘")의 유사도가 threshold 아래로 떨어진다.
 * 임베딩에 넣기 전에만 코드를 걷어내 의도 문장이 지배하게 한다(원문은 스킬에 그대로 전달).
 */
export function stripCodeForRouting(text: string): string {
  let t = text.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]+`/g, ' ');
  // 콜론/문장 뒤에 몰린 코드 꼬리 제거: 첫 코드 신호부터 끝까지 잘라낸다(앞 자연어는 보존).
  const sig = t.search(/[{};]|=>|\b(function|def|class|import|const|let|var|public|private|select|insert|update|delete)\b/i);
  if (sig !== -1) {
    const head = t.slice(0, sig);
    if (head.replace(/\s/g, '').length >= 4) t = head; // 앞에 자연어가 충분할 때만
  }
  return t.trim() || text.trim();
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

export type RouteResult =
  | { kind: 'direct'; intent: Intent; sim: number } // 고신뢰 → 즉시 실행
  | { kind: 'classify'; candidates: Intent[]; sim: number } // 애매 → LLM 분류
  | { kind: 'unknown'; sim: number }; // 저신뢰 → fallback

interface Entry {
  intent: Intent;
  centroid: number[];
  examples: number[][];
}

export class Router {
  /** intent별 centroid + 개별 예제 벡터 (examples 없는 intent 는 제외) */
  private entries: Entry[] = [];

  constructor(
    private llm: LLMClient,
    private intents: Intent[],
    private cfg: Settings['router'],
    private embedModel = 'unknown',
    private cachePath?: string,
  ) {}

  /**
   * 앱 시작 시 1회: 예시 발화 임베딩. (embedModel + examples) 해시가 캐시와 같으면 스킵.
   */
  async init(): Promise<void> {
    const withExamples = this.intents.filter((i) => i.examples.length > 0);
    const sig = this.signature(withExamples);

    if (this.loadCache(sig, withExamples)) return; // 캐시 히트 → 임베딩 스킵

    this.entries = [];
    for (const intent of withExamples) {
      // description 도 함께 임베딩 → 넓은 의미 커버로 recall 향상(후보 진입)
      const texts = intent.description ? [intent.description, ...intent.examples] : intent.examples;
      const vecs = await this.llm.embed(texts);
      this.entries.push({ intent, centroid: centroid(vecs), examples: vecs });
    }
    this.saveCache(sig);
  }

  /** 한 intent 에 대한 점수 = max(centroid, 개별 예제들) */
  private score(q: number[], e: Entry): number {
    let s = cosine(q, e.centroid);
    for (const ex of e.examples) {
      const c = cosine(q, ex);
      if (c > s) s = c;
    }
    return s;
  }

  async route(text: string): Promise<RouteResult> {
    const [q] = await this.llm.embed([stripCodeForRouting(text)]);
    const scored = this.entries
      .map((e) => ({ intent: e.intent, sim: this.score(q, e) }))
      .sort((a, b) => b.sim - a.sim);
    const top = scored[0];

    if (!top || top.sim < this.cfg.unknownThreshold) {
      return { kind: 'unknown', sim: top?.sim ?? 0 };
    }
    if (top.sim >= this.cfg.directThreshold) {
      return { kind: 'direct', intent: top.intent, sim: top.sim };
    }
    // 중간 밴드 → LLM 이 top-K 후보 중 분류
    return { kind: 'classify', sim: top.sim, candidates: scored.slice(0, this.cfg.candidateK).map((s) => s.intent) };
  }

  private signature(withExamples: Intent[]): string {
    const payload =
      this.embedModel + '|' + JSON.stringify(withExamples.map((i) => [i.name, i.description ?? '', i.examples]));
    return createHash('sha256').update(payload).digest('hex');
  }

  private loadCache(sig: string, withExamples: Intent[]): boolean {
    if (!this.cachePath || !existsSync(this.cachePath)) return false;
    try {
      const cached = JSON.parse(readFileSync(this.cachePath, 'utf8')) as {
        signature: string;
        entries: Array<{ name: string; examples: number[][] }>;
      };
      if (cached.signature !== sig || !cached.entries) return false;
      const byName = new Map(withExamples.map((i) => [i.name, i]));
      const loaded = cached.entries
        .filter((c) => byName.has(c.name))
        .map((c) => ({ intent: byName.get(c.name)!, centroid: centroid(c.examples), examples: c.examples }));
      if (loaded.length !== withExamples.length) return false;
      this.entries = loaded;
      return true;
    } catch {
      return false;
    }
  }

  private saveCache(sig: string): void {
    if (!this.cachePath) return;
    try {
      mkdirSync(dirname(this.cachePath), { recursive: true });
      writeFileSync(
        this.cachePath,
        JSON.stringify({
          signature: sig,
          embedModel: this.embedModel,
          entries: this.entries.map((e) => ({ name: e.intent.name, examples: e.examples })),
        }),
      );
    } catch {
      /* best-effort: 캐시 실패해도 동작엔 지장 없음 */
    }
  }
}

function centroid(vecs: number[][]): number[] {
  const dim = vecs[0].length;
  const out = new Array<number>(dim).fill(0);
  for (const v of vecs) for (let i = 0; i < dim; i++) out[i] += v[i];
  for (let i = 0; i < dim; i++) out[i] /= vecs.length;
  return out;
}
