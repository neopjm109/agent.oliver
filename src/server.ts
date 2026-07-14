#!/usr/bin/env -S npx tsx
import { createServer, type IncomingMessage } from "node:http";
import { mkdirSync } from "node:fs";
import { config } from "./config.js";
import { LLM } from "./llm.js";
import { SkillRegistry } from "./skills.js";
import { selectTools } from "./tools/index.js";
import { Agent } from "./agent.js";
import { SessionStore, sessionWorkspace } from "./session.js";
import { loadSoul, listSouls } from "./soul.js";
import { interpret, type CommandCtx } from "./commands.js";

/**
 * 에이전트 HTTP 서버.
 *   POST /chat        { "session": "abc", "message": "..." }  →  { "reply": "..." }
 *   POST /chat/stream { "session": "abc", "message": "..." }  →  NDJSON: {type:step|done|error}
 *   POST /reset  { "session": "abc" }                    →  { "ok": true }
 *   GET  /souls                                          →  { "souls": [...] }
 *   POST /soul   { "session": "abc", "name": "oliver" }  →  { "ok": true, "persona": "oliver" }
 *   GET  /health →  { "ok": true }
 *
 * 텔레그램 봇 등 외부 클라이언트가 이 엔드포인트로 대화한다.
 * 대화는 session 별로 .sessions/ 에 영속화되어 멀티턴이 유지된다.
 * 대화형 터미널이 없으므로 위험 도구(write/shell)는 AUTO_APPROVE 설정을 따른다.
 */

// 작업 산출물 디렉터리(샌드박스 루트)를 없으면 생성
mkdirSync(config.cwd, { recursive: true });
const skills = SkillRegistry.load(config.skillsDir, {
  hideOrchestrators: config.skillMode === "single",
});
const llm = new LLM(config);
const store = new SessionStore(config.sessionsDir);
const tools = selectTools(config.disabledTools);

// 세션별 직렬 처리용 큐 (같은 세션의 동시 요청이 히스토리를 훼손하지 않도록)
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(
    key,
    next.finally(() => {
      if (locks.get(key) === next) locks.delete(key);
    }),
  );
  return next;
}

/**
 * 세션에 대해 메시지를 한 번 처리한다.
 * 먼저 공용 슬래시 명령(/help·/skills·/soul·/reset·/<스킬>)을 해석하고 —
 *   · 텍스트 응답 명령이면 에이전트 없이 그 텍스트를 반환하고,
 *   · '/<스킬>' 이면 해당 스킬을 실어 에이전트를 실행한다.
 * onStep 이 주어지면 도구 호출·계획 등 진행 로그를 실시간으로 흘려보낸다.
 * (CLI 와 동일한 commands.interpret 를 써서 명령 체계를 통일한다.)
 */
async function processMessage(
  session: string,
  message: string,
  onStep?: (text: string) => void,
): Promise<{ reply: string; skills: string[] }> {
  return withLock(session, async () => {
    const cmdCtx: CommandCtx = {
      skills,
      store,
      session,
      soulsDir: config.soulsDir,
      workspaceRoot: config.workspacePerSession ? sessionWorkspace(config.cwd, session) : config.cwd,
    };
    const r = interpret(message, cmdCtx);
    // 텍스트 응답 명령(/help·/skills·/soul·/reset) — 에이전트 미실행 (부수효과는 interpret 가 적용)
    if (r.type === "reply" || r.type === "error") {
      return { reply: r.text, skills: [] };
    }

    // 세션에 설정된 페르소나(SOUL)를 정체성으로 주입 (없으면 일반 모드)
    const persona = store.loadPersona(session);
    const soul = persona ? loadSoul(config.soulsDir, persona) : null;
    // 세션별 작업 폴더로 산출물 분리 (workspacePerSession=true 면 cwd/<세션ID>)
    const cwd = config.workspacePerSession ? sessionWorkspace(config.cwd, session) : config.cwd;
    mkdirSync(cwd, { recursive: true });
    const agent = new Agent({
      llm,
      tools,
      skills,
      config: { ...config, cwd },
      soul,
      history: store.load(session),
      summary: store.loadSummary(session),
      requestPermission: async () => config.autoApprove, // 터미널 없음 → 설정에 위임
      log: (m) => {
        console.log(`[${session}]${m}`);
        onStep?.(m);
      },
    });
    // '/<스킬>' 이면 스킬을 실어서, 아니면 일반 메시지로 실행
    const reply = await agent.run(r.text, undefined, r.type === "skill" ? r.skill : undefined);
    store.save(session, agent.exportHistory());
    store.saveSummary(session, agent.getSummary());
    return { reply, skills: agent.getUsedSkills() };
  });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 1_000_000) reject(new Error("요청 본문이 너무 큽니다."));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const json = (code: number, obj: unknown) => {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(obj));
  };

  try {
    if (req.method === "GET" && req.url === "/health") {
      return json(200, { ok: true, model: config.model, skills: skills.size() });
    }

    if (req.method === "POST" && req.url === "/chat") {
      // 선택적 토큰 인증
      if (config.serverToken && req.headers["x-api-key"] !== config.serverToken) {
        return json(401, { error: "unauthorized" });
      }
      const body = JSON.parse((await readBody(req)) || "{}");
      const session = String(body.session ?? "").trim();
      const message = String(body.message ?? "").trim();
      if (!session || !message) {
        return json(400, { error: "session 과 message 가 필요합니다." });
      }
      const { reply, skills: used } = await processMessage(session, message);
      return json(200, { reply, skills: used });
    }

    if (req.method === "POST" && req.url === "/chat/stream") {
      if (config.serverToken && req.headers["x-api-key"] !== config.serverToken) {
        return json(401, { error: "unauthorized" });
      }
      const body = JSON.parse((await readBody(req)) || "{}");
      const session = String(body.session ?? "").trim();
      const message = String(body.message ?? "").trim();
      if (!session || !message) {
        return json(400, { error: "session 과 message 가 필요합니다." });
      }
      // NDJSON 스트림: 진행 이벤트를 한 줄씩 흘려보내고 마지막에 done 을 보낸다.
      res.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8" });
      const emit = (obj: unknown) => res.write(JSON.stringify(obj) + "\n");
      try {
        const { reply, skills: used } = await processMessage(session, message, (text) =>
          emit({ type: "step", text }),
        );
        emit({ type: "done", reply, skills: used });
      } catch (err: any) {
        emit({ type: "error", error: err.message });
      }
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/souls") {
      return json(200, { souls: listSouls(config.soulsDir) });
    }

    if (req.method === "POST" && req.url === "/soul") {
      if (config.serverToken && req.headers["x-api-key"] !== config.serverToken) {
        return json(401, { error: "unauthorized" });
      }
      const body = JSON.parse((await readBody(req)) || "{}");
      const session = String(body.session ?? "").trim();
      const name = String(body.name ?? "").trim();
      if (!session) return json(400, { error: "session 이 필요합니다." });

      // name 이 비면 페르소나 해제(일반 모드)
      if (!name) {
        await withLock(session, async () => store.savePersona(session, null));
        return json(200, { ok: true, persona: null });
      }
      // 존재하는 페르소나인지 검증
      if (!loadSoul(config.soulsDir, name)) {
        return json(404, { error: `페르소나 '${name}' 없음`, souls: listSouls(config.soulsDir) });
      }
      await withLock(session, async () => store.savePersona(session, name));
      return json(200, { ok: true, persona: name });
    }

    if (req.method === "POST" && req.url === "/reset") {
      if (config.serverToken && req.headers["x-api-key"] !== config.serverToken) {
        return json(401, { error: "unauthorized" });
      }
      const body = JSON.parse((await readBody(req)) || "{}");
      const session = String(body.session ?? "").trim();
      if (!session) return json(400, { error: "session 이 필요합니다." });
      await withLock(session, async () => store.clear(session));
      return json(200, { ok: true });
    }

    json(404, { error: "not found" });
  } catch (err: any) {
    json(500, { error: err.message });
  }
});

server.listen(config.port, () => {
  console.log(`Skillful Agent 서버 기동: http://localhost:${config.port}`);
  console.log(`모델 ${config.model} / 스킬 ${skills.size()}개 / 모드 ${config.skillMode}`);
  console.log(`작업폴더 ${config.cwd} (파일/셸 작업은 이 안에서만)`);
  console.log(`도구: ${tools.map((t) => t.name).join(", ")}`);
  console.log(`위험 도구 자동승인(AUTO_APPROVE): ${config.autoApprove}`);
  if (config.serverToken) console.log("토큰 인증 활성화 (헤더 x-api-key)");

  // 위험 조합 경고: 인증 없는 서버 + 자동승인 + 셸/쓰기 도구 활성 = 원격 코드 실행 위험
  const dangerousOn = tools.some((t) => t.dangerous);
  if (config.autoApprove && dangerousOn && !config.serverToken) {
    console.log(
      "\n⚠️  보안 경고: AUTO_APPROVE=true + 위험 도구(run_shell/write_file) 활성 + 토큰 미설정.\n" +
        "    이 서버에 접근 가능한 누구나 파일 쓰기·셸 실행을 시킬 수 있습니다.\n" +
        "    공개/공유 배포라면 다음 중 하나 이상을 적용하세요:\n" +
        "      • DISABLED_TOOLS=run_shell,write_file  (위험 도구 제거)\n" +
        "      • AUTO_APPROVE=false                    (위험 도구 거부)\n" +
        "      • AGENT_SERVER_TOKEN=<토큰>             (요청 인증)\n" +
        "      • 텔레그램 봇은 TELEGRAM_ALLOWED_CHAT_IDS 로 본인만 허용\n",
    );
  }
});
