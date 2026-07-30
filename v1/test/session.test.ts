import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { SessionStore, sanitizeSessionId, sessionWorkspace } from "../src/session.js";

function tmpStore() {
  const dir = mkdtempSync(resolve(tmpdir(), "sess-"));
  return { store: new SessionStore(dir), dir };
}

test("sanitizeSessionId: 경로 위험 문자를 _ 로 치환", () => {
  assert.equal(sanitizeSessionId("cli"), "cli");
  assert.equal(sanitizeSessionId("tg-123"), "tg-123");
  assert.equal(sanitizeSessionId("../etc/passwd"), ".._etc_passwd");
  assert.equal(sanitizeSessionId("a/b c"), "a_b_c");
});

test("sessionWorkspace: 루트 밑 세션 하위폴더 경로", () => {
  assert.equal(sessionWorkspace("/w", "cli"), resolve("/w", "cli"));
  // 경로 탈출 시도는 정규화되어 루트 안에 갇힌다
  const p = sessionWorkspace("/w", "../evil");
  assert.equal(p, resolve("/w", ".._evil"));
  assert.ok(p.startsWith(resolve("/w") + "/"));
});

test("save/load: 메시지 왕복", () => {
  const { store, dir } = tmpStore();
  try {
    assert.deepEqual(store.load("s1"), []); // 없는 세션은 빈 배열
    const msgs = [{ role: "user", content: "안녕" } as any];
    store.save("s1", msgs);
    assert.deepEqual(store.load("s1"), msgs);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("persona 는 save(messages) 후에도 보존된다", () => {
  const { store, dir } = tmpStore();
  try {
    store.savePersona("s1", "oliver");
    store.save("s1", [{ role: "user", content: "hi" } as any]);
    assert.equal(store.loadPersona("s1"), "oliver"); // save 가 persona 를 덮지 않음
    assert.equal(store.load("s1").length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("savePersona 는 기존 메시지를 보존한다", () => {
  const { store, dir } = tmpStore();
  try {
    store.save("s1", [{ role: "user", content: "hi" } as any]);
    store.savePersona("s1", "claire");
    assert.equal(store.load("s1").length, 1);
    assert.equal(store.loadPersona("s1"), "claire");
    store.savePersona("s1", null); // 해제
    assert.equal(store.loadPersona("s1"), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("summary 는 save/savePersona 후에도 보존된다", () => {
  const { store, dir } = tmpStore();
  try {
    assert.equal(store.loadSummary("s1"), ""); // 기본값
    store.saveSummary("s1", "요약 A");
    store.save("s1", [{ role: "user", content: "hi" } as any]);
    store.savePersona("s1", "oliver");
    assert.equal(store.loadSummary("s1"), "요약 A"); // 다른 저장이 summary 를 덮지 않음
    assert.equal(store.load("s1").length, 1);
    assert.equal(store.loadPersona("s1"), "oliver");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("saveWorkdir/loadWorkdir: 저장·페르소나·reset 후에도 작업 폴더가 보존된다", () => {
  const { store, dir } = tmpStore();
  try {
    store.save("s1", [{ role: "user", content: "a" } as any]);
    store.saveWorkdir("s1", "proj/sub");
    assert.equal(store.loadWorkdir("s1"), "proj/sub");
    // 다른 저장(대화·페르소나·요약)이 workdir 를 지우지 않는다
    store.save("s1", [{ role: "user", content: "b" } as any]);
    store.savePersona("s1", "oliver");
    store.saveSummary("s1", "요약");
    assert.equal(store.loadWorkdir("s1"), "proj/sub");
    // /reset 은 대화·요약만 비우고 workdir 은 유지
    store.resetConversation("s1");
    assert.equal(store.loadWorkdir("s1"), "proj/sub");
    assert.deepEqual(store.load("s1"), []);
    assert.equal(store.loadPersona("s1"), "oliver");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("clear 는 세션을 지운다", () => {
  const { store, dir } = tmpStore();
  try {
    store.save("s1", [{ role: "user", content: "hi" } as any]);
    store.clear("s1");
    assert.deepEqual(store.load("s1"), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("saveLast/loadLast: 마지막 활성 세션을 기억한다(세션 파일 있을 때만)", () => {
  const { store, dir } = tmpStore();
  try {
    assert.equal(store.loadLast(), null); // 아직 없음
    store.save("work-1", [{ role: "user", content: "hi" } as any]);
    store.saveLast("work-1");
    assert.equal(store.loadLast(), "work-1"); // 파일 있음 → 복원
    // 세션이 삭제되면(파일 없음) 마지막 기록이 있어도 무시
    store.clear("work-1");
    assert.equal(store.loadLast(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("saveLast 기록 파일은 세션 목록(list)에 섞이지 않는다", () => {
  const { store, dir } = tmpStore();
  try {
    store.save("s1", [{ role: "user", content: "x" } as any]);
    store.saveLast("s1");
    assert.deepEqual(
      store.list().map((s) => s.id),
      ["s1"],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("경로 주입 방지: 위험한 세션 ID 도 안전하게 처리", () => {
  const { store, dir } = tmpStore();
  try {
    store.save("../evil", [{ role: "user", content: "x" } as any]);
    // 파일이 dir 밖으로 새지 않고, 같은 정규화 ID 로 되읽힌다
    assert.equal(store.load("../evil").length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
