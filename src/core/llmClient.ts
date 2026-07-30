// Ollama / LM Studio 통합 클라이언트 (둘 다 OpenAI 호환)
import OpenAI from 'openai';
import type { ProviderConfig } from './types.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 일부 로컬 모델(gemma3n 등 SentencePiece 계열)이 공백 대신 메타문자 U+2581(▁)을 그대로 흘린다.
 * 코드/문서 들여쓰기가 '▁▁' 로 오염돼 빌드·표시가 깨지므로 정규 공백으로 복원한다.
 * (이 에이전트 맥락에서 ▁ 가 의도된 문자인 경우는 없다.)
 */
function normalizeModelText(s: string): string {
  return s.replace(/▁/g, ' ');
}

/**
 * reasoning 모델(qwen3 등)이 답변 앞에 붙이는 <think>…</think> 사고블록을 제거한다.
 * 현행 앱 경로(OpenAI 호환 /v1)에서는 thinking 이 꺼져 나오지만, 네이티브 /api 전환이나
 * 모델 교체 시 새어나올 수 있어 방어적으로 벗겨낸다. 여는 태그 없이 닫는 태그만 온 경우
 * (사고가 먼저 스트리밍되고 </think> 로 끝나는 템플릿)도 그 앞부분을 통째로 버린다.
 */
function stripThink(s: string): string {
  let t = s.replace(/<think>[\s\S]*?<\/think>/gi, '');
  const close = t.search(/<\/think>/i);
  if (close !== -1) t = t.slice(close + '</think>'.length);
  return t.trimStart();
}

/** s 의 접미사 중 tag 의 접두사가 되는 최장 길이(태그가 청크 경계에서 쪼개진 경우 대비). */
function partialSuffix(s: string, tag: string): number {
  const max = Math.min(s.length, tag.length - 1);
  for (let k = max; k > 0; k--) if (tag.startsWith(s.slice(s.length - k))) return k;
  return 0;
}

/**
 * 스트리밍용 증분 <think> 제거기 — 델타를 밀어넣으면 "화면에 보일 텍스트"만 돌려준다.
 * 태그가 청크 경계에 걸쳐 쪼개져도(<thi|nk>) 안전하도록 부분 태그를 hold 로 보류한다.
 */
class ThinkFilter {
  private static OPEN = '<think>';
  private static CLOSE = '</think>';
  private mode: 'out' | 'in' = 'out';
  private hold = '';

  push(delta: string): string {
    let data = this.hold + delta;
    this.hold = '';
    let out = '';
    while (data) {
      if (this.mode === 'out') {
        const i = data.indexOf(ThinkFilter.OPEN);
        if (i !== -1) {
          out += data.slice(0, i);
          data = data.slice(i + ThinkFilter.OPEN.length);
          this.mode = 'in';
          continue;
        }
        const p = partialSuffix(data, ThinkFilter.OPEN); // 부분 여는태그 가능성 → 보류
        out += data.slice(0, data.length - p);
        this.hold = data.slice(data.length - p);
        data = '';
      } else {
        const i = data.indexOf(ThinkFilter.CLOSE);
        if (i !== -1) {
          data = data.slice(i + ThinkFilter.CLOSE.length); // </think> 앞은 사고 내용 → 버림
          this.mode = 'out';
          continue;
        }
        this.hold = data.slice(data.length - partialSuffix(data, ThinkFilter.CLOSE));
        data = '';
      }
    }
    return out;
  }

  /** 스트림 종료 시 남은 보류분 — out 모드면 태그가 아니었으니 내보내고, in 모드면 버린다. */
  flush(): string {
    const rest = this.mode === 'out' ? this.hold : '';
    this.hold = '';
    return rest;
  }
}

// 일시적 오류 → 잠깐 뒤 재시도하면 대개 회복된다. (연결/로딩/5xx 계열만)
// 주의: JSON 형식 불량(빈 응답·파싱 실패)은 여기 넣지 않는다. 모델이 일관되게 산문을 뱉는 경우
//       연결 재시도(최대 3회 × 150s)를 통째로 소진해 수 분간 블로킹되기 때문. 형식 불량은
//       chatJson 안에서 별도로 딱 1회만 재시도한다(FormatError 경로).
const TRANSIENT =
  /unloaded|loading|no models loaded|ECONNRESET|ECONNREFUSED|fetch failed|timeout|timed out|connection error|aborted|premature close|ERR_STREAM|socket hang up|EPIPE|50\d/i;

/** JSON 형식 불량(빈 응답·파싱 실패) — 연결 오류와 구분해 chatJson 이 제한적으로만 재시도한다. */
class FormatError extends Error {}

/**
 * json_schema 호출 기본 출력 상한(토큰). 정상 출력은 슬롯/분류 모두 ≤~30토큰이지만,
 * Ollama 제약 디코딩은 상한이 너무 낮으면 빈 응답(finish=length)을 내는 특성이 있어
 * 512 로 여유를 둔다(정상은 즉시 stop, 런어웨이는 512 에서 잘려 재시도로 회복).
 * 300s 급 런어웨이 정지는 클라이언트 timeout(150s)이 최종 차단한다.
 * 계획(수백)·코드생성(수천)은 호출 측에서 더 큰 값을 넘긴다.
 */
const JSON_MAX_TOKENS = 512;

/**
 * 자유생성(chatText/Full/Stream) 요청 타임아웃. 장문 한국어 생성은 클라이언트 기본(150s, JSON
 * 제약 디코딩 런어웨이 가드용)을 넘길 수 있다(특히 8B 모델). 넉넉히 잡아 정상 생성이 오탐 타임아웃되지
 * 않게 하고, 초과 시엔 재시도하지 않는다(느린 생성은 재시도해도 다시 느려 지연만 배가 — 연결/로딩
 * 오류만 retry 가 담당). JSON 경로는 기존 150s + 재시도(런어웨이는 간헐적이라 재시도로 회복)를 유지.
 */
const FREE_GEN_TIMEOUT_MS = 300_000;

export class LLMClient {
  private client: OpenAI;
  constructor(private cfg: ProviderConfig) {
    // 로컬 서버는 apiKey 를 요구하지 않지만 SDK 가 필수로 요구하므로 더미 주입.
    // fetch: 번들 node-fetch 는 keep-alive 재사용 시 로컬 서버(Ollama)에서 "Premature close"
    // 가 잦다 → Node 네이티브 fetch(undici)로 교체하면 안정적.
    this.client = new OpenAI({
      baseURL: cfg.baseURL,
      apiKey: 'not-needed',
      maxRetries: 0,
      // 제약 디코딩 런어웨이/연결 정체가 최대 요청시간까지(약 300s) 물고 있는 걸 방지.
      // 정상 생성은 이 안에 끝나고, 초과하면 타임아웃 → 아래 retry 가 재시도한다.
      timeout: 150_000,
      fetch: globalThis.fetch as unknown as typeof fetch,
    });
  }

  /**
   * 일시적 오류(모델 로딩/언로드 등)면 백오프 재시도. retryOnTimeout=false 면 타임아웃 계열은 재시도하지
   * 않는다 — 자유생성처럼 "느려서 시간이 걸리는" 경우 재시도는 지연만 배가시키므로(연결/로딩만 재시도).
   */
  private async retry<T>(fn: () => Promise<T>, opts: { retryOnTimeout?: boolean } = {}): Promise<T> {
    const retryOnTimeout = opts.retryOnTimeout !== false;
    let last: unknown;
    for (let i = 0; i < 3; i++) {
      try {
        return await fn();
      } catch (e) {
        last = e;
        const msg = e instanceof Error ? e.message : String(e);
        const isTimeout = /timeout|timed out/i.test(msg);
        if (i < 2 && TRANSIENT.test(msg) && (retryOnTimeout || !isTimeout)) {
          await sleep(800 * (i + 1)); // 0.8s, 1.6s
          continue;
        }
        break;
      }
    }
    throw last;
  }

  /** 임베딩 (라우터 centroid / 쿼리) */
  async embed(texts: string[]): Promise<number[][]> {
    const r = await this.retry(() =>
      this.client.embeddings.create({
        model: this.cfg.embedModel,
        input: texts,
        // openai-node 는 기본 base64 인코딩을 보내는데 일부 로컬 서버(LM Studio)에서
        // 디코딩이 깨져 0 벡터가 나온다 → float 강제.
        encoding_format: 'float',
      }),
    );
    return r.data.map((d) => d.embedding as number[]);
  }

  /** 코드 생성 전용 모델명 — 설정에 coderModel 이 있으면 그것, 없으면 일반 chatModel. */
  get coderModel(): string {
    return this.cfg.coderModel || this.cfg.chatModel;
  }

  /**
   * 자유생성에서만 qwen3 사고(<think>)를 끄는 요청 옵션. Ollama OpenAI호환(/v1)은 `reasoning_effort:'none'`
   * 으로 사고 토큰 생성을 건너뛴다(실측: 218→34토큰). 프롬프트 소프트스위치 `/no_think` 나 네이티브
   * `think:false` 는 /v1 에서 무시돼 효과 없었다. produce 자유생성(chatText/chatTextStream)에만 쓰고
   * chatJson(계획/분류)·chatTextFull(파일편집)엔 쓰지 않는다 — 분해·분류·편집 품질은 사고가 좌우하기 때문.
   * gemma(m2)는 플래그 off 라 옵션 자체가 안 붙는다.
   */
  private get noThinkOpts(): Record<string, unknown> {
    return this.cfg.noThinkFreeGen ? { reasoning_effort: 'none' } : {};
  }

  /**
   * JSON schema 제약 출력 (슬롯 추출·분류·계획). 제약은 서버(Ollama/LM Studio)가 강제.
   * 저사양 tool-call 대신 이 경로만 사용한다. model 로 이 호출만 다른 모델을 쓸 수 있다.
   *
   * 견고성: (1) max_tokens 로 제약 디코딩 런어웨이의 지연을 가둔다(슬롯/분류 JSON 은 짧다).
   * (2) 파싱까지 retry 안에서 수행 → 런어웨이로 빈/무효 JSON 이 와도 TRANSIENT 로 보고 재시도한다
   *     (런어웨이는 간헐적이라 재시도로 대개 정상 JSON 을 얻는다).
   */
  async chatJson<T>(
    system: string,
    user: string,
    schema: Record<string, unknown>,
    model?: string,
    maxTokens: number = JSON_MAX_TOKENS,
  ): Promise<T> {
    // 형식 불량(빈/무효 JSON)은 간헐적 런어웨이라 재시도로 대개 회복되지만, 무한정은 아니다 → 딱 1회만.
    // 연결/로딩 계열은 아래 retry() 가 각 시도마다 최대 3회 담당한다(형식 재시도와 독립).
    const FORMAT_RETRIES = 1;
    let lastErr: unknown;
    for (let attempt = 0; attempt <= FORMAT_RETRIES; attempt++) {
      try {
        const content = await this.retry(async () => {
          const r = await this.client.chat.completions.create({
            model: model || this.cfg.chatModel,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            response_format: {
              type: 'json_schema',
              json_schema: { name: 'slots', schema, strict: false },
            },
            temperature: 0,
            max_tokens: maxTokens,
          });
          const c = normalizeModelText(stripThink(r.choices[0]?.message?.content ?? '')).trim();
          // 빈 응답은 런어웨이 절단(finish=length). 연결 오류가 아니므로 retry() 는 즉시 통과시키고,
          // FormatError 로 바깥 형식-재시도 루프가 처리한다.
          if (!c) throw new FormatError('empty json response');
          return c;
        });
        try {
          return JSON.parse(content) as T;
        } catch (e) {
          throw new FormatError(e instanceof Error ? e.message : String(e)); // 파싱 실패 → 형식-재시도 대상
        }
      } catch (e) {
        if (e instanceof FormatError && attempt < FORMAT_RETRIES) {
          lastErr = e;
          continue; // 형식 불량 1회만 더 시도
        }
        throw e; // 연결 오류(재시도 소진) 또는 형식 재시도 소진 → 그대로 실패
      }
    }
    throw lastErr; // 도달 불가(루프가 항상 return/throw). 타입 만족용.
  }

  /**
   * 스트리밍 자유 텍스트 생성 — 토큰이 오는 대로 onToken 으로 흘리고, 전체 텍스트를 반환한다.
   * 사고(<think>) 모델(qwen3 등)을 위해 증분 think 제거를 적용해 사고 토큰은 화면에 내보내지 않는다.
   * 안정성: 아직 아무 토큰도 못 뱉은 상태의 실패(모델 로드/일시 오류)는 비스트리밍 chatText 로 폴백한다
   *         (retry 포함). 이미 일부를 스트리밍한 뒤의 실패는 중복 방지를 위해 그대로 throw.
   */
  async chatTextStream(system: string, user: string, onToken: (t: string) => void): Promise<string> {
    let emitted = 0;
    try {
      const stream = await this.client.chat.completions.create(
        {
          model: this.cfg.chatModel,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.2,
          ...(this.cfg.maxOutputTokens ? { max_tokens: this.cfg.maxOutputTokens } : {}),
          ...this.noThinkOpts,
          stream: true,
        },
        { timeout: FREE_GEN_TIMEOUT_MS }, // 장문 스트리밍이 기본 150s 에 오탐 타임아웃되지 않게
      );
      const filter = new ThinkFilter();
      let full = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? '';
        if (!delta) continue;
        const vis = filter.push(delta);
        if (vis) {
          full += vis;
          emitted += vis.length;
          onToken(vis);
        }
      }
      const tail = filter.flush();
      if (tail) {
        full += tail;
        onToken(tail);
      }
      if (!full.trim()) throw new Error('empty stream response');
      return normalizeModelText(full);
    } catch (e) {
      if (emitted > 0) throw e; // 이미 스트리밍됨 → 폴백 시 중복 출력되므로 전달
      return this.chatText(system, user); // 0토큰 실패 → 비스트리밍(폴백, retry 포함)
    }
  }

  /** 자유 텍스트 생성 (마크다운 스킬 실행 / Response 다듬기) */
  async chatText(system: string, user: string): Promise<string> {
    const r = await this.retry(
      () =>
        this.client.chat.completions.create(
          {
            model: this.cfg.chatModel,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            temperature: 0.2,
            ...(this.cfg.maxOutputTokens ? { max_tokens: this.cfg.maxOutputTokens } : {}),
            ...this.noThinkOpts,
          },
          { timeout: FREE_GEN_TIMEOUT_MS },
        ),
      { retryOnTimeout: false }, // 장문 생성이 느린 것은 재시도해도 다시 느림 → 지연 배가 방지
    );
    return normalizeModelText(stripThink(r.choices[0]?.message?.content ?? ''));
  }

  /**
   * chatText + 잘림 여부(finish_reason==='length') 노출.
   * 파일 통째 재작성(editFile)처럼 절단이 곧 원본 파괴로 이어지는 경로에서, 잘린 출력을 저장하지 않도록 사용한다.
   */
  async chatTextFull(system: string, user: string, maxTokens?: number, model?: string): Promise<{ text: string; truncated: boolean }> {
    const r = await this.retry(
      () =>
        this.client.chat.completions.create(
          {
            model: model || this.cfg.chatModel,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            temperature: 0.2,
            ...(maxTokens ? { max_tokens: maxTokens } : {}),
            // no_think 미적용(의도) — chatTextFull 은 파일 통째 편집(prepareEdit)에 쓰여 정확성이 중요하다.
            // produce 속도 이득은 chatText/chatTextStream 에서 나오므로 편집 경로는 사고를 유지한다.
          },
          { timeout: FREE_GEN_TIMEOUT_MS },
        ),
      { retryOnTimeout: false },
    );
    const choice = r.choices[0];
    const text = normalizeModelText(stripThink(choice?.message?.content ?? ''));
    return { text, truncated: choice?.finish_reason === 'length' };
  }

  /** 한자(CJK 한자)·일본어(히라가나/가타카나) 감지. 한국어 답변에 섞이면 안 되는 문자들. */
  private static readonly CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿ｦ-ﾝ]/;

  /**
   * 한국어 답변 전용 chatText — 결과에 한자/일본어가 섞이면 한 번 더 "순한국어로 재작성"을 돌려 제거한다.
   * 코드블록·영문·숫자·마크다운 구조는 보존하도록 지시. (한자/가나가 없으면 추가 호출 없음)
   */
  async chatKorean(system: string, user: string): Promise<string> {
    const text = await this.chatText(system, user);
    if (!LLMClient.CJK.test(text)) return text;
    const sys =
      '다음 텍스트를 뜻은 그대로 두고 한자(漢字)와 일본어(가나)만 자연스러운 한국어로 바꿔 다시 써라.\n' +
      '- 코드블록(```)·인라인코드·영문 기술용어·숫자·기호·마크다운 구조는 절대 바꾸지 않는다.\n' +
      '- 설명·머리말 없이 고친 텍스트만 출력한다.';
    return this.chatText(sys, text);
  }
}
