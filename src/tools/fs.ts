import { readFileSync, writeFileSync, appendFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import type { Tool } from "./types.js";

/**
 * 경로를 현재 작업 디렉터리(cwd) 기준으로 풀되, 샌드박스 루트(root) 밖으로 벗어나면 막는다.
 * cwd 가 root 하위 폴더여도 root 안(예: 상위 폴더의 파일)에는 접근 가능하다.
 */
function safeResolve(cwd: string, root: string, p: string): string {
  const abs = resolve(cwd, p);
  if (relative(root, abs).startsWith("..")) {
    throw new Error(`작업 공간(${root}) 밖 경로는 접근할 수 없습니다: ${p}`);
  }
  return abs;
}

export const readFileTool: Tool = {
  name: "read_file",
  description: "파일의 내용을 읽어 반환한다. 경로는 작업 디렉터리 기준 상대경로.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "읽을 파일 경로" },
    },
    required: ["path"],
  },
  async run(args, ctx) {
    const abs = safeResolve(ctx.cwd, ctx.root, String(args.path));
    const content = readFileSync(abs, "utf8");
    const lines = content.split("\n");
    // 아주 큰 파일은 잘라서 반환
    if (lines.length > 2000) {
      return lines.slice(0, 2000).join("\n") + `\n... (${lines.length - 2000}줄 생략됨)`;
    }
    return content;
  },
};

export const listDirTool: Tool = {
  name: "list_dir",
  description: "디렉터리의 파일/폴더 목록을 반환한다.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "나열할 디렉터리 경로 (기본: '.')" },
    },
  },
  async run(args, ctx) {
    const abs = safeResolve(ctx.cwd, ctx.root, String(args.path ?? "."));
    const entries = readdirSync(abs).map((name) => {
      const isDir = statSync(resolve(abs, name)).isDirectory();
      return isDir ? `${name}/` : name;
    });
    return entries.length ? entries.join("\n") : "(빈 디렉터리)";
  },
};

export const writeFileTool: Tool = {
  name: "write_file",
  description:
    "파일에 내용을 쓴다. 기본은 덮어쓰기(mode='overwrite'); mode='append' 면 기존 파일 끝에 이어붙인다. " +
    "상위 폴더는 자동 생성. 한 번에 다 쓰기 버거운 긴 문서는 여러 번에 나눠 append 로 이어 쓸 수 있다.",
  dangerous: true,
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "쓸 파일 경로" },
      content: { type: "string", description: "파일에 쓸 내용" },
      mode: {
        type: "string",
        enum: ["overwrite", "append"],
        description:
          "overwrite(기본): 파일 전체를 이 내용으로 덮어씀. append: 기존 파일 끝에 이어붙임(긴 문서를 여러 조각으로 나눠 쓸 때).",
      },
    },
    required: ["path", "content"],
  },
  async run(args, ctx) {
    const abs = safeResolve(ctx.cwd, ctx.root, String(args.path));
    const content = String(args.content ?? "");
    const append = String(args.mode ?? "overwrite") === "append";
    const ok = await ctx.requestPermission(
      "파일 쓰기",
      `${args.path} (${content.length}자${append ? ", 이어쓰기" : ""})`,
    );
    if (!ok) return "사용자가 파일 쓰기를 거부했습니다.";
    mkdirSync(dirname(abs), { recursive: true });
    if (append) {
      appendFileSync(abs, content, "utf8");
      return `${args.path} 에 이어썼습니다 (+${content.length}자).`;
    }
    writeFileSync(abs, content, "utf8");
    return `${args.path} 저장 완료 (${content.length}자).`;
  },
};

export const changeDirTool: Tool = {
  name: "change_dir",
  description:
    "이후 파일/셸 작업의 기준 폴더를 바꾼다 (cd 와 달리 다음 호출에도 지속된다). " +
    "run_shell 의 'cd' 는 명령 하나에서만 유효하고 다음 호출엔 안 남으므로, 생성된 프로젝트 하위 폴더 " +
    "(예: create-next-app 이 만든 'sudoku-game') 안에서 계속 작업하려면 반드시 이 도구로 먼저 이동하라. " +
    "경로는 현재 작업 폴더 기준 상대경로. 상위로는 '..', 루트로는 '.' 사용.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "이동할 폴더 (예: 'sudoku-game', 상위 '..', 루트 '.')" },
    },
    required: ["path"],
  },
  async run(args, ctx) {
    try {
      const wd = ctx.setWorkdir(String(args.path));
      return `작업 폴더를 '${wd}' 로 변경했습니다. 이후 write_file·read_file·run_shell 은 이 폴더에서 동작합니다.`;
    } catch (e: any) {
      return `작업 폴더 변경 실패: ${e.message}`;
    }
  },
};

export const fsTools: Tool[] = [readFileTool, listDirTool, writeFileTool, changeDirTool];
