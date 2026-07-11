import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { SkillRegistry, renderSkillInstructions } from "../src/skills.js";

const here = dirname(fileURLToPath(import.meta.url));
const FIX = resolve(here, "fixtures/skills");

test("재귀 로딩: 어느 깊이든 SKILL.md 를 모두 찾는다", () => {
  const reg = SkillRegistry.load(FIX);
  assert.equal(reg.size(), 5);
  assert.ok(reg.get("ts-reviewer"));
  assert.ok(reg.get("notes")); // 최상위 직속
  assert.ok(reg.get("echo-skill")); // frontmatter name 우선(폴더명 echo 아님)
});

test("카테고리: 최상위 폴더, 직속은 general", () => {
  const reg = SkillRegistry.load(FIX);
  assert.equal(reg.get("ts-reviewer")!.category, "review");
  assert.equal(reg.get("echo-skill")!.category, "tools");
  assert.equal(reg.get("notes")!.category, "general");
  const cats = reg.categories().map((c) => c.name).sort();
  assert.deepEqual(cats, ["general", "review", "tools"]);
});

test("여러 줄 invokes 리스트 파싱", () => {
  const reg = SkillRegistry.load(FIX);
  assert.deepEqual(reg.get("review-orch")!.invokes, ["ts-reviewer", "py-reviewer"]);
  assert.equal(reg.get("ts-reviewer")!.invokes, undefined);
});

test("인라인 배열 allowed-tools 파싱", () => {
  const reg = SkillRegistry.load(FIX);
  assert.deepEqual(reg.get("echo-skill")!.allowedTools, ["read_file", "run_shell"]);
});

test("single 모드: 오케스트레이터(invokes 있음)를 발견에서 숨김", () => {
  const orchestrated = SkillRegistry.load(FIX);
  const single = SkillRegistry.load(FIX, { hideOrchestrators: true });

  // 전체 로드 수는 동일(숨김은 발견에서만)
  assert.equal(single.size(), 5);
  // 발견: review 카테고리에서 orchestrator 제외
  assert.equal(orchestrated.inCategory("review").length, 3);
  assert.equal(single.inCategory("review").length, 2);
  assert.ok(!single.names().includes("review-orch"));
  // 직접 조회는 single 에서도 가능
  assert.ok(single.get("review-orch"));
});

test("suggest: 미존재 이름에 유사 스킬 추천", () => {
  const reg = SkillRegistry.load(FIX);
  const s = reg.suggest("reviewer");
  assert.ok(s.includes("ts-reviewer"));
  assert.ok(s.includes("py-reviewer"));
});

test("renderSkillInstructions: 오케스트레이터에만 위임 안내 첨부", () => {
  const reg = SkillRegistry.load(FIX);
  const orch = renderSkillInstructions(reg.get("review-orch")!);
  const leaf = renderSkillInstructions(reg.get("ts-reviewer")!);
  assert.ok(orch.includes("위임 안내"));
  assert.ok(orch.includes("spawn_agent"));
  assert.ok(!leaf.includes("위임 안내"));
});

test("overview: 스킬 수가 적으면 전체 목록 노출", () => {
  const reg = SkillRegistry.load(FIX);
  const ov = reg.overview();
  assert.ok(ov.includes("ts-reviewer")); // flatCatalog 형태
});
