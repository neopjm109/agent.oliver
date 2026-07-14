import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, resolve as pathResolve, relative as pathRelative } from "node:path";
import { writeFileTool, changeDirTool } from "../src/tools/fs.js";
import { bashTool } from "../src/tools/bash.js";

/** writeFileTool 실행용 최소 ToolContext. workdir 를 지원해 change_dir 도 검증한다. */
function ctx(root: string) {
  const state = { workdir: "" };
  const c: any = {
    root,
    get cwd() {
      return pathResolve(root, state.workdir);
    },
    get workdir() {
      return state.workdir;
    },
    setWorkdir(sub: string) {
      const target = pathResolve(root, state.workdir, sub);
      const rel = pathRelative(root, target);
      if (rel.startsWith("..")) throw new Error("밖");
      if (rel && (!existsSync(target) || !statSync(target).isDirectory())) throw new Error(`폴더 없음: ${rel}`);
      state.workdir = rel;
      return rel || ".";
    },
    skills: {} as any,
    requestPermission: async () => true,
    log: () => {},
    depth: 0,
    spawnAgent: async () => "",
    setPlan: () => {},
    getPlan: () => [],
  };
  return c;
}

test("write_file: 기본은 덮어쓰기, mode='append' 는 이어쓰기", async () => {
  const dir = mkdtempSync(resolve(tmpdir(), "fs-"));
  try {
    await writeFileTool.run({ path: "doc.md", content: "part1\n" }, ctx(dir));
    await writeFileTool.run({ path: "doc.md", content: "part2\n", mode: "append" }, ctx(dir));
    await writeFileTool.run({ path: "doc.md", content: "part3\n", mode: "append" }, ctx(dir));
    assert.equal(readFileSync(resolve(dir, "doc.md"), "utf8"), "part1\npart2\npart3\n");

    // mode 없음(기본 overwrite)은 전체를 덮어쓴다
    await writeFileTool.run({ path: "doc.md", content: "fresh" }, ctx(dir));
    assert.equal(readFileSync(resolve(dir, "doc.md"), "utf8"), "fresh");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("write_file: append 는 없던 파일도 생성한다", async () => {
  const dir = mkdtempSync(resolve(tmpdir(), "fs-"));
  try {
    const res = await writeFileTool.run({ path: "new.md", content: "hi", mode: "append" }, ctx(dir));
    assert.match(res, /이어썼습니다/);
    assert.equal(readFileSync(resolve(dir, "new.md"), "utf8"), "hi");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("run_shell: 단독 'cd <dir>' 는 지속되는 작업 폴더 변경으로 가로챈다", async () => {
  const dir = mkdtempSync(resolve(tmpdir(), "fs-"));
  try {
    const c = ctx(dir);
    mkdirSync(resolve(dir, "proj"), { recursive: true });
    const res = await bashTool.run({ command: "cd proj" }, c);
    assert.match(res, /작업 폴더를 'proj'/);
    assert.equal(c.workdir, "proj"); // 지속 반영
    // 이후 write_file 은 proj 안에
    await writeFileTool.run({ path: "a.ts", content: "x" }, c);
    assert.equal(readFileSync(resolve(dir, "proj/a.ts"), "utf8"), "x");
    // 없는 폴더 cd 는 실패 메시지, workdir 유지
    const bad = await bashTool.run({ command: "cd nope" }, c);
    assert.match(bad, /변경 실패/);
    assert.equal(c.workdir, "proj");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("run_shell: 복합 'cd X && ...' 는 가로채지 않고 그대로 실행한다", async () => {
  const dir = mkdtempSync(resolve(tmpdir(), "fs-"));
  try {
    const c = ctx(dir);
    mkdirSync(resolve(dir, "proj"), { recursive: true });
    const res = await bashTool.run({ command: "cd proj && echo hi" }, c);
    assert.match(res, /hi/); // 셸이 실제 실행
    assert.equal(c.workdir, ""); // 복합 명령은 workdir 를 바꾸지 않음
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("change_dir: 이동 후 write_file 이 하위 폴더에 쓰이고, 루트 밖은 거부", async () => {
  const dir = mkdtempSync(resolve(tmpdir(), "fs-"));
  try {
    const c = ctx(dir);
    mkdirSync(resolve(dir, "proj"), { recursive: true });
    // proj 로 이동 → 이후 상대경로 쓰기는 proj 안에
    const cd = await changeDirTool.run({ path: "proj" }, c);
    assert.match(cd, /작업 폴더를 'proj'/);
    await writeFileTool.run({ path: "index.ts", content: "x" }, c);
    assert.equal(readFileSync(resolve(dir, "proj/index.ts"), "utf8"), "x");
    // 하위에서 루트 밖으로 나가려 하면 거부
    const bad = await changeDirTool.run({ path: "../../escape" }, c);
    assert.match(bad, /변경 실패/);
    // 없는 폴더도 거부
    const missing = await changeDirTool.run({ path: "nope" }, c);
    assert.match(missing, /변경 실패/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
