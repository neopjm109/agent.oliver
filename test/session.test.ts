import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { SessionStore } from "../src/session.js";

function tmpStore() {
  const dir = mkdtempSync(resolve(tmpdir(), "sess-"));
  return { store: new SessionStore(dir), dir };
}

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
