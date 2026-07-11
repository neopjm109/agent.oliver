import { test } from "node:test";
import assert from "node:assert/strict";
import { truncateHistory } from "../src/agent.js";
import type { ChatCompletionMessageParam } from "../src/llm.js";

const sys = { role: "system", content: "S".repeat(50) } as ChatCompletionMessageParam;
const user = (n: number) => ({ role: "user", content: `U${n}:` + "x".repeat(90) }) as ChatCompletionMessageParam;
const asst = (n: number) => ({ role: "assistant", content: `A${n}:` + "y".repeat(90) }) as ChatCompletionMessageParam;

test("예산이 충분하면 그대로 둔다", () => {
  const msgs = [sys, user(1), asst(1)];
  assert.deepEqual(truncateHistory(msgs, 100000), msgs);
});

test("system 은 항상 유지하고 오래된 것부터 자른다", () => {
  const msgs = [sys, user(1), asst(1), user(2), asst(2), user(3), asst(3)];
  const out = truncateHistory(msgs, 300); // system(70) + 약 2~3개만
  assert.equal(out[0].role, "system");
  // 최신 메시지는 남아 있어야 함
  assert.ok(out.some((m) => typeof m.content === "string" && m.content.startsWith("A3")));
  // 오래된 것은 잘렸어야 함
  assert.ok(!out.some((m) => typeof m.content === "string" && m.content.startsWith("U1")));
  assert.ok(out.length < msgs.length);
});

test("tool 짝을 깨지 않도록 앞쪽 orphan 을 버린다(첫 비시스템은 user)", () => {
  const msgs: ChatCompletionMessageParam[] = [
    sys,
    user(1),
    { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "t", arguments: "{}" } }] } as any,
    { role: "tool", tool_call_id: "c1", content: "Z".repeat(90) } as any,
    user(2),
    asst(2),
  ];
  // 예산상 user(2)+asst(2) 만 남고 앞의 tool 시퀀스는 잘림.
  // 잘린 tail 이 orphan(tool/assistant)으로 시작하지 않고 user 경계여야 함.
  const out = truncateHistory(msgs, 370);
  const firstNonSystem = out.find((m) => m.role !== "system");
  assert.equal(firstNonSystem?.role, "user"); // orphan tool 로 시작하지 않음
  assert.ok(!out.some((m) => m.role === "tool")); // orphan tool 이 남지 않음
});

test("빈 배열은 그대로", () => {
  assert.deepEqual(truncateHistory([], 100), []);
});
