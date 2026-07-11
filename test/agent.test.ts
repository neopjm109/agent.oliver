import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Agent } from "../src/agent.js";
import { SkillRegistry } from "../src/skills.js";
import { defaultTools } from "../src/tools/index.js";
import type { Tool } from "../src/tools/types.js";

const here = dirname(fileURLToPath(import.meta.url));
const FIX = resolve(here, "fixtures/skills");

/** 스크립트된 응답을 순서대로 반환하고, 각 호출의 tool 개수를 기록하는 가짜 LLM */
class FakeLLM {
  calls: { toolCount: number }[] = [];
  constructor(private responses: any[]) {}
  private next(tools: any[]) {
    this.calls.push({ toolCount: tools.length });
    return this.responses.shift() ?? { role: "assistant", content: "(end)", refusal: null };
  }
  async complete(_m: any[], tools: any[]) {
    return this.next(tools);
  }
  async completeStream(_m: any[], tools: any[], _t: any) {
    return this.next(tools);
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
    config: { cwd: process.cwd(), maxSteps, maxDepth: 3, contextMaxChars: 1e9 } as any,
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

test("invoke_skill 로 로드한 스킬이 getUsedSkills 에 기록", async () => {
  const { agent } = makeAgent(
    [toolCall("invoke_skill", { name: "ts-reviewer" }), text("리뷰 완료")],
    defaultTools,
  );
  await agent.run("타입스크립트 리뷰");
  assert.deepEqual(agent.getUsedSkills(), ["ts-reviewer"]);
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
    config: { cwd: process.cwd(), maxSteps: 5, maxDepth: 3, contextMaxChars: 3000, contextSummarize: true } as any,
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
    config: { cwd: process.cwd(), maxSteps: 5, maxDepth: 3, contextMaxChars: 3000, contextSummarize: false } as any,
    requestPermission: async () => true,
    log: () => {},
    history: bigHistory(),
  });
  const out = await agent.run("현재 질문");
  assert.equal(out, "최종");
  assert.equal(agent.getSummary(), ""); // 요약 안 함
  assert.equal(llm.calls[0].toolCount, 1); // 첫 호출 = 메인(요약 호출 없음)
});

test("exportHistory 는 system 을 제외한다", async () => {
  const { agent } = makeAgent([text("ok")]);
  await agent.run("hi");
  const hist = agent.exportHistory();
  assert.ok(hist.every((m) => m.role !== "system"));
  assert.equal(hist[0].role, "user");
});
