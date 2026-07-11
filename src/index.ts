#!/usr/bin/env -S npx tsx
import { config } from "./config.js";
import { LLM } from "./llm.js";
import { SkillRegistry } from "./skills.js";
import { selectTools } from "./tools/index.js";
import { Agent } from "./agent.js";
import { PermissionGate, makeReadline } from "./permissions.js";
import { SessionStore } from "./session.js";
import { loadSoul, listSouls, extractPersonaFlag } from "./soul.js";

async function main() {
  const skills = SkillRegistry.load(config.skillsDir, {
    hideOrchestrators: config.skillMode === "single",
  });
  const llm = new LLM(config);
  const rl = makeReadline(skills.names());
  const gate = new PermissionGate(rl, config.autoApprove);
  const store = new SessionStore(config.sessionsDir);
  const tools = selectTools(config.disabledTools);

  // 세션 ID: --session <id> 인자 또는 SESSION 환경변수, 기본 "cli"
  const argv = process.argv.slice(2);
  const sIdx = argv.indexOf("--session");
  const sessionId = sIdx !== -1 ? argv.splice(sIdx, 2)[1] : process.env.SESSION ?? "cli";
  const history = store.load(sessionId);

  // 페르소나(SOUL): --oliver, --claire 등 → souls/<name>.md 를 정체성으로 주입.
  // 플래그가 없으면 일반 모드(soul=null).
  const { persona, rest } = extractPersonaFlag(argv);
  let soul: string | null = null;
  if (persona) {
    soul = loadSoul(config.soulsDir, persona);
    if (!soul) {
      const avail = listSouls(config.soulsDir);
      console.error(`❌ 페르소나 '${persona}' 를 찾을 수 없습니다 (souls/${persona}.md 없음).`);
      console.error(
        avail.length
          ? `   사용 가능한 페르소나: ${avail.map((n) => "--" + n).join(", ")}`
          : "   souls/ 에 등록된 페르소나가 없습니다.",
      );
      rl.close();
      process.exit(1);
    }
  }

  const makeAgent = () =>
    new Agent({
      llm,
      tools,
      skills,
      config,
      soul,
      history: store.load(sessionId),
      summary: store.loadSummary(sessionId),
      requestPermission: (a, d) => gate.request(a, d),
      log: (m) => console.log(m),
    });

  console.log("┌─────────────────────────────────────────┐");
  console.log("│  Skillful Agent — 스킬 기반 AI 에이전트   │");
  console.log("└─────────────────────────────────────────┘");
  console.log(`모델    : ${config.model}`);
  console.log(`엔드포인트: ${config.baseURL}`);
  const cats = skills.categories();
  console.log(
    `스킬    : ${skills.size()}개` +
      (cats.length ? ` / ${cats.length}개 카테고리 (${cats.map((c) => c.name).join(", ")})` : " (없음)"),
  );
  console.log(`스킬모드 : ${config.skillMode}${config.skillMode === "single" ? " (오케스트레이터 숨김, 리프 직접)" : ""}`);
  console.log(`페르소나 : ${persona ?? "(일반 모드)"}`);
  console.log(`세션    : ${sessionId}${history.length ? ` (이전 ${history.length}개 메시지 복원)` : ""}`);
  console.log("스킬 직접 호출: '/스킬명 [요청]' (프롬프트에서 '/' 입력 후 Tab 으로 자동완성).");
  console.log("종료하려면 'exit' 또는 Ctrl+C.\n");

  const runTurn = async (agent: Agent, input: string, skill?: ReturnType<typeof skills.get>) => {
    process.stdout.write("🤖 ");
    const reply = await agent.run(input, (delta) => process.stdout.write(delta), skill);
    // 도구만 돌고 스트리밍 텍스트가 없던 경우 대비해 최종 텍스트 보정 출력은 생략(이미 스트리밍됨)
    process.stdout.write("\n");
    const used = agent.getUsedSkills();
    if (used.length) console.log(`🧩 사용한 스킬: ${used.join(", ")}`);
    store.save(sessionId, agent.exportHistory());
    store.saveSummary(sessionId, agent.getSummary());
    return reply;
  };

  // '/스킬명 [요청]' 슬래시 명령을 파싱한다. 스킬을 못 찾으면 안내 후 null 을 반환한다.
  // (자동완성 completer 는 permissions.ts 에서 skills.names() 로 구성된다.)
  const resolveSlash = (input: string): { skill: NonNullable<ReturnType<typeof skills.get>>; text: string } | null => {
    const m = input.match(/^\/(\S+)\s*([\s\S]*)$/);
    if (!m) return null;
    const skill = skills.get(m[1]);
    if (!skill) {
      console.log(`알 수 없는 스킬: /${m[1]}  (프롬프트에서 '/' 입력 후 Tab 으로 목록 확인)\n`);
      return null;
    }
    return { skill, text: m[2].trim() };
  };

  // 인자로 한 줄 넘기면 단발 실행 후 종료 (스크립트 모드) — 페르소나 플래그는 제외한 나머지
  const oneShot = rest.join(" ").trim();
  if (oneShot) {
    const slash = oneShot.startsWith("/") ? resolveSlash(oneShot) : null;
    if (oneShot.startsWith("/") && !slash) {
      rl.close();
      process.exit(1);
    }
    await runTurn(makeAgent(), slash ? slash.text : oneShot, slash?.skill);
    rl.close();
    return;
  }

  // 대화형 REPL — 하나의 Agent 인스턴스로 멀티턴 유지
  const agent = makeAgent();
  while (true) {
    let input: string;
    try {
      input = (await rl.question("👤 ")).trim();
    } catch (err) {
      if (isAbort(err)) break; // Ctrl+C → 조용히 종료
      throw err;
    }
    if (!input) continue;
    if (input === "exit" || input === "quit") break;
    try {
      if (input.startsWith("/")) {
        const slash = resolveSlash(input);
        if (!slash) continue; // 안내는 resolveSlash 가 이미 출력
        await runTurn(agent, slash.text, slash.skill);
      } else {
        await runTurn(agent, input);
      }
      console.log("");
    } catch (err: any) {
      if (isAbort(err)) break; // 처리 중 Ctrl+C → 조용히 종료
      console.error(`\n❌ 오류: ${err.message}\n`);
    }
  }
  rl.close();
  console.log("\n안녕히 가세요 👋");
}

/** Ctrl+C(SIGINT) 로 인한 abort 인지 판별 */
function isAbort(err: unknown): boolean {
  const e = err as { name?: string; code?: string } | null;
  return e?.name === "AbortError" || e?.code === "ABORT_ERR";
}

main().catch((err) => {
  if (isAbort(err)) process.exit(0); // Ctrl+C 는 조용히 정상 종료
  console.error(err);
  process.exit(1);
});
