import type { Tool } from "./types.js";

/** 검색 결과 한 건 */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/** 숫자 엔티티 코드포인트를 안전하게 문자로 (잘못된 값이면 빈 문자열) */
function safeCodePoint(n: number): string {
  try {
    return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  } catch {
    return "";
  }
}

/** HTML 엔티티/태그를 제거해 대략적인 평문으로 만든다 */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCodePoint(parseInt(d, 10)))
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/** DuckDuckGo HTML 응답에서 결과 목록을 파싱한다 (키 불필요, 스크래핑) */
export function parseDuckDuckGo(html: string, limit: number): SearchResult[] {
  const results: SearchResult[] = [];
  // 결과 링크: <a ... class="result__a" href="...">제목</a>
  const linkRe = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snipRe = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippets: string[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = snipRe.exec(html))) snippets.push(stripHtml(sm[1]));

  let lm: RegExpExecArray | null;
  let i = 0;
  while ((lm = linkRe.exec(html)) && results.length < limit) {
    let url = lm[1];
    // DDG 리다이렉트(//duckduckgo.com/l/?uddg=<encoded>) 를 실제 URL 로 복원
    const uddg = url.match(/[?&]uddg=([^&]+)/);
    if (uddg) url = decodeURIComponent(uddg[1]);
    else if (url.startsWith("//")) url = "https:" + url;
    const title = stripHtml(lm[2]);
    if (title && /^https?:\/\//.test(url)) {
      results.push({ title, url, snippet: snippets[i] ?? "" });
    }
    i++;
  }
  return results;
}

/** SSRF 방지: 내부/사설 대상이거나 http(s) 가 아니면 차단 */
export function isBlockedUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return true; // 파싱 불가 → 차단
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return true;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h === "0.0.0.0" || h === "::1" || h === "[::1]")
    return true;
  // 사설/링크로컬 IPv4 대역
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  return false;
}

async function tavilySearch(query: string, count: number, apiKey: string): Promise<SearchResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, query, max_results: count }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const data: any = await res.json();
  return (data.results ?? []).slice(0, count).map((r: any) => ({
    title: String(r.title ?? ""),
    url: String(r.url ?? ""),
    snippet: String(r.content ?? ""),
  }));
}

async function duckDuckGoSearch(query: string, count: number): Promise<SearchResult[]> {
  const res = await fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query), {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SkillfulAgent/0.1)" },
  });
  if (!res.ok) throw new Error(`DuckDuckGo ${res.status}`);
  return parseDuckDuckGo(await res.text(), count);
}

export const webSearchTool: Tool = {
  name: "web_search",
  description:
    "웹을 검색해 관련 결과(제목·URL·요약)를 반환한다. 최신 정보나 사실 확인이 필요할 때 사용. 내용 전문이 필요하면 web_fetch 로 URL 을 가져올 것.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "검색어" },
      count: { type: "number", description: "결과 개수 (기본 5, 최대 10)" },
    },
    required: ["query"],
  },
  async run(args, ctx) {
    const query = String(args.query ?? "").trim();
    if (!query) return "query 가 비어 있습니다.";
    const count = Math.min(10, Math.max(1, Number(args.count ?? 5)));
    const tavilyKey = process.env.TAVILY_API_KEY?.trim();
    try {
      const results = tavilyKey
        ? await tavilySearch(query, count, tavilyKey)
        : await duckDuckGoSearch(query, count);
      if (!results.length) return `'${query}' 검색 결과가 없습니다.`;
      ctx.log(`  ↳ web_search: ${results.length}건 (${tavilyKey ? "tavily" : "duckduckgo"})`);
      return results
        .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
        .join("\n\n");
    } catch (err: any) {
      return `웹 검색 실패: ${err.message}`;
    }
  },
};

export const webFetchTool: Tool = {
  name: "web_fetch",
  description:
    "주어진 http(s) URL 의 내용을 가져와 평문 텍스트로 반환한다. 검색 결과의 본문을 읽을 때 사용.",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "가져올 http(s) URL" },
      max_chars: { type: "number", description: "반환 최대 문자 수 (기본 6000)" },
    },
    required: ["url"],
  },
  async run(args) {
    const url = String(args.url ?? "").trim();
    if (isBlockedUrl(url)) return `차단된 URL 입니다(내부/사설 주소 또는 잘못된 형식): ${url}`;
    const max = Math.min(20000, Math.max(500, Number(args.max_chars ?? 6000)));
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SkillfulAgent/0.1)" },
        redirect: "follow",
      });
      if (!res.ok) return `요청 실패: HTTP ${res.status}`;
      const ct = res.headers.get("content-type") ?? "";
      const body = await res.text();
      const text = ct.includes("html") ? stripHtml(body) : body;
      return text.length > max ? text.slice(0, max) + `\n... (${text.length - max}자 생략)` : text;
    } catch (err: any) {
      return `가져오기 실패: ${err.message}`;
    }
  },
};

export const webTools: Tool[] = [webSearchTool, webFetchTool];
