#!/usr/bin/env -S npx tsx
import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "./config.js";
import { LLM } from "./llm.js";
import { SkillRegistry } from "./skills.js";
import { selectTools } from "./tools/index.js";
import { Agent } from "./agent.js";
import { PermissionGate, makeReadline, askMultiline } from "./permissions.js";
import { SessionStore, sessionWorkspace } from "./session.js";
import { loadSoul, listSouls, extractPersonaFlag } from "./soul.js";
import { interpret, recentMessagesText, type CommandCtx } from "./commands.js";

// ── 시작 배너용 경량 색상·정렬 유틸 (외부 의존성 없음) ──
// 색은 대화형 TTY 에서만, NO_COLOR 환경변수가 있으면 끈다(비-TTY 파이프·로그 오염 방지).
const COLOR = !process.env.NO_COLOR && process.stdout.isTTY;
const sgr = (code: string) => (s: string) => (COLOR ? `\x1b[${code}m${s}\x1b[0m` : s);
const c = {
  bold: sgr("1"),
  dim: sgr("2"),
  cyan: sgr("36"),
  green: sgr("32"),
  yellow: sgr("33"),
  magenta: sgr("35"),
  gray: sgr("90"),
};

/** 터미널 표시 폭 근사치 — 한글·전각·이모지는 2칸으로 센다(라벨 정렬용). */
function dispWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    const wide =
      (cp >= 0x1100 && cp <= 0x115f) || // 한글 자모
      (cp >= 0x2e80 && cp <= 0xa4cf) || // CJK
      (cp >= 0xac00 && cp <= 0xd7a3) || // 한글 음절
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe4f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      cp >= 0x1f000; // 이모지 대략
    w += wide ? 2 : 1;
  }
  return w;
}

/** 표시 폭 기준으로 오른쪽을 공백 채움(색 코드가 붙기 전 원문 라벨에 쓸 것). */
function padEndDisp(s: string, width: number): string {
  const pad = width - dispWidth(s);
  return pad > 0 ? s + " ".repeat(pad) : s;
}

async function main() {
  // 작업 산출물 디렉터리(샌드박스 루트)를 없으면 생성
  mkdirSync(config.cwd, { recursive: true });
  const skills = SkillRegistry.load(config.skillsDir, {
    hideOrchestrators: config.skillMode === "single",
  });
  const llm = new LLM(config);
  // Tab 자동완성: 공용 명령(/help /skills /soul /reset) + 직접 호출 가능한 스킬.
  // 카테고리 대표 스킬은 항상 포함(single 모드면 names()에서 빠지므로 별도 합집합).
  // 리프 직접 호출이 켜져 있으면(CLI_ALLOW_LEAF_SKILL=true) 전체 리프 스킬도 추가.
  const catNames = skills.categoryEntries().map((s) => s.name);
  const completableSkills = config.cliAllowLeafSkill
    ? Array.from(new Set([...catNames, ...skills.names()]))
    : catNames;
  const rl = makeReadline(["help", "skills", "soul", "sessions", "session", "history", "pwd", "reset", ...completableSkills]);
  const gate = new PermissionGate(rl, config.autoApprove);
  const store = new SessionStore(config.sessionsDir);
  const tools = selectTools(config.disabledTools);

  // 세션 ID 결정: 명시적(--session/SESSION) 우선 → 없으면 마지막 활성 세션 복원 → 기본 "cli"
  const argv = process.argv.slice(2);
  const sIdx = argv.indexOf("--session");
  const explicitSession = sIdx !== -1 ? argv.splice(sIdx, 2)[1] : process.env.SESSION ?? null;
  const rememberedSession = explicitSession ? null : store.loadLast();
  let sessionId = explicitSession ?? rememberedSession ?? "cli";
  store.saveLast(sessionId); // 이번 실행의 활성 세션 기록
  const history = store.load(sessionId);

  // 페르소나(SOUL): --oliver / --persona <이름> 등 → souls/<name>.md 를 정체성으로 주입.
  // 페르소나는 세션 상태다(서버·봇과 동일) — 실행 플래그가 있으면 세션에 저장하고,
  // 없으면 세션에 저장된 페르소나를 이어받는다. 대화 중 '/soul' 로 변경 가능.
  const { persona: launchPersona, rest } = extractPersonaFlag(argv);
  let currentPersona: string | null = launchPersona ?? store.loadPersona(sessionId);
  let soul: string | null = null;
  if (currentPersona) {
    soul = loadSoul(config.soulsDir, currentPersona);
    if (!soul) {
      const avail = listSouls(config.soulsDir);
      // 실행 플래그로 명시했는데 없으면 중단, 세션에 남아있던 값이면 경고 후 일반 모드로.
      if (launchPersona) {
        console.error(`❌ 페르소나 '${currentPersona}' 를 찾을 수 없습니다 (souls/${currentPersona}.md 없음).`);
        console.error(
          avail.length
            ? `   사용 가능한 페르소나: ${avail.map((n) => "--" + n).join(", ")}`
            : "   souls/ 에 등록된 페르소나가 없습니다.",
        );
        rl.close();
        process.exit(1);
      }
      console.warn(`⚠️  세션 페르소나 '${currentPersona}' 를 찾을 수 없어 일반 모드로 시작합니다.`);
      currentPersona = null;
    }
  }
  // 실행 플래그로 선택한 페르소나는 세션에 영속화 (다음 실행/‘/soul’ 목록과 일치)
  if (launchPersona && soul) store.savePersona(sessionId, launchPersona);

  // 세션별 작업 폴더 (workspacePerSession=true 면 cwd/<세션ID>, 아니면 cwd 루트)
  const workspaceFor = (id: string) =>
    config.workspacePerSession ? sessionWorkspace(config.cwd, id) : config.cwd;

  // 복원된 작업 하위 폴더(change_dir)를 검증 — 폴더가 실제로 있을 때만 사용, 없으면 루트("").
  const loadValidWorkdir = (id: string) => {
    const wd = store.loadWorkdir(id);
    return wd && existsSync(resolve(workspaceFor(id), wd)) ? wd : "";
  };

  const makeAgent = () => {
    const cwd = workspaceFor(sessionId);
    mkdirSync(cwd, { recursive: true }); // 세션 폴더 보장
    return new Agent({
      llm,
      tools,
      skills,
      config: { ...config, cwd },
      soul,
      history: store.load(sessionId),
      summary: store.loadSummary(sessionId),
      workdir: loadValidWorkdir(sessionId),
      requestPermission: (a, d) => gate.request(a, d),
      log: (m) => console.log(m),
    });
  };

  const cats = skills.categories();
  const restoredWd = loadValidWorkdir(sessionId);
  const RULE = c.gray("─".repeat(56));

  console.log();
  console.log(RULE);
  console.log(`  ${c.bold(c.cyan("✨ Skillful Agent"))}   ${c.gray("스킬 기반 범용 AI 에이전트")}`);
  console.log(RULE);

  // 라벨-값 행(+선택적 보조행). 라벨은 표시 폭 기준으로 정렬한다.
  type Row = { icon: string; label: string; value: string; sub?: string };
  const rows: Row[] = [
    { icon: "🧠", label: "모델", value: c.green(config.model) },
    { icon: "🔌", label: "엔드포인트", value: c.dim(config.baseURL) },
    {
      icon: "🧩",
      label: "스킬",
      value:
        `${c.bold(String(skills.size()))}개` +
        (cats.length ? c.gray(` · ${cats.length}개 카테고리`) : c.gray(" (없음)")),
      sub: cats.length
        ? c.gray(
            cats.slice(0, 10).map((x) => x.name).join(", ") +
              (cats.length > 10 ? ` …외 ${cats.length - 10}개` : ""),
          )
        : undefined,
    },
    {
      icon: "🔧",
      label: "스킬모드",
      value: config.skillMode + (config.skillMode === "single" ? c.gray(" (오케스트레이터 숨김·리프 직접)") : ""),
    },
    { icon: "🎭", label: "페르소나", value: currentPersona ? c.magenta(currentPersona) : c.gray("(일반 모드)") },
    {
      icon: "📁",
      label: "작업폴더",
      value: workspaceFor(sessionId) + c.gray("  (파일/셸 작업은 이 안에서만)"),
      sub: restoredWd ? c.gray("└ 하위 폴더(복원): ") + c.yellow(restoredWd) : undefined,
    },
    {
      icon: "💬",
      label: "세션",
      value:
        c.cyan(sessionId) +
        (rememberedSession ? c.gray(" (마지막 세션 자동 복원)") : "") +
        (history.length ? c.gray(` · 이전 ${history.length}개 메시지 복원`) : c.gray(" · 새 세션")),
    },
  ];
  const labelW = Math.max(...rows.map((r) => dispWidth(r.label)));
  const subIndent = " ".repeat(labelW + 8); // "  " + 이모지(2) + "  " + 라벨폭 + "  "
  for (const r of rows) {
    console.log(`  ${r.icon}  ${c.dim(padEndDisp(r.label, labelW))}  ${r.value}`);
    if (r.sub) console.log(subIndent + r.sub);
  }

  console.log(RULE);
  const footW = dispWidth("명령어"); // 하단 라벨 정렬 기준(가장 긴 라벨)
  console.log(`  ${c.dim(padEndDisp("명령어", footW))}  ${c.cyan("/help")} ${c.gray("/skills /soul /sessions /session /pwd /reset")}`);
  console.log(`  ${" ".repeat(footW)}  ${c.gray("/<스킬명> [요청] 직접 실행   ('/' 후 Tab 자동완성)")}`);
  console.log(`  ${c.dim(padEndDisp("여러 줄", footW))}  ${c.gray("줄 끝에 \\  또는  ⌥(Option)+Enter 로 줄바꿈 · Enter 로 전송")}`);
  console.log(`  ${c.dim(padEndDisp("종료", footW))}  ${c.gray("exit / quit / Ctrl+C")}`);
  console.log();

  const runTurn = async (agent: Agent, input: string, skill?: ReturnType<typeof skills.get>) => {
    process.stdout.write("🤖 ");
    const reply = await agent.run(input, (delta) => process.stdout.write(delta), skill);
    // 도구만 돌고 스트리밍 텍스트가 없던 경우 대비해 최종 텍스트 보정 출력은 생략(이미 스트리밍됨)
    process.stdout.write("\n");
    const used = agent.getUsedSkills();
    if (used.length) console.log(`🧩 사용한 스킬: ${used.join(", ")}`);
    store.save(sessionId, agent.exportHistory());
    store.saveSummary(sessionId, agent.getSummary());
    store.saveWorkdir(sessionId, agent.getWorkdir()); // 재시작 시 마지막 작업 폴더 복원용
    store.saveLast(sessionId); // 다음 실행 시 이 세션으로 복원
    return reply;
  };

  // CLI·서버·봇 공용 슬래시 명령 해석기 컨텍스트
  // (CLI 는 기본적으로 리프 스킬 직접 호출을 막는다 — 카테고리 진입점만. CLI_ALLOW_LEAF_SKILL=true 로 해제)
  const cmdCtx: CommandCtx = {
    skills,
    store,
    session: sessionId,
    soulsDir: config.soulsDir,
    workspaceRoot: workspaceFor(sessionId), // '/pwd' 가 현재 작업 경로를 계산하는 기준
    allowLeafSkill: config.cliAllowLeafSkill,
  };

  // 인자로 한 줄 넘기면 단발 실행 후 종료 (스크립트 모드) — 페르소나 플래그는 제외한 나머지
  const oneShot = rest.join(" ").trim();
  if (oneShot) {
    const r = interpret(oneShot, cmdCtx);
    if (r.type === "reply" || r.type === "error") {
      console.log(r.text);
      rl.close();
      if (r.type === "error") process.exit(1);
      return;
    }
    await runTurn(makeAgent(), r.text, r.type === "skill" ? r.skill : undefined);
    rl.close();
    return;
  }

  // 복원된 세션이면 최근 대화를 한 번 보여줘 이어가기 맥락을 환기한다. ('/history' 로 다시 볼 수 있음)
  if (history.length) console.log("\n" + recentMessagesText(store, sessionId, 5) + "\n");

  // 대화형 REPL — 하나의 Agent 인스턴스로 멀티턴 유지 (명령 부수효과 시 재생성)
  let agent = makeAgent();
  while (true) {
    let input: string;
    try {
      input = (await askMultiline(rl, { prompt: "👤 ", continuation: c.gray("… ") })).trim();
    } catch (err) {
      if (isAbort(err)) break; // Ctrl+C → 조용히 종료
      throw err;
    }
    if (!input) continue;
    if (input === "exit" || input === "quit") break;
    try {
      const r = interpret(input, cmdCtx);
      if (r.type === "reply" || r.type === "error") {
        console.log(r.text + "\n");
        // 부수효과 반영: 리셋/페르소나 변경/세션 전환 → 에이전트 재생성 (히스토리는 store 에서 로드)
        if (r.type === "reply" && r.effect) {
          if (r.effect.kind === "session") {
            sessionId = r.effect.session; // 다른 세션으로 전환
            cmdCtx.session = sessionId;
            cmdCtx.workspaceRoot = workspaceFor(sessionId); // 전환한 세션의 작업 경로 기준 갱신
            store.saveLast(sessionId); // 전환한 세션을 마지막 활성으로 기록
            console.log(`  작업폴더 : ${workspaceFor(sessionId)}\n`);
          }
          currentPersona =
            r.effect.kind === "persona" ? r.effect.persona : store.loadPersona(sessionId);
          soul = currentPersona ? loadSoul(config.soulsDir, currentPersona) : null;
          agent = makeAgent();
        }
        continue;
      }
      await runTurn(agent, r.text, r.type === "skill" ? r.skill : undefined);
      console.log("");
    } catch (err: any) {
      if (isAbort(err)) break; // 처리 중 Ctrl+C → 조용히 종료
      console.error(`\n❌ 오류: ${formatError(err)}\n`);
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

/**
 * 에러를 사람이 읽을 수 있게 펼친다. OpenAI 호환 SDK 의 APIError 는 status·본문(error)에
 * 실제 실패 이유(예: 컨텍스트 초과, 잘못된 메시지)를 담고 있으나 message 만으로는 가려지므로,
 * status 코드와 서버 본문을 함께 노출해 500 같은 서버 오류의 원인을 볼 수 있게 한다.
 */
function formatError(err: any): string {
  const parts: string[] = [];
  if (typeof err?.status === "number") parts.push(`[HTTP ${err.status}]`);
  parts.push(err?.message ?? String(err));
  // SDK 가 파싱한 응답 본문(err.error) 또는 원문(err.response) 이 있으면 이유가 여기 담긴다.
  const body = err?.error ?? err?.response?.data ?? err?.response?.body;
  if (body) {
    try {
      parts.push(`\n   서버 응답: ${typeof body === "string" ? body : JSON.stringify(body)}`);
    } catch {
      /* 직렬화 실패는 무시 */
    }
  }
  if (err?.cause && err.cause !== err) parts.push(`\n   원인: ${err.cause.message ?? err.cause}`);
  return parts.join(" ");
}

main().catch((err) => {
  if (isAbort(err)) process.exit(0); // Ctrl+C 는 조용히 정상 종료
  console.error(err);
  process.exit(1);
});
