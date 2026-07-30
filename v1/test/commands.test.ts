import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { SkillRegistry } from "../src/skills.js";
import { SessionStore } from "../src/session.js";
import { interpret, type CommandCtx } from "../src/commands.js";

const here = dirname(fileURLToPath(import.meta.url));
const SKILLS = resolve(here, "fixtures/catrep"); // alpha(카테고리 대표), alpha-leaf, solo
const SOULS = resolve(here, "fixtures/souls"); // tester.md

function makeCtx(): { ctx: CommandCtx; cleanup: () => void } {
  const dir = mkdtempSync(resolve(tmpdir(), "cmd-test-"));
  const store = new SessionStore(dir);
  const skills = SkillRegistry.load(SKILLS);
  return {
    ctx: { skills, store, session: "s1", soulsDir: SOULS },
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

test("일반 텍스트는 message 로 통과", () => {
  const { ctx, cleanup } = makeCtx();
  const r = interpret("안녕하세요", ctx);
  assert.equal(r.type, "message");
  assert.equal(r.type === "message" && r.text, "안녕하세요");
  cleanup();
});

test("/help → 도움말 텍스트", () => {
  const { ctx, cleanup } = makeCtx();
  const r = interpret("/help", ctx);
  assert.equal(r.type, "reply");
  assert.ok(r.type === "reply" && r.text.includes("사용 가능한 명령어"));
  // /start 도 도움말로 취급
  assert.equal(interpret("/start", ctx).type, "reply");
  cleanup();
});

test("/skills → 카테고리 대표 스킬 목록", () => {
  const { ctx, cleanup } = makeCtx();
  const r = interpret("/skills", ctx);
  assert.ok(r.type === "reply" && r.text.includes("/alpha"));
  assert.ok(r.type === "reply" && !r.text.includes("/solo")); // 대표 아님
  cleanup();
});

test("/<스킬> → skill 로 라우팅 (인자 분리)", () => {
  const { ctx, cleanup } = makeCtx();
  const r = interpret("/alpha 이거 해줘", ctx);
  assert.equal(r.type, "skill");
  assert.equal(r.type === "skill" && r.skill.name, "alpha");
  assert.equal(r.type === "skill" && r.text, "이거 해줘");
  cleanup();
});

test("allowLeafSkill=false: 리프 스킬 직접 호출 차단, 카테고리는 허용", () => {
  const { ctx, cleanup } = makeCtx();
  ctx.allowLeafSkill = false;
  // 리프(alpha-leaf) 직접 호출 → error
  const leaf = interpret("/alpha-leaf 해줘", ctx);
  assert.equal(leaf.type, "error");
  assert.ok(leaf.type === "error" && leaf.text.includes("리프 스킬"));
  // 카테고리 진입점(alpha)은 그대로 허용
  const cat = interpret("/alpha 해줘", ctx);
  assert.equal(cat.type, "skill");
  cleanup();
});

test("allowLeafSkill 미설정/true: 리프 스킬 직접 호출 허용", () => {
  const { ctx, cleanup } = makeCtx();
  // 미설정(undefined) → 허용 (서버/봇 경로)
  assert.equal(interpret("/alpha-leaf", ctx).type, "skill");
  // 명시적 true → 허용
  ctx.allowLeafSkill = true;
  assert.equal(interpret("/alpha-leaf", ctx).type, "skill");
  cleanup();
});

test("알 수 없는 명령/스킬 → error + 추천", () => {
  const { ctx, cleanup } = makeCtx();
  const r = interpret("/alph", ctx); // 부분 일치 오타
  assert.equal(r.type, "error");
  assert.ok(r.type === "error" && r.text.includes("/alpha")); // suggest 로 추천
  // 전혀 안 맞는 이름도 error (추천은 없을 수 있음)
  assert.equal(interpret("/zzzzz", ctx).type, "error");
  cleanup();
});

test("/soul 목록·변경·해제 (세션에 영속)", () => {
  const { ctx, cleanup } = makeCtx();
  // 목록
  const list = interpret("/soul", ctx);
  assert.ok(list.type === "reply" && list.text.includes("tester"));
  // 변경
  const set = interpret("/soul tester", ctx);
  assert.equal(set.type, "reply");
  assert.deepEqual(set.type === "reply" && set.effect, { kind: "persona", persona: "tester" });
  assert.equal(ctx.store.loadPersona("s1"), "tester");
  // 없는 페르소나
  const bad = interpret("/soul ghost", ctx);
  assert.equal(bad.type, "error");
  // 해제
  const off = interpret("/soul off", ctx);
  assert.deepEqual(off.type === "reply" && off.effect, { kind: "persona", persona: null });
  assert.equal(ctx.store.loadPersona("s1"), null);
  cleanup();
});

test("/reset → 대화만 초기화, 페르소나는 유지 + reset 효과", () => {
  const { ctx, cleanup } = makeCtx();
  ctx.store.savePersona("s1", "tester");
  ctx.store.save("s1", [{ role: "user", content: "hi" } as any]);
  const r = interpret("/reset", ctx);
  assert.deepEqual(r.type === "reply" && r.effect, { kind: "reset" });
  assert.equal(ctx.store.load("s1").length, 0); // 대화 비워짐
  assert.equal(ctx.store.loadPersona("s1"), "tester"); // 페르소나는 유지
  cleanup();
});

test("/sessions → 저장된 세션 목록 (현재 세션 표시)", () => {
  const { ctx, cleanup } = makeCtx();
  ctx.store.save("s1", [{ role: "user", content: "a" } as any]);
  ctx.store.save("other", [{ role: "user", content: "b" } as any, { role: "assistant", content: "c" } as any]);
  const r = interpret("/sessions", ctx);
  assert.ok(r.type === "reply" && r.text.includes("s1"));
  assert.ok(r.type === "reply" && r.text.includes("other"));
  assert.ok(r.type === "reply" && r.text.includes("▸ s1")); // 현재 세션 마커
  cleanup();
});

test("/history → 최근 대화 표시, 프레임워크 주입·도구 메시지는 제외", () => {
  const { ctx, cleanup } = makeCtx();
  ctx.store.save("s1", [
    { role: "user", content: "안녕" },
    { role: "assistant", content: "반가워요" },
    { role: "user", content: "이 요청에 맞는 스킬을 로드했습니다.\n----- SKILL 지침 시작 -----\n..." }, // 주입 → 제외
    { role: "assistant", content: null, tool_calls: [{ id: "c", type: "function", function: { name: "write_file", arguments: "{}" } }] }, // 도구호출 → 제외
    { role: "tool", tool_call_id: "c", content: "저장됨" }, // tool → 제외
    { role: "user", content: "고마워" },
    { role: "assistant", content: "천만에요" },
  ] as any);
  const r = interpret("/history", ctx);
  assert.ok(r.type === "reply");
  assert.match(r.text, /안녕/);
  assert.match(r.text, /천만에요/);
  assert.doesNotMatch(r.text, /SKILL 지침 시작/); // 주입 메시지 제외
  assert.doesNotMatch(r.text, /저장됨/); // tool 결과 제외

  // n 지정
  const r2 = interpret("/history 1", ctx);
  assert.ok(r2.type === "reply" && r2.text.includes("최근 대화 1개"));
  assert.match((r2 as any).text, /천만에요/);
  cleanup();
});

test("/session (인자 없음) → 현재 세션 정보", () => {
  const { ctx, cleanup } = makeCtx();
  ctx.store.save("s1", [{ role: "user", content: "a" } as any]);
  const r = interpret("/session", ctx);
  assert.ok(r.type === "reply" && r.text.includes("현재 세션: s1"));
  cleanup();
});

test("/session <id> → 전환 effect (없는 ID는 새 세션)", () => {
  const { ctx, cleanup } = makeCtx();
  ctx.store.save("work", [{ role: "user", content: "a" } as any]);
  // 기존 세션 전환
  const sw = interpret("/session work", ctx);
  assert.deepEqual(sw.type === "reply" && sw.effect, { kind: "session", session: "work" });
  assert.ok(sw.type === "reply" && sw.text.includes("복원"));
  // 없는 세션 → 새로 시작
  const fresh = interpret("/session brandnew", ctx);
  assert.deepEqual(fresh.type === "reply" && fresh.effect, { kind: "session", session: "brandnew" });
  assert.ok(fresh.type === "reply" && fresh.text.includes("새 세션"));
  // 현재 세션과 동일 → 전환 없음
  const same = interpret("/session s1", ctx);
  assert.equal(same.type === "reply" && same.effect, undefined);
  cleanup();
});

test("/session new <id> → 빈 세션 생성 + 전환 effect, 중복이면 error", () => {
  const { ctx, cleanup } = makeCtx();
  const r = interpret("/session new proj", ctx);
  assert.deepEqual(r.type === "reply" && r.effect, { kind: "session", session: "proj" });
  assert.equal(ctx.store.exists("proj"), true); // 파일이 즉시 생성됨
  // 이미 있는 이름 → error
  const dup = interpret("/session new proj", ctx);
  assert.equal(dup.type, "error");
  cleanup();
});

test("/session new (id 없음) → 자동 타임스탬프 ID 생성", () => {
  const { ctx, cleanup } = makeCtx();
  const r1 = interpret("/session new", ctx);
  const eff1 = r1.type === "reply" ? r1.effect : undefined;
  assert.ok(eff1 && eff1.kind === "session", "session 전환 효과가 있어야 함");
  assert.match(
    eff1.session,
    /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(-\d+)?$/,
    "YYYY-MM-DD_HH-MM-SS 타임스탬프 형식이어야 함",
  );
  // 같은 초에 또 만들어도 유일한(겹치지 않는) ID 여야 함
  const r2 = interpret("/session new", ctx);
  const eff2 = r2.type === "reply" ? r2.effect : undefined;
  assert.ok(eff2 && eff2.kind === "session");
  assert.notEqual(eff2.session, eff1.session, "연속 생성 시 ID 가 겹치면 안 됨");
  cleanup();
});

test("/session delete <id> → 삭제, 현재 세션이면 reset 효과", () => {
  const { ctx, cleanup } = makeCtx();
  ctx.store.save("victim", [{ role: "user", content: "a" } as any]);
  ctx.store.save("s1", [{ role: "user", content: "b" } as any]);
  // 다른 세션 삭제
  const del = interpret("/session delete victim", ctx);
  assert.equal(del.type, "reply");
  assert.equal(del.type === "reply" && del.effect, undefined);
  assert.equal(ctx.store.exists("victim"), false);
  // 없는 세션 삭제 → error
  assert.equal(interpret("/session delete ghost", ctx).type, "error");
  // 현재 세션 삭제 → reset 효과
  const delCur = interpret("/session delete s1", ctx);
  assert.deepEqual(delCur.type === "reply" && delCur.effect, { kind: "reset" });
  assert.equal(ctx.store.exists("s1"), false);
  cleanup();
});
