import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPersonaFlag } from "../src/soul.js";

test("단축형 --oliver: 플래그 이름이 곧 페르소나", () => {
  const { persona, rest } = extractPersonaFlag(["--oliver", "안녕"]);
  assert.equal(persona, "oliver");
  assert.deepEqual(rest, ["안녕"]);
});

test("값-인자형 --persona oliver (PowerShell 친화)", () => {
  const { persona, rest } = extractPersonaFlag(["--persona", "oliver", "질문"]);
  assert.equal(persona, "oliver");
  assert.deepEqual(rest, ["질문"]);
});

test("등호형 --persona=claire / --soul=claire", () => {
  assert.equal(extractPersonaFlag(["--persona=claire"]).persona, "claire");
  assert.equal(extractPersonaFlag(["--soul=claire"]).persona, "claire");
});

test("--soul 는 --persona 의 별칭", () => {
  const { persona, rest } = extractPersonaFlag(["--soul", "oliver", "hi"]);
  assert.equal(persona, "oliver");
  assert.deepEqual(rest, ["hi"]);
});

test("먼저 나온 페르소나 하나만 채택, 나머지는 rest 로", () => {
  const { persona, rest } = extractPersonaFlag(["--persona", "oliver", "--claire", "x"]);
  assert.equal(persona, "oliver");
  assert.deepEqual(rest, ["--claire", "x"]);
});

test("플래그 없으면 일반 모드(null)", () => {
  const { persona, rest } = extractPersonaFlag(["그냥", "질문"]);
  assert.equal(persona, null);
  assert.deepEqual(rest, ["그냥", "질문"]);
});

test("--persona 뒤에 값이 없으면 조용히 무시", () => {
  const { persona, rest } = extractPersonaFlag(["--persona"]);
  assert.equal(persona, null);
  assert.deepEqual(rest, []);
});
