import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readdirSync, statSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import type { Tool, ToolContext } from "./types.js";

const execAsync = promisify(exec);

/**
 * npm/pnpm/yarn/bun 의 '설치' 계열 명령인지 판별한다(명령 시작 또는 구분자 `;&|` 뒤).
 * install·i·ci·add 및 서브커맨드 없는 bare `yarn`(=의존성 설치)을 잡는다.
 * create-*·init 등 스캐폴딩/생성 명령은 대상이 아니다(그건 하위 폴더를 직접 만든다).
 */
export function isInstallCommand(cmd: string): boolean {
  if (/(?:^|[;&|]\s*)(?:npm|pnpm|bun)\s+(?:install|i|ci|add)(?=\s|$|[;&|])/.test(cmd)) return true;
  if (/(?:^|[;&|]\s*)yarn\s+(?:add|install|i|ci)(?=\s|$|[;&|])/.test(cmd)) return true;
  if (/(?:^|[;&|]\s*)yarn\s*(?:$|[;&|])/.test(cmd)) return true; // bare yarn
  return false;
}

/** cwd 에서 샌드박스 root 까지(포함) 올라가며 package.json 이 하나라도 있으면 true. */
function hasPackageJsonWithin(cwd: string, root: string): boolean {
  let dir = cwd;
  for (;;) {
    if (existsSync(resolve(dir, "package.json"))) return true;
    if (dir === root) return false; // 샌드박스 경계까지만 탐색(위로 안 나감)
    const parent = dirname(dir);
    if (parent === dir) return false; // 파일시스템 루트 안전장치
    dir = parent;
  }
}

/**
 * npm 류 '설치' 명령이 워크스페이스 안에 package.json 이 없을 때, npm 이 상위 폴더(레포 루트 등)로
 * 거슬러 올라가 거기에 설치·오염시키는 것을 막는다. 현재 폴더에 최소 package.json 을 심어 설치를 여기 묶는다.
 * 반환: 시딩했으면 안내 문구(안 했으면 빈 문자열).
 */
function ensureInstallAnchor(ctx: ToolContext, command: string): string {
  if (!isInstallCommand(command) || hasPackageJsonWithin(ctx.cwd, ctx.root)) return "";
  try {
    writeFileSync(
      resolve(ctx.cwd, "package.json"),
      '{\n  "name": "agent-workspace",\n  "private": true\n}\n',
      "utf8",
    );
    ctx.log("  ↳ (샌드박스 보호) 작업 폴더에 package.json 생성 — 설치를 워크스페이스 안에 고정");
    return "\n\n(작업 폴더에 package.json 이 없어 최소 package.json 을 생성했습니다 — 설치가 워크스페이스 밖으로 새지 않도록.)";
  } catch {
    return ""; // 시딩 실패해도 명령은 그대로 진행
  }
}

/** 프로젝트 루트임을 알려주는 마커 파일들 (스캐폴딩/클론 결과 판별용). */
const PROJECT_MARKERS = [
  "package.json",
  "Cargo.toml",
  "go.mod",
  "pyproject.toml",
  "requirements.txt",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "Gemfile",
  "composer.json",
  ".git",
];

/** dir 의 하위 폴더 이름 집합을 반환 (읽기 실패 시 빈 집합). */
function subdirs(dir: string): Set<string> {
  try {
    return new Set(
      readdirSync(dir).filter((name) => {
        try {
          return statSync(resolve(dir, name)).isDirectory();
        } catch {
          return false;
        }
      }),
    );
  } catch {
    return new Set();
  }
}

/** 해당 폴더가 프로젝트 마커를 하나라도 가지고 있으면 true. */
function looksLikeProject(dir: string): boolean {
  return PROJECT_MARKERS.some((m) => existsSync(resolve(dir, m)));
}

/**
 * 스캐폴딩/클론 명령이 cwd 아래에 '단일 프로젝트 하위 폴더'를 새로 만들었으면
 * 그 폴더로 작업 폴더를 자동 이동시킨다(모델이 change_dir 를 안 불러도 프레임워크가 보장).
 * create-next-app·git clone·cargo new 등 명령 종류에 무관하게, 프로젝트 마커 유무로 판별한다.
 * 반환: 이동 안내 문구(이동 안 했으면 빈 문자열).
 */
function autoEnterScaffold(ctx: ToolContext, before: Set<string>): string {
  const after = subdirs(ctx.cwd);
  const created = [...after].filter((name) => !before.has(name));
  // 새로 생긴 폴더가 정확히 하나이고, 그게 프로젝트일 때만 자동 이동(모호하면 건드리지 않음).
  if (created.length !== 1) return "";
  const name = created[0];
  if (!looksLikeProject(resolve(ctx.cwd, name))) return "";
  try {
    const wd = ctx.setWorkdir(name);
    return (
      `\n\n(작업 폴더를 새로 생성된 프로젝트 '${wd}' 로 자동 이동했습니다. ` +
      `이후 write_file·read_file·run_shell 은 이 폴더 기준으로 동작합니다.)`
    );
  } catch {
    return ""; // 이동 실패(경계 밖 등)면 조용히 무시
  }
}

/** 명령을 세그먼트(;, &&, ||, | 로 분리)로 쪼갠다. */
function splitSegments(cmd: string): string[] {
  return cmd.split(/(?:&&|\|\||[;&|])/);
}

/** 따옴표로 감싼 문자열 리터럴을 제거해, 그 안의 경로가 인자 경로로 오인되지 않게 한다. */
function stripQuotes(s: string): string {
  return s.replace(/"[^"]*"/g, " ").replace(/'[^']*'/g, " ");
}

/** 세그먼트에서 '경로처럼 보이는' 토큰만 뽑는다(슬래시 포함 또는 `..`). `--prefix=/x` 처럼 = 뒤 값도 검사. */
function pathTokens(seg: string): string[] {
  const out: string[] = [];
  for (const raw of stripQuotes(seg).split(/\s+/)) {
    if (!raw) continue;
    const val = raw.includes("=") ? raw.slice(raw.indexOf("=") + 1) : raw; // --prefix=/abs → /abs
    if (!val) continue;
    if (val === ".." || val.startsWith("/") || val.startsWith("../") || val.includes("/..") || val.includes("/")) {
      out.push(val);
    }
  }
  return out;
}

/**
 * 셸 명령이 샌드박스(root) 밖 경로를 건드리는지 정적 검사한다. 벗어나면 사유 문자열, 아니면 null.
 * cd 로 인한 작업 폴더 이동을 세그먼트 순서대로 반영해 상대경로를 정확히 판정한다
 * (예: `cd sub && cat ../x` 는 sub 기준으로 판정).
 * ⚠️ 휴리스틱 방어다 — 명령 치환 `$(...)`·변수 확장·eval 은 정적으로 못 잡는다. 완전한 격리는 OS 샌드박스가 필요하며,
 * 이 검사는 소형 모델의 흔한 실수(`cd ..`·절대경로·`../../.env`)로 인한 워크스페이스 이탈을 막는 방어선이다.
 */
export function findSandboxEscape(command: string, cwd: string, root: string): string | null {
  let vcwd = cwd;
  for (const seg of splitSegments(command)) {
    for (const tok of pathTokens(seg)) {
      if (relative(root, resolve(vcwd, tok)).startsWith("..")) {
        return `작업 공간(${root}) 밖을 가리키는 경로: '${tok}'`;
      }
    }
    const cd = seg.match(/^\s*cd\s+(\S+)/);
    if (cd) vcwd = resolve(vcwd, cd[1].replace(/^["']|["']$/g, "")); // 다음 세그먼트 기준 폴더 갱신
  }
  return null;
}

export const bashTool: Tool = {
  name: "run_shell",
  description:
    "셸 명령을 실행하고 stdout/stderr 를 반환한다. 파일 검색(grep, find), 스캐폴딩, 설치, 빌드, 테스트 실행 등에 사용. " +
    "명령은 스스로 종료돼야 한다(기본 타임아웃 60초). 대화형 프롬프트가 뜨는 명령은 무인 플래그를 붙이고" +
    "(예: create-next-app '--yes', 설치 '-y'), 'npm run dev'·'npm start'·'--watch' 같은 끝나지 않는 서버/감시 명령은 실행하지 말 것(타임아웃으로 실패). " +
    "'cd' 는 이 명령 안에서만 유효하고 다음 호출엔 안 남는다. " +
    "스캐폴딩·클론이 프로젝트 하위 폴더(예: create-next-app 의 'myapp')를 새로 만들면 자동으로 그 폴더로 작업 폴더가 이동한다 — " +
    "그 외에 다른 하위 폴더로 옮겨 작업하려면 change_dir 도구를 쓸 것. " +
    "작업 공간(워크스페이스) 밖을 가리키는 절대경로나 상위(..) 경로를 쓰는 명령은 거부된다 — 모든 경로는 작업 폴더 기준 상대경로로.",
  dangerous: true,
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "실행할 셸 명령" },
      timeout_ms: {
        type: "number",
        description: "타임아웃(밀리초, 기본 60000)",
      },
    },
    required: ["command"],
  },
  async run(args, ctx) {
    const command = String(args.command);
    // 모델이 흔히 쓰는 단독 'cd <dir>' 는 셸에서 실행해도 다음 호출에 유지되지 않는다.
    // 이를 가로채 지속되는 작업 폴더 변경(change_dir 와 동일)으로 처리한다.
    // (복합 명령 'cd X && ...' 은 그 명령 안에서 cd 가 유효하므로 그대로 실행)
    const cd = command.match(/^\s*cd\s+(.+?)\s*$/);
    if (cd && !/[;&|]/.test(command)) {
      const target = cd[1].replace(/^["']|["']$/g, "");
      try {
        const wd = ctx.setWorkdir(target);
        return `작업 폴더를 '${wd}' 로 변경했습니다(지속됨). 이후 명령·파일 작업은 이 폴더 기준입니다.`;
      } catch (e: any) {
        return `작업 폴더 변경 실패: ${e.message}`;
      }
    }
    // 샌드박스 밖(상위 '..'·절대경로)을 건드리는 명령은 승인을 묻기 전에 거부한다.
    const escape = findSandboxEscape(command, ctx.cwd, ctx.root);
    if (escape) {
      return { content: `이 명령은 작업 공간 밖을 벗어나 실행할 수 없습니다: ${escape}`, denied: true };
    }
    const timeout = Number(args.timeout_ms ?? 60000);
    const ok = await ctx.requestPermission("셸 실행", command);
    if (!ok) return { content: "사용자가 명령 실행을 거부했습니다.", denied: true };
    // npm 류 설치가 상위 폴더의 package.json 으로 새지 않도록, 필요하면 작업 폴더에 최소 package.json 을 심는다.
    const anchorNote = ensureInstallAnchor(ctx, command);
    // 스캐폴딩/클론이 만든 새 프로젝트 폴더로 자동 이동하기 위해 실행 전 하위 폴더 스냅샷.
    const before = subdirs(ctx.cwd);
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: ctx.cwd,
        timeout,
        maxBuffer: 10 * 1024 * 1024,
      });
      const out = [stdout, stderr].filter(Boolean).join("\n").trim();
      const entered = autoEnterScaffold(ctx, before);
      return (out || "(출력 없음, 정상 종료)") + entered + anchorNote;
    } catch (err: any) {
      const out = [err.stdout, err.stderr].filter(Boolean).join("\n").trim();
      return `명령 실패 (exit ${err.code ?? "?"}):\n${out || err.message}${anchorNote}`;
    }
  },
};
