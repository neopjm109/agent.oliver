import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, mkdirSync, existsSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, resolve as pathResolve, relative as pathRelative } from "node:path";
import { writeFileTool, changeDirTool, readFileTool } from "../src/tools/fs.js";
import { bashTool, isInstallCommand, findSandboxEscape } from "../src/tools/bash.js";

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

test("read_file: 대시↔언더스코어 오염 파일명을 근접 매칭으로 자동 복구한다", async () => {
  const dir = mkdtempSync(resolve(tmpdir(), "fs-"));
  try {
    mkdirSync(resolve(dir, "prd"), { recursive: true });
    writeFileSync(resolve(dir, "prd/3-data-analysis.md"), "REAL-CONTENT", "utf8");
    // 모델이 대시를 언더스코어로 바꿔 부른 경우 (gemma-4-e2b 실측 실패 재현)
    const out = (await readFileTool.run({ path: "prd/3-data_analysis.md" }, ctx(dir))) as string;
    assert.match(out, /REAL-CONTENT/, "근접 매칭으로 실제 파일을 읽어야 함");
    assert.match(out, /3-data-analysis\.md/, "복구한 실제 경로를 안내해야 함");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("read_file: 근접 매칭도 없으면 못 찾았다고 알린다", async () => {
  const dir = mkdtempSync(resolve(tmpdir(), "fs-"));
  try {
    const out = (await readFileTool.run({ path: "없는파일.md" }, ctx(dir))) as string;
    assert.match(out, /찾을 수 없|없습니다/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("read_file: 토픽 폴더 안에서 폴더명 중복 접두를 벗겨 모호검색·루프를 피한다", async () => {
  const dir = mkdtempSync(resolve(tmpdir(), "fs-"));
  try {
    // 같은 이름 파일이 두 곳에(prd/ 입력 + 토픽 폴더 산출물) 있어, 접두를 안 벗기면
    // 자동 복구가 둘 다 찾아 모호해지고 모델이 read_file 을 반복하게 된다(실측 루프 재현).
    mkdirSync(resolve(dir, "prd"), { recursive: true });
    writeFileSync(resolve(dir, "prd/clicks.csv"), "INPUT", "utf8");
    mkdirSync(resolve(dir, "02-data-analysis"), { recursive: true });
    writeFileSync(resolve(dir, "02-data-analysis/clicks.csv"), "TOPIC-OUTPUT", "utf8");
    const c = ctx(dir);
    c.setWorkdir("02-data-analysis");
    // 모델이 cwd 안에서 폴더명을 또 붙임 → 접두 제거로 토픽 폴더의 파일을 곧장 읽어야 함
    const out = (await readFileTool.run({ path: "02-data-analysis/clicks.csv" }, c)) as string;
    assert.match(out, /TOPIC-OUTPUT/, "모호검색 없이 현재 폴더 파일을 직접 읽어야 함");
    assert.doesNotMatch(out, /여러 개 있습니다/, "모호검색 안내가 나오면 안 됨");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("write_file: 토픽 폴더 안에서 폴더명을 중복 접두하면 이중 중첩을 막는다", async () => {
  const dir = mkdtempSync(resolve(tmpdir(), "fs-"));
  try {
    mkdirSync(resolve(dir, "01-blueprint"), { recursive: true });
    const c = ctx(dir);
    c.setWorkdir("01-blueprint");
    // 소형 모델이 현재 폴더명을 경로에 또 붙이는 실수 → '01-blueprint/01-blueprint/' 이중 중첩 방지
    await writeFileTool.run({ path: "01-blueprint/architecture.md", content: "x" }, c);
    assert.ok(existsSync(resolve(dir, "01-blueprint/architecture.md")), "한 단계에 저장돼야 함");
    assert.ok(!existsSync(resolve(dir, "01-blueprint/01-blueprint")), "이중 중첩 폴더가 없어야 함");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("write_file: 일반 하위폴더·비토픽 폴더는 접두를 벗기지 않는다(좁은 조건)", async () => {
  const dir = mkdtempSync(resolve(tmpdir(), "fs-"));
  try {
    // (1) 토픽 폴더 안이라도 다른 이름의 하위폴더는 그대로 둔다
    mkdirSync(resolve(dir, "01-blueprint"), { recursive: true });
    const c1 = ctx(dir);
    c1.setWorkdir("01-blueprint");
    await writeFileTool.run({ path: "dto/create.dto.ts", content: "x" }, c1);
    assert.ok(existsSync(resolve(dir, "01-blueprint/dto/create.dto.ts")), "다른 하위폴더는 유지");

    // (2) 토픽 폴더가 아닌 곳(예: 'myapp')에서는 같은 이름 접두도 벗기지 않는다
    mkdirSync(resolve(dir, "myapp"), { recursive: true });
    const c2 = ctx(dir);
    c2.setWorkdir("myapp");
    await writeFileTool.run({ path: "myapp/index.ts", content: "y" }, c2);
    assert.ok(existsSync(resolve(dir, "myapp/myapp/index.ts")), "비토픽 폴더는 접두 유지");
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

test("run_shell: 스캐폴딩이 만든 단일 프로젝트 폴더로 자동 이동한다", async () => {
  const dir = mkdtempSync(resolve(tmpdir(), "fs-"));
  try {
    const c = ctx(dir);
    // create-next-app 이 프로젝트 하위 폴더를 만드는 상황을 셸로 흉내낸다.
    const res = await bashTool.run(
      { command: "mkdir -p myapp && echo '{}' > myapp/package.json" },
      c,
    );
    assert.match(res, /자동 이동/); // 안내 문구
    assert.equal(c.workdir, "myapp"); // 지속 반영
    // 모델이 change_dir 를 안 불러도 이후 write_file 은 프로젝트 안에 쓰인다.
    await writeFileTool.run({ path: "src/types.ts", content: "x" }, c);
    assert.equal(readFileSync(resolve(dir, "myapp/src/types.ts"), "utf8"), "x");
    assert.ok(!existsSync(resolve(dir, "src/types.ts"))); // 루트엔 흩어지지 않음
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("run_shell: 프로젝트 마커 없는 폴더는 자동 이동하지 않는다", async () => {
  const dir = mkdtempSync(resolve(tmpdir(), "fs-"));
  try {
    const c = ctx(dir);
    const res = await bashTool.run({ command: "mkdir -p data" }, c);
    assert.doesNotMatch(res, /자동 이동/);
    assert.equal(c.workdir, ""); // 루트 유지
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("run_shell: 폴더 여러 개가 새로 생기면 모호하므로 자동 이동하지 않는다", async () => {
  const dir = mkdtempSync(resolve(tmpdir(), "fs-"));
  try {
    const c = ctx(dir);
    const res = await bashTool.run(
      { command: "mkdir -p a b && echo '{}' > a/package.json" },
      c,
    );
    assert.doesNotMatch(res, /자동 이동/);
    assert.equal(c.workdir, "");
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

test("isInstallCommand: 설치 계열만 인식(스캐폴딩/실행 명령 제외)", () => {
  assert.ok(isInstallCommand("npm install"));
  assert.ok(isInstallCommand("npm i class-validator"));
  assert.ok(isInstallCommand("npm ci"));
  assert.ok(isInstallCommand("pnpm add react"));
  assert.ok(isInstallCommand("bun install"));
  assert.ok(isInstallCommand("yarn")); // bare yarn = 의존성 설치
  assert.ok(isInstallCommand("yarn add lodash"));
  assert.ok(isInstallCommand("cd app && npm install")); // 구분자 뒤
  assert.ok(!isInstallCommand("npm run build"));
  assert.ok(!isInstallCommand("npm test"));
  assert.ok(!isInstallCommand("yarn build"));
  assert.ok(!isInstallCommand("npx create-next-app myapp"));
  assert.ok(!isInstallCommand("echo installing deps"));
});

test("run_shell: 설치 명령인데 package.json 이 없으면 작업 폴더에 시딩한다", async () => {
  const dir = mkdtempSync(resolve(tmpdir(), "fs-"));
  try {
    const c = ctx(dir);
    assert.ok(!existsSync(resolve(dir, "package.json")));
    const res = await bashTool.run({ command: "npm install --help" }, c);
    assert.ok(existsSync(resolve(dir, "package.json")), "package.json 이 시딩돼야 함");
    assert.match(res as string, /package\.json/); // 시딩 안내 문구
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("run_shell: 이미 package.json 이 있으면 시딩하지 않고 덮어쓰지 않는다", async () => {
  const dir = mkdtempSync(resolve(tmpdir(), "fs-"));
  try {
    writeFileSync(resolve(dir, "package.json"), '{"name":"mine"}');
    const c = ctx(dir);
    await bashTool.run({ command: "npm install --help" }, c);
    assert.equal(readFileSync(resolve(dir, "package.json"), "utf8"), '{"name":"mine"}', "기존 파일 보존");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("run_shell: 비설치 명령은 package.json 을 만들지 않는다", async () => {
  const dir = mkdtempSync(resolve(tmpdir(), "fs-"));
  try {
    const c = ctx(dir);
    await bashTool.run({ command: "echo hi" }, c);
    assert.ok(!existsSync(resolve(dir, "package.json")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findSandboxEscape: 밖으로 나가는 경로/절대경로/‘cd ..’를 차단하고 내부는 허용", () => {
  const root = "/ws";
  // 허용 (내부·상대경로·따옴표 안 경로)
  assert.equal(findSandboxEscape("echo hi", "/ws", root), null);
  assert.equal(findSandboxEscape("mkdir -p src/app", "/ws", root), null);
  assert.equal(findSandboxEscape("cat ./package.json", "/ws", root), null);
  assert.equal(findSandboxEscape("npm install class-validator", "/ws", root), null);
  assert.equal(findSandboxEscape("echo '/etc/passwd is text'", "/ws", root), null); // 따옴표 안은 인자 아님
  // 하위 폴더에서 'cd ..' 는 워크스페이스 루트로 가는 것이라 허용
  assert.equal(findSandboxEscape("cd .. && ls", "/ws/01-topic", root), null);
  // cd 이동을 반영: sub 로 들어간 뒤의 ../x 는 워크스페이스 안
  assert.equal(findSandboxEscape("cd sub && cat ../file", "/ws/01-t", root), null);
  // 차단
  assert.ok(findSandboxEscape("cd .. && cat .env", "/ws", root)); // 루트에서 .. → 밖
  assert.ok(findSandboxEscape("cat /etc/passwd", "/ws", root)); // 절대경로
  assert.ok(findSandboxEscape("cp x ../../repo/.env", "/ws/01-t", root)); // ../.. 탈출
  assert.ok(findSandboxEscape("npm i --prefix=/tmp/x foo", "/ws", root)); // = 뒤 절대경로
  assert.ok(findSandboxEscape("find / -name secret", "/ws", root)); // 루트 스캔
});

test("run_shell: 샌드박스 밖 경로 명령은 실행 전에 거부한다(denied)", async () => {
  const dir = mkdtempSync(resolve(tmpdir(), "fs-"));
  try {
    const c = ctx(dir);
    const res = await bashTool.run({ command: "cat /etc/hostname" }, c);
    const r = typeof res === "string" ? { content: res, denied: false } : res;
    assert.ok(r.denied, "밖 경로 명령은 denied 여야 함");
    assert.match(r.content, /작업 공간 밖/);
    // 실제로 실행되지 않았어야 함(파일 생성 등 부작용 없음) — 여기선 거부 문구만 확인
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
