import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { Agent, artifactFilename, pad2, maxArtifactSeq } from "../src/agent.js";
import { looksLikeStall } from "../src/agent-utils.js";
import { SkillRegistry } from "../src/skills.js";
import { defaultTools } from "../src/tools/index.js";
import { writeFileTool } from "../src/tools/fs.js";
import type { Tool } from "../src/tools/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const FIX = resolve(here, "fixtures/skills");

// 각 에이전트에 격리된 빈 작업 폴더를 준다. 예전엔 cwd 로 process.cwd()(레포 루트)를 썼는데,
// 새 '토픽 하위폴더 자동 생성'이 실제 폴더를 만들어 레포 루트를 오염시키고 테스트끼리 간섭했다.
// 호출마다 고유 임시 폴더를 발급하고, 프로세스 종료 시 통째로 정리한다.
const TEST_ROOT = mkdtempSync(resolve(tmpdir(), "agent-test-"));
process.on("exit", () => {
  try {
    rmSync(TEST_ROOT, { recursive: true, force: true });
  } catch {
    /* 정리 실패는 무시 */
  }
});
let cwdSeq = 0;
function freshCwd(): string {
  const d = resolve(TEST_ROOT, `cwd-${cwdSeq++}`);
  mkdirSync(d, { recursive: true });
  return d;
}

/** 스크립트된 응답을 순서대로 반환하고, 각 호출의 tool 개수를 기록하는 가짜 LLM */
class FakeLLM {
  calls: { toolCount: number; messages: any[] }[] = [];
  constructor(private responses: any[]) {}
  private next(messages: any[], tools: any[]) {
    this.calls.push({ toolCount: tools.length, messages: [...messages] });
    return this.responses.shift() ?? { role: "assistant", content: "(end)", refusal: null };
  }
  async complete(m: any[], tools: any[]) {
    return this.next(m, tools);
  }
  async completeStream(m: any[], tools: any[], _t: any) {
    return this.next(m, tools);
  }
}

let idc = 0;
function toolCall(name: string, args: unknown) {
  return {
    role: "assistant",
    content: null,
    refusal: null,
    tool_calls: [
      { id: `c${idc++}`, type: "function", function: { name, arguments: JSON.stringify(args) } },
    ],
  };
}
const text = (content: string) => ({ role: "assistant", content, refusal: null });
/** content(산출물 본문)와 tool_calls(예: update_plan)를 함께 담은 어시스턴트 메시지 */
function textWithTool(content: string, name: string, args: unknown) {
  return {
    role: "assistant",
    content,
    refusal: null,
    tool_calls: [
      { id: `c${idc++}`, type: "function", function: { name, arguments: JSON.stringify(args) } },
    ],
  };
}

let echoRuns = 0;
const echoTool: Tool = {
  name: "echo",
  description: "echo x",
  parameters: { type: "object", properties: { x: {} }, required: ["x"] },
  async run(args) {
    echoRuns++;
    return "echoed:" + args.x;
  },
};

function makeAgent(responses: any[], tools: Tool[] = [echoTool], maxSteps = 10) {
  const llm = new FakeLLM(responses);
  const agent = new Agent({
    llm: llm as any,
    tools,
    skills: SkillRegistry.load(FIX),
    config: { cwd: freshCwd(), maxSteps, maxDepth: 3, contextMaxChars: 1e9 } as any,
    requestPermission: async () => true,
    log: () => {},
  });
  return { agent, llm };
}

test("도구 호출 없으면 응답 텍스트를 반환", async () => {
  const { agent } = makeAgent([text("안녕하세요")]);
  assert.equal(await agent.run("hi"), "안녕하세요");
});

test("도구 실행 후 최종 답변", async () => {
  echoRuns = 0;
  const { agent } = makeAgent([toolCall("echo", { x: "a" }), text("완료")]);
  assert.equal(await agent.run("go"), "완료");
  assert.equal(echoRuns, 1);
});

test("빈 응답은 (응답 없음) 으로", async () => {
  const { agent } = makeAgent([text("   ")]);
  assert.equal(await agent.run("hi"), "(응답 없음)");
});

test("동일 호출 반복 → 재실행 억제 + 3번째에 도구 없이 강제 종료", async () => {
  echoRuns = 0;
  const { agent, llm } = makeAgent([
    toolCall("echo", { x: "a" }), // 실행
    toolCall("echo", { x: "a" }), // 억제(nudge)
    toolCall("echo", { x: "a" }), // 억제 + forceFinal
    text("강제 최종 답변"), // 도구 없는 강제 완성
  ]);
  assert.equal(await agent.run("go"), "강제 최종 답변");
  assert.equal(echoRuns, 1); // 첫 호출만 실제 실행
  assert.equal(llm.calls.at(-1)!.toolCount, 0); // 마지막 호출은 도구 없이
});

test("forceFinal: 강제-최종 호출이 컨텍스트 초과로 실패해도 compact 재시도로 마무리한다", async () => {
  // 루프가 길게 돌다 감지됐을 때 히스토리가 커서 강제-최종 호출마저 컨텍스트 초과로 죽던 문제.
  // 이제 forceFinalAnswer 도 compact + 재시도를 태워 턴을 크래시시키지 않고 마무리한다.
  echoRuns = 0;
  const same = { x: "a" };
  let n = 0;
  const llm = {
    async complete(_m: any[], _tools: any[]) {
      n++;
      if (n <= 3) {
        // 동일 인자 echo 3회 → 반복 억제 → 3번째에 forceFinal
        return {
          role: "assistant",
          content: null,
          refusal: null,
          tool_calls: [{ id: `c${n}`, type: "function", function: { name: "echo", arguments: JSON.stringify(same) } }],
        };
      }
      if (n === 4) {
        // 강제-최종 호출(도구 없음)이 컨텍스트 초과로 1회 실패
        const e: any = new Error("400");
        e.error = "context length exceeded";
        throw e;
      }
      return { role: "assistant", content: "루프를 멈추고 지금까지 결과를 정리했습니다.", refusal: null };
    },
    async completeStream(m: any[], tools: any[]) {
      return this.complete(m, tools);
    },
  };
  const agent = new Agent({
    llm: llm as any,
    tools: [echoTool],
    skills: SkillRegistry.load(FIX),
    config: { cwd: freshCwd(), maxSteps: 10, maxDepth: 3, contextMaxChars: 24000 } as any,
    requestPermission: async () => true,
    log: () => {},
  });
  const out = await agent.run("go");
  assert.equal(out, "루프를 멈추고 지금까지 결과를 정리했습니다.");
  assert.equal(echoRuns, 1, "첫 호출만 실행(반복은 억제)");
  assert.ok(n >= 5, "강제-최종 호출이 컨텍스트 초과 후 재시도로 복구해야 함");
});

test("크로스턴 반복: 직전 턴과 같은 무-도구 응답을 반복하면 교정 지시 후 재시도", async () => {
  const REPEAT =
    "어디서부터 시작하고 싶으신가요? 1. 핵심 기능 정의 2. 사용자 경험 정의 3. 기술 스택 정의. " +
    "원하시는 것을 알려주시면 그에 맞춰 체계적으로 진행하겠습니다.";
  const { agent, llm } = makeAgent([
    text(REPEAT), // 1턴: 되묻기 (lastFinalResponse 로 기록)
    text(REPEAT), // 2턴 첫 응답: 동일 반복 → 감지되어 교정 지시 주입
    text("실제로 진행한 결과입니다"), // 교정 후 재생성
  ]);
  assert.equal(await agent.run("만들어줘"), REPEAT); // 1턴은 그대로
  assert.equal(await agent.run("A 로 해줘"), "실제로 진행한 결과입니다"); // 2턴은 루프를 끊고 진행
  // 마지막(교정 후) 호출의 직전 메시지에 교정 지시가 주입돼 있어야 한다
  const lastMsgs = llm.calls.at(-1)!.messages;
  assert.ok(
    lastMsgs.some(
      (m: any) =>
        m.role === "user" &&
        typeof m.content === "string" &&
        m.content.includes("다음 단계를 수행하세요"),
    ),
  );
});

test("빈 인자(arguments='') tool_call 은 '{}' 로 정규화하고 도구를 실행하지 않는다", async () => {
  // 모델이 인자 없이(또는 응답 토큰 한도로 잘려) 도구를 부른 경우 — 그대로 두면 다음 요청에서 서버 500.
  echoRuns = 0;
  const emptyArgs = {
    role: "assistant",
    content: null,
    refusal: null,
    tool_calls: [{ id: "c_empty", type: "function", function: { name: "echo", arguments: "" } }],
  };
  const { agent } = makeAgent([emptyArgs, text("끝")]);
  assert.equal(await agent.run("go"), "끝");
  assert.equal(echoRuns, 0, "빈 인자면 도구를 실행하지 않아야 함");
  const hist = agent.exportHistory();
  const withTool = hist.find((m: any) => Array.isArray(m.tool_calls) && m.tool_calls.length);
  assert.equal(withTool!.tool_calls![0].function.arguments, "{}", "빈 인자는 '{}' 로 정규화돼야 함");
  assert.ok(
    hist.some((m: any) => m.role === "tool" && String(m.content).includes("인자가 비어")),
    "인자가 비었다는 안내 결과가 있어야 함",
  );
});

test("최종 답변의 텍스트형 도구호출 마크업([TOOL_REQUEST])을 제거한다", async () => {
  const { agent } = makeAgent([
    text('작업을 마쳤습니다.\n[TOOL_REQUEST]\n{"name":"write_file","arguments":{}}\n[END_TOOL_REQUEST]'),
  ]);
  const out = await agent.run("go");
  assert.equal(out, "작업을 마쳤습니다.");
  assert.doesNotMatch(out, /TOOL_REQUEST/);
});

test("forceFinal(루프 강제 종료)의 텍스트형 도구호출도 제거된다", async () => {
  echoRuns = 0;
  const { agent } = makeAgent([
    toolCall("echo", { x: "a" }), // 실행
    toolCall("echo", { x: "a" }), // 억제
    toolCall("echo", { x: "a" }), // 억제 + forceFinal
    text('정리했습니다.\n[TOOL_REQUEST]{"name":"echo","arguments":{"x":"a"}}[END_TOOL_REQUEST]'),
  ]);
  const out = await agent.run("go");
  assert.equal(out, "정리했습니다.");
  assert.doesNotMatch(out, /TOOL_REQUEST/);
});

test("invoke_skill 로 로드한 스킬이 getUsedSkills 에 기록", async () => {
  const { agent } = makeAgent(
    [toolCall("invoke_skill", { name: "ts-reviewer" }), text("리뷰 완료")],
    defaultTools,
  );
  await agent.run("타입스크립트 리뷰");
  assert.deepEqual(agent.getUsedSkills(), ["ts-reviewer"]);
});

test("spawn_agent: 서브에이전트에 상위 작업 목표를 배경으로 전달한다", async () => {
  // 부모: spawn_agent 호출(응답#1) → 서브에이전트 무도구 종료(응답#2) → 부모 최종(응답#3)
  const llm = new FakeLLM([
    toolCall("spawn_agent", { task: "하위 작업 수행" }),
    text("서브 결과"),
    text("부모 최종"),
  ]);
  const agent = new Agent({
    llm: llm as any,
    tools: defaultTools,
    skills: SkillRegistry.load(FIX),
    config: { cwd: freshCwd(), maxSteps: 5, maxDepth: 3, contextMaxChars: 1e9, subagentInheritContext: true } as any,
    requestPermission: async () => true,
    log: () => {},
  });
  await agent.run("쇼핑몰 사이트를 만들어줘 — 상품목록/상세/장바구니 포함");
  // 서브에이전트 호출의 system 메시지에 상위 목표가 배경으로 주입됐는지 확인
  const childCall = llm.calls.find(
    (c) => typeof c.messages[0]?.content === "string" && c.messages[0].content.includes("상위 작업의 최초 요청"),
  );
  assert.ok(childCall, "서브에이전트 호출 system 에 상위 목표가 포함돼야 함");
  assert.match(childCall!.messages[0].content as string, /쇼핑몰 사이트를 만들어줘/);
});

test("spawn_agent: subagentInheritContext=false 면 상위 맥락을 넘기지 않는다(순수 격리)", async () => {
  const llm = new FakeLLM([
    toolCall("spawn_agent", { task: "하위 작업 수행" }),
    text("서브 결과"),
    text("부모 최종"),
  ]);
  const agent = new Agent({
    llm: llm as any,
    tools: defaultTools,
    skills: SkillRegistry.load(FIX),
    config: { cwd: freshCwd(), maxSteps: 5, maxDepth: 3, contextMaxChars: 1e9, subagentInheritContext: false } as any,
    requestPermission: async () => true,
    log: () => {},
  });
  await agent.run("쇼핑몰 사이트를 만들어줘 — 상품목록/상세/장바구니 포함");
  const leaked = llm.calls.some(
    (c) => typeof c.messages[0]?.content === "string" && c.messages[0].content.includes("상위 작업의 최초 요청"),
  );
  assert.ok(!leaked, "격리 모드에선 상위 맥락이 서브에이전트에 안 들어가야 함");
});

test("작업 폴더에 이미 프로젝트가 있으면 감지된 유형·재스캐폴딩 금지 안내를 맥락에 주입한다", async () => {
  // 이미 Next.js 프로젝트가 든 작업 폴더를 흉내낸다.
  const dir = mkdtempSync(resolve(tmpdir(), "wd-snapshot-"));
  writeFileSync(resolve(dir, "package.json"), JSON.stringify({ dependencies: { next: "15", react: "19" } }));
  writeFileSync(resolve(dir, "next.config.ts"), "export default {};");
  mkdirSync(resolve(dir, "app"));
  try {
    const llm = new FakeLLM([text("완료")]);
    const agent = new Agent({
      llm: llm as any,
      tools: defaultTools,
      skills: SkillRegistry.load(FIX),
      config: { cwd: dir, maxSteps: 5, maxDepth: 3, contextMaxChars: 1e9 } as any,
      requestPermission: async () => true,
      log: () => {},
    });
    await agent.run("여기에 스도쿠 페이지 만들어줘");
    const snapshot = llm.calls[0].messages.find(
      (m: any) => typeof m.content === "string" && m.content.startsWith("【현재 작업 폴더 상태】"),
    );
    assert.ok(snapshot, "첫 호출 맥락에 작업 폴더 스냅샷이 있어야 함");
    assert.match(snapshot.content, /Next\.js/, "프로젝트 유형을 Next.js 로 감지해야 함");
    assert.match(snapshot.content, /스캐폴딩/, "재스캐폴딩 금지 안내가 있어야 함");
    // 스냅샷은 일시적 — 영속 히스토리엔 남지 않는다.
    assert.ok(
      !agent.exportHistory().some((m) => typeof m.content === "string" && m.content.startsWith("【현재 작업 폴더 상태】")),
      "스냅샷은 영속 히스토리에 저장되면 안 됨",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("빈 작업 폴더에서는 스냅샷을 주입하지 않는다", async () => {
  const dir = mkdtempSync(resolve(tmpdir(), "wd-empty-"));
  try {
    const llm = new FakeLLM([text("완료")]);
    const agent = new Agent({
      llm: llm as any,
      tools: defaultTools,
      skills: SkillRegistry.load(FIX),
      config: { cwd: dir, maxSteps: 5, maxDepth: 3, contextMaxChars: 1e9 } as any,
      requestPermission: async () => true,
      log: () => {},
    });
    await agent.run("새 프로젝트 만들어줘");
    const snapshot = llm.calls[0].messages.find(
      (m: any) => typeof m.content === "string" && m.content.startsWith("【현재 작업 폴더 상태】"),
    );
    assert.ok(!snapshot, "빈 폴더에선 스냅샷이 없어야 함");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("서로 다른 도구 호출이 계속되면 maxSteps 에서 중단", async () => {
  const responses = Array.from({ length: 6 }, (_, i) => toolCall("echo", { x: i }));
  const { agent } = makeAgent(responses, [echoTool], 3);
  const out = await agent.run("go");
  assert.match(out, /최대 반복 횟수/);
});

function bigHistory() {
  const big = "내용".repeat(400); // 메시지당 ~820자
  return Array.from({ length: 8 }, (_, i) =>
    i % 2 === 0
      ? ({ role: "user", content: `u${i} ${big}` } as any)
      : ({ role: "assistant", content: `a${i} ${big}` } as any),
  );
}

test("컨텍스트 초과 시 오래된 대화를 요약해 유지 (compact)", async () => {
  const llm = new FakeLLM([text("요약본: 사용자는 파랑을 좋아함"), text("최종 답변")]);
  const agent = new Agent({
    llm: llm as any,
    tools: [echoTool],
    skills: SkillRegistry.load(FIX),
    config: { cwd: freshCwd(), maxSteps: 5, maxDepth: 3, contextMaxChars: 3000, contextSummarize: true } as any,
    requestPermission: async () => true,
    log: () => {},
    history: bigHistory(),
  });
  const out = await agent.run("현재 질문");
  assert.equal(out, "최종 답변");
  assert.match(agent.getSummary(), /요약본/); // 오래된 대화가 요약으로 유지됨
  assert.equal(llm.calls[0].toolCount, 0); // 첫 호출 = 요약(도구 없음)
});

test("contextSummarize=false 면 요약 없이 절삭 (추가 LLM 호출 없음)", async () => {
  const llm = new FakeLLM([text("최종")]);
  const agent = new Agent({
    llm: llm as any,
    tools: [echoTool],
    skills: SkillRegistry.load(FIX),
    config: { cwd: freshCwd(), maxSteps: 5, maxDepth: 3, contextMaxChars: 3000, contextSummarize: false } as any,
    requestPermission: async () => true,
    log: () => {},
    history: bigHistory(),
  });
  const out = await agent.run("현재 질문");
  assert.equal(out, "최종");
  assert.equal(agent.getSummary(), ""); // 요약 안 함
  assert.equal(llm.calls[0].toolCount, 1); // 첫 호출 = 메인(요약 호출 없음)
});

test("planFirst: 사전 계획 호출 직전에 compact 해 긴 히스토리를 예산 내로 줄여 보낸다", async () => {
  // 예전엔 선처리 진입부에서 compact 했는데, 그 뒤 스킬 지침이 주입돼 planFirst 가 예산 초과
  // 메시지를 그대로 보낼 수 있었다. 이제 compact 를 planFirst 직전으로 옮겨, 계획 호출이 항상
  // 압축된(예산 내) 히스토리를 받는다. (WD 스냅샷 노이즈를 피하려 빈 임시 폴더를 cwd 로 쓴다.)
  const planTool = defaultTools.find((t) => t.name === "update_plan")!;
  const dir = mkdtempSync(resolve(tmpdir(), "planfirst-compact-"));
  try {
    const llm = new FakeLLM([
      text("1"), // classifyTurn → 작업(계획 필요)
      toolCall("update_plan", PLAN), // planFirst 계획 호출
      text("완료"), // 메인 루프
    ]);
    const agent = new Agent({
      llm: llm as any,
      tools: [planTool, echoTool],
      skills: SkillRegistry.load(FIX),
      // 절삭 모드(요약 없음) + 작은 예산 + 큰 히스토리 → compact 가 오래된 메시지를 버려야 함
      config: {
        cwd: dir,
        maxSteps: 5,
        maxDepth: 3,
        contextMaxChars: 3000,
        contextSummarize: false,
        autoPlan: true,
      } as any,
      requestPermission: async () => true,
      log: () => {},
      history: bigHistory(), // ~6.5k자 (예산 3000 초과)
    });
    assert.equal(await agent.run("여러 단계로 작업을 수행해줘"), "완료");
    // 계획 호출(도구 1개=update_plan 만 노출)의 비-system 메시지 총량이 예산 근처로 압축됐는지 확인.
    // planFirst 가 압축하지 않았다면 원본 히스토리(~6.5k)가 그대로 실려 4000 을 크게 넘는다.
    const planCall = llm.calls.find((c) => c.toolCount === 1)!;
    const nonSystemChars = planCall.messages
      .filter((m: any) => m.role !== "system")
      .reduce((n: number, m: any) => n + (typeof m.content === "string" ? m.content.length : 0), 0);
    assert.ok(
      nonSystemChars < 4000,
      `계획 호출이 압축된 히스토리를 받아야 함 (실제 ${nonSystemChars}자)`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("컨텍스트 초과 에러가 나면 예산을 줄여 재시도하고 복구한다", async () => {
  let calls = 0;
  const llm = {
    async complete() {
      calls++;
      if (calls === 1) {
        const e: any = new Error("400");
        e.error = "The number of tokens to keep from the initial prompt is greater than the context length";
        throw e;
      }
      return { role: "assistant", content: "복구됨", refusal: null };
    },
    async completeStream() {
      return this.complete();
    },
  };
  const agent = new Agent({
    llm: llm as any,
    tools: [echoTool],
    skills: SkillRegistry.load(FIX),
    config: { cwd: freshCwd(), maxSteps: 5, maxDepth: 3, contextMaxChars: 24000 } as any,
    requestPermission: async () => true,
    log: () => {},
    history: bigHistory(),
  });
  assert.equal(await agent.run("질문"), "복구됨");
  assert.ok(calls >= 2, "최소 1회 재시도해야 함");
});

test("HTTP 500 이라도 히스토리가 작으면 예산을 붕괴시키지 않고 재시도로 복구한다", async () => {
  let calls = 0;
  const logs: string[] = [];
  const llm = {
    async complete() {
      calls++;
      if (calls === 1) {
        // 키워드 없는 HTML 500 (예: 잘린 tool_call·일시 오류) — 컨텍스트 초과가 아니다
        const e: any = new Error("500 <!DOCTYPE html><body><pre>Internal Server Error</pre></body></html>");
        e.status = 500;
        throw e;
      }
      return { role: "assistant", content: "복구됨", refusal: null };
    },
    async completeStream() {
      return this.complete();
    },
  };
  const agent = new Agent({
    llm: llm as any,
    tools: [echoTool],
    skills: SkillRegistry.load(FIX),
    config: { cwd: freshCwd(), maxSteps: 5, maxDepth: 3, contextMaxChars: 24000 } as any,
    requestPermission: async () => true,
    log: (m) => logs.push(m),
    history: bigHistory(), // ~6.5k자 < 예산*0.6 → 컨텍스트 문제 아님
  });
  assert.equal(await agent.run("질문"), "복구됨");
  assert.ok(calls >= 2, "500 을 재시도해 복구해야 함");
  assert.ok(!logs.some((l) => l.includes("줄여 재시도")), "히스토리가 작으면 예산을 줄이지 않아야 함");
  assert.ok(logs.some((l) => l.includes("예산 유지")), "예산 유지 재시도 로그가 있어야 함");
});

test("컨텍스트 초과가 계속되면(더 줄일 수 없음) 실행 가능한 안내로 종료한다", async () => {
  const llm = {
    async complete() {
      const e: any = new Error("400");
      e.error = "context length exceeded";
      throw e;
    },
    async completeStream() {
      return this.complete();
    },
  };
  const agent = new Agent({
    llm: llm as any,
    tools: [echoTool],
    skills: SkillRegistry.load(FIX),
    config: { cwd: freshCwd(), maxSteps: 5, maxDepth: 3, contextMaxChars: 24000 } as any,
    requestPermission: async () => true,
    log: () => {},
  });
  await assert.rejects(() => agent.run("질문"), /Context Length|컨텍스트 창이 너무 작아/);
});

/** 카테고리 진입점(blueprint) + 하위 스킬을 가진 임시 스킬 디렉터리를 만든다 (라우터 테스트용). */
function makeRouterSkillsDir() {
  const dir = mkdtempSync(resolve(tmpdir(), "router-skills-"));
  mkdirSync(resolve(dir, "blueprint/architecture-generator"), { recursive: true });
  writeFileSync(
    resolve(dir, "blueprint/SKILL.md"),
    "---\nname: blueprint\ndescription: Turn requirements into a full application blueprint (architecture, DB, API).\n---\n블루프린트 지침 본문.",
  );
  writeFileSync(
    resolve(dir, "blueprint/architecture-generator/SKILL.md"),
    "---\nname: architecture-generator\ndescription: Produce architecture design.\n---\n아키텍처 지침.",
  );
  return dir;
}

function routerAgent(responses: any[], skillsDir: string) {
  const llm = new FakeLLM(responses);
  const agent = new Agent({
    llm: llm as any,
    tools: [echoTool],
    skills: SkillRegistry.load(skillsDir),
    config: { cwd: freshCwd(), maxSteps: 5, maxDepth: 3, contextMaxChars: 1e9, skillRouter: true } as any,
    requestPermission: async () => true,
    log: () => {},
  });
  return { agent, llm };
}

test("스킬 라우터: 분류가 번호를 반환하면 그 스킬 지침을 주입하고 usedSkills 에 기록", async () => {
  const dir = makeRouterSkillsDir();
  try {
    // 첫 호출 = 분류(도구 없음) → "1"(=유일한 진입점 blueprint), 이후 = 메인 루프 최종 답변
    const { agent, llm } = routerAgent([text("1"), text("완료")], dir);
    const out = await agent.run("주식 MTS 시스템을 만들고 싶어. 설계가 필요해.");
    assert.equal(out, "완료");
    assert.ok(agent.getUsedSkills().includes("blueprint"), "라우팅된 스킬이 기록돼야 함");
    assert.equal(llm.calls[0].toolCount, 0, "첫 호출은 도구 없는 분류");
    const hist = agent.exportHistory();
    assert.ok(
      hist.some((m: any) => typeof m.content === "string" && m.content.includes("SKILL 지침 시작")),
      "매칭된 스킬 지침이 히스토리에 주입돼야 함",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("스킬 라우터: 분류가 0 이면 라우팅하지 않는다", async () => {
  const dir = makeRouterSkillsDir();
  try {
    const { agent } = routerAgent([text("0"), text("완료")], dir);
    await agent.run("오늘 날씨 어때? 그냥 잡담하고 싶어.");
    assert.equal(agent.getUsedSkills().length, 0, "매칭 없으면 스킬을 로드하지 않아야 함");
    const hist = agent.exportHistory();
    assert.ok(!hist.some((m: any) => typeof m.content === "string" && m.content.includes("SKILL 지침 시작")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("스킬 라우터: 이어가기·짧은 입력은 라우팅하지 않는다(분류 호출도 안 함)", async () => {
  const dir = makeRouterSkillsDir();
  try {
    const { agent, llm } = routerAgent([text("완료")], dir);
    await agent.run("진행"); // 이어가기 → 라우팅 스킵
    assert.equal(agent.getUsedSkills().length, 0);
    assert.equal(llm.calls.length, 1, "분류 호출 없이 메인 호출만 있어야 함");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("스킬 라우터: '이전 작업 이어서 진행' 도 이어가기로 보고 라우팅하지 않는다", async () => {
  const dir = makeRouterSkillsDir();
  try {
    const { agent, llm } = routerAgent([text("완료")], dir);
    await agent.run("이전 작업 이어서 진행");
    assert.equal(agent.getUsedSkills().length, 0, "이어가기는 스킬을 로드하지 않아야 함");
    assert.equal(llm.calls.length, 1, "분류 호출 없이 메인 호출만 있어야 함");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("스킬 라우터: 문장 중간의 기존작업 이어가기 참조('~진행하던거 계속')도 라우팅하지 않는다", async () => {
  const dir = makeRouterSkillsDir();
  try {
    const { agent, llm } = routerAgent([text("완료")], dir);
    await agent.run("sudoku-game 진행하던거 계속 진행해줘");
    assert.equal(agent.getUsedSkills().length, 0, "이어가기 참조는 새 스킬을 로드하지 않아야 함");
    assert.equal(llm.calls.length, 1, "분류 호출 없이 메인 호출만 있어야 함");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** skillRouter + autoPlan 을 함께 켠 에이전트 (프로덕션 기본값 — 병합 분류 경로 검증용). */
function routerPlanAgent(responses: any[], skillsDir: string) {
  const llm = new FakeLLM(responses);
  const agent = new Agent({
    llm: llm as any,
    tools: defaultTools,
    skills: SkillRegistry.load(skillsDir),
    config: {
      cwd: freshCwd(),
      maxSteps: 5,
      maxDepth: 3,
      contextMaxChars: 1e9,
      skillRouter: true,
      autoPlan: true,
    } as any,
    requestPermission: async () => true,
    log: () => {},
  });
  return { agent, llm };
}

test("병합 분류(라우터+계획): 스킬 번호 하나로 라우팅과 계획을 함께 처리 (분류 1회만)", async () => {
  const dir = makeRouterSkillsDir();
  try {
    // classifyTurn 이 "1"(=blueprint) 하나만 반환 → 라우팅 + planFirst 까지 이어진다.
    // 예전엔 classifySkill(1회) + needsPlan(스킬 매칭 시 단락되긴 함) 이었지만, 매칭 실패 경로에선 2회였다.
    const { agent, llm } = routerPlanAgent(
      [text("1"), toolCall("update_plan", PLAN), text("완료")],
      dir,
    );
    const out = await agent.run("주식 MTS 시스템을 만들고 싶어. 설계가 필요해.");
    assert.equal(out, "완료");
    assert.ok(agent.getUsedSkills().includes("blueprint"), "라우팅된 스킬이 기록돼야 함");
    assert.equal(llm.calls[0].toolCount, 0, "1번째 = 단일 분류(도구 없음)");
    assert.equal(llm.calls[1].toolCount, 1, "2번째 = 사전 계획(update_plan 만) — 중복 분류 없이 곧장 계획");
    assert.ok(llm.calls[2].toolCount > 1, "3번째 = 메인 루프(전체 도구)");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("병합 분류(라우터+계획): 0(대화) 이면 라우팅도 계획도 안 하고 분류 1회로 끝", async () => {
  const dir = makeRouterSkillsDir();
  try {
    const { agent, llm } = routerPlanAgent([text("0"), text("그건 UI 개념입니다.")], dir);
    const out = await agent.run("리액트가 뭐야?");
    assert.equal(out, "그건 UI 개념입니다.");
    assert.equal(agent.getUsedSkills().length, 0, "대화면 스킬 로드 안 함");
    assert.equal(llm.calls.length, 2, "분류 1회 + 메인 1회 (중복 분류·계획 턴 없음)");
    assert.equal(llm.calls[0].toolCount, 0);
    const mainMsgs = llm.calls[1].messages;
    assert.ok(!mainMsgs.some((m: any) => typeof m.content === "string" && m.content.includes("지금 할 단계")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("병합 분류(라우터+계획): 맞는 스킬 없어도 실제 작업(N+1)이면 라우팅 없이 계획", async () => {
  const dir = makeRouterSkillsDir();
  try {
    // 후보 1개(blueprint) → N=1, 작업(스킬 없음) 번호 = 2. 라우팅은 안 하되 계획은 세운다.
    const { agent, llm } = routerPlanAgent(
      [text("2"), toolCall("update_plan", PLAN), text("완료")],
      dir,
    );
    const out = await agent.run("로그 파일 100개를 정리해서 CSV 로 합쳐줘");
    assert.equal(out, "완료");
    assert.equal(agent.getUsedSkills().length, 0, "스킬 없음(N+1) → 라우팅 안 함");
    assert.equal(llm.calls[0].toolCount, 0, "1번째 = 단일 분류");
    assert.equal(llm.calls[1].toolCount, 1, "2번째 = 사전 계획(계획은 세움)");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function autoPlanAgent(responses: any[], maxSteps = 10) {
  const llm = new FakeLLM(responses);
  const agent = new Agent({
    llm: llm as any,
    tools: defaultTools,
    skills: SkillRegistry.load(FIX),
    config: { cwd: freshCwd(), maxSteps, maxDepth: 3, contextMaxChars: 1e9, autoPlan: true } as any,
    requestPermission: async () => true,
    log: () => {},
  });
  return { agent, llm };
}

const PLAN = {
  steps: [
    { content: "1단계", status: "in_progress" },
    { content: "2단계", status: "pending" },
  ],
};

test("autoPlan: 인사·짧은 입력은 계획을 세우지 않는다(분류 호출도 없음)", async () => {
  // "안녕?" 같은 트리비얼 입력 → needsPlan 이 LLM 호출 없이 건너뜀 → 사전 계획 없이 곧장 답변.
  const { agent, llm } = autoPlanAgent([text("안녕하세요!")]);
  assert.equal(await agent.run("안녕?"), "안녕하세요!");
  // 유일한 호출 = 메인 루프(전체 도구 노출). 사전 분류·계획 턴이 없어야 한다.
  assert.equal(llm.calls.length, 1);
  assert.ok(llm.calls[0].toolCount > 1);
  const msgs = llm.calls[0].messages;
  assert.ok(!msgs.some((m: any) => typeof m.content === "string" && m.content.includes("지금 할 단계")));
});

test("autoPlan: 대화형으로 분류(0)된 입력은 계획을 세우지 않는다", async () => {
  // 비-트리비얼이지만 단순 질문 → needsPlan 분류가 "0" → 사전 계획 생략, 곧장 답변.
  const { agent, llm } = autoPlanAgent([text("0"), text("리액트는 UI 라이브러리입니다.")]);
  assert.equal(await agent.run("리액트가 뭐야?"), "리액트는 UI 라이브러리입니다.");
  assert.equal(llm.calls.length, 2); // needsPlan 분류 + 메인 루프 (계획 턴 없음)
  assert.equal(llm.calls[0].toolCount, 0); // 분류 호출(도구 없음)
  assert.ok(llm.calls[1].toolCount > 1); // 메인 루프
  const msgs = llm.calls[1].messages;
  assert.ok(!msgs.some((m: any) => typeof m.content === "string" && m.content.includes("지금 할 단계")));
});

test("autoPlan: 시작 시 update_plan 만 노출한 사전 계획 턴을 먼저 돈다", async () => {
  // 비-트리비얼 입력 → needsPlan 분류(도구 0개) 1회 → 사전 계획 → 메인 루프 순.
  const { agent, llm } = autoPlanAgent([text("1"), toolCall("update_plan", PLAN), text("완료")]);
  assert.equal(await agent.run("여러 단계 작업"), "완료");
  // 첫 호출 = needsPlan 분류(도구 없음)
  assert.equal(llm.calls[0].toolCount, 0);
  // 둘째 호출 = 사전 계획(update_plan 하나만 노출)
  assert.equal(llm.calls[1].toolCount, 1);
  // 이후 메인 루프 = 전체 도구 노출
  assert.ok(llm.calls[2].toolCount > 1);
});

test("autoPlan: 메인 루프에 현재 계획 리마인더가 주입된다", async () => {
  const { agent, llm } = autoPlanAgent([toolCall("update_plan", PLAN), text("완료")]);
  await agent.run("작업");
  // 메인 루프 호출(2번째)의 마지막 메시지 = 계획 리마인더
  const mainMsgs = llm.calls[1].messages;
  const last = mainMsgs[mainMsgs.length - 1];
  assert.equal(last.role, "user");
  assert.match(last.content, /지금 할 단계: 1단계/);
});

test("autoPlan: 리마인더는 히스토리에 영구 저장되지 않는다", async () => {
  const { agent } = autoPlanAgent([toolCall("update_plan", PLAN), text("완료")]);
  await agent.run("작업");
  const hist = agent.exportHistory();
  assert.ok(!hist.some((m) => typeof m.content === "string" && m.content.includes("지금 할 단계")));
});

test("autoPlan: 모델이 계획을 안 세워도 정상 진행", async () => {
  // needsPlan("1") → 사전 계획 턴에서 계획 대신 그냥 텍스트를 반환하는 경우
  const { agent, llm } = autoPlanAgent([text("1"), text("계획 없음"), toolCall("echo_missing", {}), text("답변")]);
  const out = await agent.run("여러 단계 작업");
  assert.equal(out, "답변");
  // 계획이 없으므로 메인 루프엔 리마인더가 없어야 한다
  const mainMsgs = llm.calls.at(-1)!.messages;
  assert.ok(!mainMsgs.some((m: any) => typeof m.content === "string" && m.content.includes("지금 할 단계")));
});

test("autoPlan: 계획이 남았는데 작업 없이 되묻기로 끝내려 하면 다음 단계 수행을 강제", async () => {
  const { agent, llm } = autoPlanAgent([
    toolCall("update_plan", PLAN), // planFirst: in_progress + pending 단계 존재
    toolCall("list_skills", { category: "design" }), // 다음 단계 대신 스킬만 뒤짐(실제 작업 아님)
    text("어디서부터 시작할까요? 1. 핵심 기능 2. UX 3. 기술 스택. 알려주시면 진행하겠습니다."), // 작업 없이 되묻기 → 이탈 감지
    text("계획에 따라 실제로 진행했습니다"), // 교정 후 재생성
  ]);
  assert.equal(await agent.run("이어서 진행"), "계획에 따라 실제로 진행했습니다");
  // 교정 지시(다음 단계 수행)가 재생성 직전에 주입돼 있어야 한다
  const lastMsgs = llm.calls.at(-1)!.messages;
  assert.ok(
    lastMsgs.some(
      (m: any) => m.role === "user" && typeof m.content === "string" && m.content.includes("다음 단계"),
    ),
  );
});

test("autoPlan: 계획이 남아도 완료 요약으로 끝나면(하겠다 서술 아님) 재시도를 밀어붙이지 않는다", async () => {
  // 모델이 작업을 다 했지만 update_plan 으로 완료 표시를 안 해 planRemaining=true 인 상황.
  // 예전엔 무조건 '다음 단계 수행'을 밀어붙여 이미 한 작업을 다시 시켰다(같은 동작 반복).
  // 이제 최종 문장이 중도 멈춤 신호(looksLikeStall)일 때만 밀어붙인다.
  const planTool = defaultTools.find((t) => t.name === "update_plan")!;
  echoRuns = 0;
  const llm = new FakeLLM([
    toolCall("update_plan", { steps: [{ content: "a", status: "in_progress" }, { content: "b", status: "pending" }] }),
    toolCall("echo", { x: 1 }), // 실제 작업 수행(calledTool=true)
    text("요청하신 작업을 모두 마쳤습니다. 결과 파일을 저장했습니다."), // 완료 요약(하겠다/되묻기 아님)
  ]);
  const agent = new Agent({
    llm: llm as any,
    tools: [planTool, echoTool],
    skills: SkillRegistry.load(FIX),
    config: { cwd: freshCwd(), maxSteps: 10, maxDepth: 3, contextMaxChars: 1e9, autoPlan: true } as any,
    requestPermission: async () => true,
    log: () => {},
  });
  assert.equal(await agent.run("작업"), "요청하신 작업을 모두 마쳤습니다. 결과 파일을 저장했습니다.");
  assert.equal(echoRuns, 1, "작업을 한 번만 수행해야 함(재시도로 반복 안 함)");
  // 교정 지시가 주입되지 않았어야 한다
  const injected = llm.calls.some((c) =>
    c.messages.some((m: any) => m.role === "user" && typeof m.content === "string" && m.content.includes("이미 끝낸 작업")),
  );
  assert.ok(!injected, "완료 요약엔 다음 단계 수행 지시를 주입하면 안 됨");
});

test("autoPlan: 계획을 모두 완료하고 끝내면 중도 멈춤으로 오인하지 않는다", async () => {
  const planTool = defaultTools.find((t) => t.name === "update_plan")!;
  const llm = new FakeLLM([
    toolCall("update_plan", { steps: [{ content: "a", status: "in_progress" }] }), // planFirst
    toolCall("update_plan", { steps: [{ content: "a", status: "completed" }] }), // 단계 완료 처리
    text("작업을 마쳤습니다"), // 계획이 모두 완료됨 → 밀어붙이지 않고 그대로 종료
  ]);
  const agent = new Agent({
    llm: llm as any,
    tools: [planTool, echoTool],
    skills: SkillRegistry.load(FIX),
    config: { cwd: freshCwd(), maxSteps: 10, maxDepth: 3, contextMaxChars: 1e9, autoPlan: true } as any,
    requestPermission: async () => true,
    log: () => {},
  });
  assert.equal(await agent.run("작업"), "작업을 마쳤습니다");
});

test("autoPlan: 작업하다 계획이 남았는데 서술만 하고 끝내면 다음 단계를 한 번 밀어준다", async () => {
  const planTool = defaultTools.find((t) => t.name === "update_plan")!;
  const llm = new FakeLLM([
    toolCall("update_plan", {
      steps: [
        { content: "a", status: "in_progress" },
        { content: "b", status: "pending" },
      ],
    }), // planFirst
    toolCall("echo", { x: 1 }), // 실제 작업 1개 수행
    text("다음 단계를 진행하겠습니다"), // 계획 남았는데 '하겠다'고 서술만 → 밀어주기 발동
    text("정말 끝"), // 밀어준 뒤 재생성
  ]);
  const agent = new Agent({
    llm: llm as any,
    tools: [planTool, echoTool],
    skills: SkillRegistry.load(FIX),
    config: { cwd: freshCwd(), maxSteps: 10, maxDepth: 3, contextMaxChars: 1e9, autoPlan: true } as any,
    requestPermission: async () => true,
    log: () => {},
  });
  // 서술로 끝나려던 걸 프레임워크가 한 번 밀어붙여 재생성시킨다
  assert.equal(await agent.run("작업"), "정말 끝");
});

test("autoPlan: 계획 완료 후 '최종 답변 작성' 넛지는 한 번만 주입한다(완료 상태 반복 주입 방지)", async () => {
  const planTool = defaultTools.find((t) => t.name === "update_plan")!;
  echoRuns = 0;
  const llm = new FakeLLM([
    text("1"), // classifyTurn → 작업
    toolCall("update_plan", { steps: [{ content: "a", status: "completed" }] }), // planFirst → 이미 전부 완료
    toolCall("echo", { x: 1 }), // 완료 후 스텝1 (넛지 1회 주입됨)
    toolCall("echo", { x: 2 }), // 완료 후 스텝2 (넛지 반복 주입 안 함)
    text("최종"),
  ]);
  const agent = new Agent({
    llm: llm as any,
    tools: [planTool, echoTool],
    skills: SkillRegistry.load(FIX),
    config: { cwd: freshCwd(), maxSteps: 10, maxDepth: 3, contextMaxChars: 1e9, autoPlan: true } as any,
    requestPermission: async () => true,
    log: () => {},
  });
  assert.equal(await agent.run("여러 단계로 작업을 수행해줘"), "최종");
  assert.equal(echoRuns, 2, "완료 후 도구 호출은 그대로 실행돼야 함");
  const nudged = llm.calls.filter((c) =>
    c.messages.some(
      (m: any) =>
        m.role === "user" && typeof m.content === "string" && m.content.includes("모든 단계를 완료했습니다"),
    ),
  );
  assert.equal(nudged.length, 1, "완료 넛지는 여러 스텝에 걸쳐도 한 번만 주입돼야 함");
});

test("autoPlan: update_plan 만 3턴 연속이면 도구 없이 최종 답변 강제", async () => {
  const { agent, llm } = autoPlanAgent([
    text("1"), // needsPlan
    toolCall("update_plan", { steps: [{ content: "a", status: "in_progress" }] }), // planFirst
    toolCall("update_plan", { steps: [{ content: "a", status: "completed" }] }), // streak 1
    toolCall("update_plan", { steps: [{ content: "a", status: "completed" }, { content: "b", status: "in_progress" }] }), // streak 2
    toolCall("update_plan", { steps: [{ content: "a", status: "completed" }, { content: "b", status: "completed" }] }), // streak 3 → forceFinal
    text("강제 최종 답변"),
  ]);
  assert.equal(await agent.run("여러 단계 작업"), "강제 최종 답변");
  assert.equal(llm.calls.at(-1)!.toolCount, 0); // 마지막 강제 답변은 도구 없이
});

function makeCapturingWrite() {
  const saved: { path?: string; content?: string }[] = [];
  const tool: Tool = {
    name: "write_file",
    description: "stub",
    parameters: { type: "object", properties: { path: {}, content: {} }, required: ["path", "content"] },
    async run(args) {
      saved.push({ path: args.path, content: args.content });
      return `${args.path} 저장 완료`;
    },
  };
  return { tool, saved };
}

function autoSaveAgent(responses: any[], tools: Tool[]) {
  const llm = new FakeLLM(responses);
  const agent = new Agent({
    llm: llm as any,
    tools,
    skills: SkillRegistry.load(FIX),
    config: { cwd: freshCwd(), maxSteps: 5, maxDepth: 3, contextMaxChars: 1e9, autoPlan: false, autoSaveArtifacts: true } as any,
    requestPermission: async () => true,
    log: () => {},
  });
  return agent;
}

const LONG_DOC = "# 프로젝트 설계서\n\n" + "이것은 설계 문서의 본문입니다. ".repeat(50); // >800자, 헤더 있음

test("artifactFilename: 헤더에서 파일명 유도 + 타임스탬프", () => {
  const fn = artifactFilename("# 프로젝트 설계서\n내용", new Date("2026-07-13T09:30:00Z"));
  assert.equal(fn, "프로젝트-설계서-2026-07-13T09-30-00.md");
});

test("artifactFilename: 이모지·괄호·기호를 제거한다", () => {
  const fn = artifactFilename("# 🤖 프로젝트 핵심 (Core)\n본문", new Date("2026-07-13T09:30:00Z"));
  assert.equal(fn, "프로젝트-핵심-Core-2026-07-13T09-30-00.md");
});

test("looksLikeStall: 하겠다·되묻기는 중도 멈춤, 완료 요약은 아님", () => {
  // 중도 멈춤(밀어붙일 대상)
  assert.ok(looksLikeStall("다음 단계를 진행하겠습니다"));
  assert.ok(looksLikeStall("이제 로그인 페이지를 만들겠습니다."));
  assert.ok(looksLikeStall("어디서부터 시작할까요? 알려주시면 진행하겠습니다."));
  assert.ok(looksLikeStall("어떤 방식으로 할까요?"));
  // 완료 요약(밀어붙이면 안 됨)
  assert.ok(!looksLikeStall("요청하신 작업을 모두 마쳤습니다. 결과 파일을 저장했습니다."));
  assert.ok(!looksLikeStall("스도쿠 페이지를 만들었습니다. app/page.tsx 에 저장했습니다."));
  assert.ok(!looksLikeStall(""));
});

test("pad2: 두 자리 0 채움", () => {
  assert.equal(pad2(1), "01");
  assert.equal(pad2(9), "09");
  assert.equal(pad2(10), "10");
  assert.equal(pad2(100), "100"); // 100 이상은 그대로
});

test("maxArtifactSeq: 폴더의 NN- 접두 최대 번호 (없으면 0)", () => {
  const dir = mkdtempSync(resolve(tmpdir(), "artseq-"));
  try {
    assert.equal(maxArtifactSeq(dir), 0); // 비어 있음
    writeFileSync(resolve(dir, "01-a.md"), "");
    writeFileSync(resolve(dir, "03-b.md"), "");
    writeFileSync(resolve(dir, "readme.md"), ""); // 번호 없는 파일은 무시
    assert.equal(maxArtifactSeq(dir), 3);
    assert.equal(maxArtifactSeq(resolve(dir, "nope")), 0); // 없는 폴더 → 0
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("토픽 폴더: 새 작업마다 NN-slug 하위폴더를 발급하고 이어가기는 재사용한다", async () => {
  const dir = freshCwd();
  const plan = { steps: [{ content: "s1", status: "in_progress" }] };
  const llm = new FakeLLM([
    text("1"), // 1턴: 작업으로 분류
    toolCall("update_plan", plan), // planFirst
    text("작업1 완료"), // 메인 루프 최종
    text("이어서 완료"), // 2턴(이어가기): 분류·planFirst 없이 최종만
    text("1"), // 3턴: 작업으로 분류
    toolCall("update_plan", plan), // planFirst
    text("작업2 완료"), // 메인 루프 최종
  ]);
  const agent = new Agent({
    llm: llm as any,
    tools: [echoTool],
    skills: SkillRegistry.load(FIX),
    config: { cwd: dir, maxSteps: 5, maxDepth: 3, contextMaxChars: 1e9, autoPlan: true } as any,
    requestPermission: async () => true,
    log: () => {},
  });

  await agent.run("여러 단계로 블루프린트를 설계해줘");
  const wd1 = agent.getWorkdir();
  assert.match(wd1, /^01-/, "첫 작업은 01- 토픽 폴더를 발급");
  assert.ok(existsSync(resolve(dir, wd1)), "토픽 폴더가 실제로 생성됨");

  await agent.run("계속"); // 이어가기 → 같은 폴더 유지
  assert.equal(agent.getWorkdir(), wd1, "이어가기 턴은 새 폴더를 만들지 않음");

  await agent.run("이번엔 데이터 분석을 여러 단계로 해줘");
  const wd2 = agent.getWorkdir();
  assert.match(wd2, /^02-/, "다음 새 작업은 02- 토픽 폴더");
  assert.notEqual(wd2, wd1, "새 작업은 이전 토픽과 분리됨");
});

test("토픽 폴더: 다른 곳(입력)에 있는 .md 언급은 이어가기가 아니라 새 작업으로 분리한다(교차 오염 방지)", async () => {
  const dir = freshCwd();
  // 새 작업의 입력 파일을 워크스페이스에 배치 (예: 두 번째 PRD)
  mkdirSync(resolve(dir, "prd"), { recursive: true });
  writeFileSync(resolve(dir, "prd/2-nestjs.md"), "# nestjs PRD");

  const plan = { steps: [{ content: "s1", status: "in_progress" }] };
  const llm = new FakeLLM([
    text("1"), // 1턴: 작업으로 분류
    toolCall("update_plan", plan), // planFirst
    toolCall("write_file", { path: "architecture.md", content: "# arch" }), // 01 폴더에 .md 산출물
    text("작업1 완료"),
    text("1"), // 2턴: (이어가기로 오인 안 돼야) 작업 분류에 도달
    toolCall("update_plan", plan), // planFirst
    text("작업2 완료"),
  ]);
  const agent = new Agent({
    llm: llm as any,
    tools: [writeFileTool],
    skills: SkillRegistry.load(FIX),
    config: { cwd: dir, maxSteps: 6, maxDepth: 2, contextMaxChars: 1e9, autoPlan: true } as any,
    requestPermission: async () => true,
    log: () => {},
  });

  await agent.run("여러 단계로 블루프린트를 설계해줘");
  const wd1 = agent.getWorkdir();
  assert.match(wd1, /^01-/, "첫 작업은 01- 토픽 폴더");
  assert.ok(existsSync(resolve(dir, wd1, "architecture.md")), "01 폴더에 .md 산출물 생성");

  // 확장자(.md)만 겹치지만 언급 파일이 다른 곳의 '입력'이라 이어가기가 아니어야 함 → 새 02 폴더
  await agent.run("prd/2-nestjs.md 를 읽고 요구된 산출물을 모두 만들어줘");
  const wd2 = agent.getWorkdir();
  assert.match(wd2, /^02-/, "입력 .md 언급은 새 작업 → 02 폴더로 분리");
  assert.notEqual(wd2, wd1, "새 작업은 이전 토픽과 섞이지 않음");
});

test("autoSave: 긴 문서형 답변을 write_file 로 자동 저장하고 경로를 덧붙인다", async () => {
  const { tool, saved } = makeCapturingWrite();
  const out = await autoSaveAgent([text(LONG_DOC)], [tool]).run("설계서 작성");
  assert.equal(saved.length, 1);
  assert.match(saved[0].path!, /^01-.*\.md$/); // 두 자리 순번 접두 + .md
  assert.equal(saved[0].content, LONG_DOC.trim()); // 앞뒤 공백은 다듬어 저장
  assert.match(out, /산출물을 파일로 저장/);
});

test("autoSave: 사용자가 저장을 거부하면(denied) 저장 안내를 붙이지 않는다", async () => {
  // 문자열 문구가 아니라 ToolResult.denied 로 거부를 판별하는지 검증(문구가 바뀌어도 안 깨지도록).
  const attempts: unknown[] = [];
  const deniedWrite: Tool = {
    name: "write_file",
    description: "stub",
    parameters: { type: "object", properties: { path: {}, content: {} }, required: ["path", "content"] },
    async run(args) {
      attempts.push(args.path);
      return { content: "임의의 거부 문구(문자열 매칭에 의존하지 않음)", denied: true };
    },
  };
  const out = await autoSaveAgent([text(LONG_DOC)], [deniedWrite]).run("설계서 작성");
  assert.equal(attempts.length, 1, "자동 저장을 시도(write_file 호출)는 해야 함");
  assert.doesNotMatch(out, /산출물을 파일로 저장/, "거부됐으면 저장 안내를 붙이면 안 됨");
  assert.equal(out, LONG_DOC.trim(), "답변 본문은 그대로 반환");
});

test("autoSave: 짧은 답변은 저장하지 않는다", async () => {
  const { tool, saved } = makeCapturingWrite();
  const out = await autoSaveAgent([text("짧은 답변입니다")], [tool]).run("질문");
  assert.equal(saved.length, 0);
  assert.equal(out, "짧은 답변입니다");
});

test("autoSave: 이미 write_file 을 쓴 턴은 중복 저장하지 않는다", async () => {
  const { tool, saved } = makeCapturingWrite();
  const out = await autoSaveAgent(
    [toolCall("write_file", { path: "doc.md", content: "x" }), text(LONG_DOC)],
    [tool],
  ).run("설계서 저장");
  assert.equal(saved.length, 1); // 명시적 1회만, 자동 저장 없음
  assert.equal(saved[0].path, "doc.md");
  assert.doesNotMatch(out, /산출물을 파일로 저장/);
});

const DOC_A = "# DB 스키마\n\n" + "테이블과 컬럼에 대한 설명. ".repeat(50); // >800자, 헤더 있음
const DOC_B = "# 시스템 아키텍처\n\n" + "컴포넌트와 상호작용에 대한 설명. ".repeat(50);

test("autoSave: 도구 호출과 함께 나온 중간 산출물을 개별 파일로 저장한다", async () => {
  const { tool, saved } = makeCapturingWrite();
  // 각 단계가 '산출물 본문 + update_plan' 으로 나오고, 마지막에 도구 없는 최종 정리
  const out = await autoSaveAgent(
    [
      textWithTool(DOC_A, "echo", { x: 1 }),
      textWithTool(DOC_B, "echo", { x: 2 }),
      text(LONG_DOC),
    ],
    [tool, echoTool],
  ).run("설계서 작성");
  // 중간 2개(DOC_A, DOC_B) + 최종 1개(LONG_DOC) = 3개 파일
  assert.equal(saved.length, 3);
  assert.equal(saved[0].content, DOC_A.trim());
  assert.equal(saved[1].content, DOC_B.trim());
  assert.equal(saved[2].content, LONG_DOC.trim());
  // 저장 순서대로 두 자리 순번이 앞에 붙어 폴더에서도 순서가 유지된다
  assert.match(saved[0].path!, /^01-DB-스키마-/);
  assert.match(saved[1].path!, /^02-시스템-아키텍처-/);
  assert.match(saved[2].path!, /^03-/);
  assert.match(out, /산출물을 파일로 저장/); // 최종 정리도 저장됨
});

test("autoSave: 같은 제목의 중간 산출물은 한 번만 저장한다", async () => {
  const { tool, saved } = makeCapturingWrite();
  await autoSaveAgent(
    [textWithTool(DOC_A, "echo", { x: 1 }), textWithTool(DOC_A, "echo", { x: 2 }), text("끝")],
    [tool, echoTool],
  ).run("작업");
  assert.equal(saved.length, 1); // 제목이 같으면 중복 저장 안 함
});

test("autoSave: 같은 턴에 모델이 write_file 하면 중간 저장은 건너뛴다", async () => {
  const { tool, saved } = makeCapturingWrite();
  await autoSaveAgent(
    [textWithTool(DOC_A, "write_file", { path: "manual.md", content: DOC_A }), text("끝")],
    [tool],
  ).run("작업");
  assert.equal(saved.length, 1); // 모델의 명시적 저장만, 중복 자동 저장 없음
  assert.equal(saved[0].path, "manual.md");
});

test("autoSave: 짧은 진행 코멘트가 도구와 함께 나오면 저장하지 않는다", async () => {
  const { tool, saved } = makeCapturingWrite();
  await autoSaveAgent(
    [textWithTool("좌석 조회를 진행합니다.", "echo", { x: 1 }), text("끝")],
    [tool, echoTool],
  ).run("작업");
  assert.equal(saved.length, 0);
});

test("autoSave: write_file tool_call 인자를 표식으로 치환하지 않는다(모델이 표식을 내용으로 흉내내는 버그 방지)", async () => {
  const { tool, saved } = makeCapturingWrite();
  const agent = autoSaveAgent(
    [textWithTool("설계를 저장합니다.", "write_file", { path: "d.md", content: LONG_DOC }), text("끝")],
    [tool],
  );
  await agent.run("작업");
  // 파일에는 원문 전체가 저장된다
  assert.equal(saved.length, 1);
  assert.equal(saved[0].content, LONG_DOC);
  // 히스토리의 tool_call 인자에도 원문이 그대로 남아야 한다 (표식으로 치환 금지 —
  // 표식을 남기면 모델이 그걸 '내용'으로 흉내 내 실제 파일에 표식을 써버림)
  const hist = agent.exportHistory();
  const withTool = hist.find((m: any) => Array.isArray(m.tool_calls) && m.tool_calls.length);
  const argsContent = JSON.parse(withTool!.tool_calls![0].function.arguments).content;
  assert.doesNotMatch(argsContent, /생략 — 파일에 저장됨/, "인자에 표식이 남으면 안 됨");
  assert.equal(argsContent, LONG_DOC, "인자에 원문이 그대로 보존돼야 함");
});

test("autoSave: 저장한 중간 산출물의 원문은 히스토리에서 포인터로 치환된다", async () => {
  const { tool } = makeCapturingWrite();
  const agent = autoSaveAgent([textWithTool(DOC_A, "echo", { x: 1 }), text("끝")], [tool, echoTool]);
  await agent.run("작업");
  const hist = agent.exportHistory();
  const withTool = hist.find((m: any) => Array.isArray(m.tool_calls) && m.tool_calls.length);
  assert.ok(withTool, "도구 호출을 담은 어시스턴트 메시지가 있어야 함");
  // 원문(긴 본문)은 사라지고 저장 포인터만 남는다
  assert.match(withTool!.content as string, /파일로 저장함/);
  assert.doesNotMatch(withTool!.content as string, /테이블과 컬럼에 대한 설명/);
});

test("exportHistory 는 system 을 제외한다", async () => {
  const { agent } = makeAgent([text("ok")]);
  await agent.run("hi");
  const hist = agent.exportHistory();
  assert.ok(hist.every((m) => m.role !== "system"));
  assert.equal(hist[0].role, "user");
});

// ── #5: 방금 만든 산출물을 가리키는 후속을 '이어가기'로 판정(새 폴더·재라우팅 방지) ──
function makeBareAgent(cwd: string) {
  return new Agent({
    llm: new FakeLLM([]) as any,
    tools: [echoTool],
    skills: SkillRegistry.load(FIX),
    config: { cwd, maxSteps: 10, maxDepth: 3, contextMaxChars: 1e9 } as any,
    requestPermission: async () => true,
    log: () => {},
  });
}

test("continuesCurrentTopic: 현재 토픽 폴더 산출물을 가리키는 후속은 이어가기(#5)", () => {
  const cwd = freshCwd();
  const a = makeBareAgent(cwd) as any;
  const topic = resolve(cwd, "01-blueprint");
  mkdirSync(topic, { recursive: true });
  for (const f of ["architecture.md", "database.md", "domain-model.md"]) {
    writeFileSync(resolve(topic, f), "x");
  }
  a.workdir = "01-blueprint";

  // 아직 안 만든 형제 파일(api-spec.md) 교정 후속 → 같은 확장자 → 이어가기 (벤치 turn2 재현)
  assert.equal(a.continuesCurrentTopic("api-spec.md가 생성이 안된걸로 보여지는데 확인 필요"), true);
  // 이미 있는 파일 직접 언급 → 이어가기
  assert.equal(a.continuesCurrentTopic("architecture.md 좀 고쳐줘"), true);
  // 파일명 없이 '방금 만든 것' 참조 신호 → 이어가기
  assert.equal(a.continuesCurrentTopic("방금 만든 문서 다시 정리해줘"), true);
  // 다른 확장자·신호 없음 → 새 작업
  assert.equal(a.continuesCurrentTopic("test.py 스크립트 하나 만들어줘"), false);
  // 무관한 새 작업 → 새 작업
  assert.equal(a.continuesCurrentTopic("스도쿠 게임 웹으로 만들어줘"), false);
});

test("continuesCurrentTopic: 토픽 폴더가 없거나 비면 새 작업(false)", () => {
  const cwd = freshCwd();
  const a = makeBareAgent(cwd) as any;
  assert.equal(a.continuesCurrentTopic("architecture.md 확인"), false); // workdir=""
  a.workdir = "01-blueprint";
  mkdirSync(resolve(cwd, "01-blueprint"), { recursive: true });
  assert.equal(a.continuesCurrentTopic("architecture.md 확인"), false); // 폴더 비어있음
});
