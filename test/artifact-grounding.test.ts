import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { extractFilenames, collectWorkspaceFiles, claimedButMissing } from "../src/agent-utils.js";
import { updatePlanTool } from "../src/tools/plan.js";
import type { PlanStep } from "../src/tools/types.js";

function tmpRoot(): string {
  return mkdtempSync(resolve(tmpdir(), "grounding-"));
}

test("extractFilenames: 파일명(확장자)만 basename 으로, 중복 제거", () => {
  const files = extractFilenames(
    "생성된 산출물: architecture.md, ../prd/1-blueprint.md, api-spec.md 그리고 다시 architecture.md",
  );
  assert.deepEqual(files, ["architecture.md", "1-blueprint.md", "api-spec.md"]);
});

test("extractFilenames: 확장자 없는 일반 낱말은 무시", () => {
  assert.deepEqual(extractFilenames("이 문서는 아키텍처 설계와 API 명세를 담습니다."), []);
});

test("collectWorkspaceFiles: 하위까지 수집하고 노이즈 폴더는 제외", () => {
  const root = tmpRoot();
  try {
    mkdirSync(resolve(root, "sub"), { recursive: true });
    mkdirSync(resolve(root, "node_modules/pkg"), { recursive: true });
    writeFileSync(resolve(root, "a.md"), "x");
    writeFileSync(resolve(root, "sub/b.ts"), "x");
    writeFileSync(resolve(root, "node_modules/pkg/c.js"), "x"); // 무시돼야 함
    const names = collectWorkspaceFiles(root);
    assert.ok(names.has("a.md"));
    assert.ok(names.has("b.ts"));
    assert.ok(!names.has("c.js"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("claimedButMissing: 존재하는 파일은 제외, 없는데 생성됐다고 주장하면 검출", () => {
  const root = tmpRoot();
  try {
    writeFileSync(resolve(root, "architecture.md"), "x");
    writeFileSync(resolve(root, "database.md"), "x");
    // api-spec.md 는 만들지 않음 — 벤치 실패 재현
    const summary =
      "요구된 4개 문서가 생성 및 저장되었습니다: architecture.md, database.md, api-spec.md.";
    assert.deepEqual(claimedButMissing(summary, root), ["api-spec.md"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("claimedButMissing: '생성하지 못함' 등 정직한 실패 보고는 오탐하지 않음", () => {
  const root = tmpRoot();
  try {
    writeFileSync(resolve(root, "architecture.md"), "x");
    const honest = "architecture.md 는 생성했으나, api-spec.md 는 생성하지 못했습니다.";
    assert.deepEqual(claimedButMissing(honest, root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("claimedButMissing: 파일명이 없으면 빈 배열", () => {
  const root = tmpRoot();
  try {
    assert.deepEqual(claimedButMissing("작업을 완료했습니다.", root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/** update_plan 실행용 최소 ToolContext. */
function planCtx(root: string) {
  let plan: PlanStep[] = [];
  const c: any = {
    root,
    cwd: root,
    setPlan(steps: PlanStep[]) {
      plan = steps;
    },
    getPlan() {
      return plan;
    },
  };
  return { c, get: () => plan };
}

test("update_plan 게이트: 파일 없는 단계의 '완료'는 pending 으로 되돌리고 경고", async () => {
  const root = tmpRoot();
  try {
    writeFileSync(resolve(root, "architecture.md"), "x");
    const { c, get } = planCtx(root);
    const res: any = await updatePlanTool.run(
      {
        steps: [
          { content: "architecture.md 파일을 생성한다", status: "completed" },
          { content: "api-spec.md 파일을 생성한다", status: "completed" },
        ],
      },
      c,
    );
    const msg = typeof res === "string" ? res : res.content;
    assert.match(msg, /api-spec\.md/);
    const plan = get();
    // 존재하는 파일 단계는 완료 유지, 없는 파일 단계는 pending 으로 강등
    assert.equal(plan[0].status, "completed");
    assert.equal(plan[1].status, "pending");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("update_plan 게이트: 파일 언급 없는 단계는 그대로 완료 유지", async () => {
  const root = tmpRoot();
  try {
    const { c, get } = planCtx(root);
    await updatePlanTool.run(
      { steps: [{ content: "산출물 간 정합성을 점검한다", status: "completed" }] },
      c,
    );
    assert.equal(get()[0].status, "completed");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
