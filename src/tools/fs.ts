import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import type { Tool } from "./types.js";

/** cwd 밖으로 벗어나는 경로 접근을 막는다 (경로 탈출 방어) */
function safeResolve(cwd: string, p: string): string {
  const abs = resolve(cwd, p);
  const rel = relative(cwd, abs);
  if (rel.startsWith("..")) {
    throw new Error(`작업 디렉터리 밖 경로는 접근할 수 없습니다: ${p}`);
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
    const abs = safeResolve(ctx.cwd, String(args.path));
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
    const abs = safeResolve(ctx.cwd, String(args.path ?? "."));
    const entries = readdirSync(abs).map((name) => {
      const isDir = statSync(resolve(abs, name)).isDirectory();
      return isDir ? `${name}/` : name;
    });
    return entries.length ? entries.join("\n") : "(빈 디렉터리)";
  },
};

export const writeFileTool: Tool = {
  name: "write_file",
  description: "파일에 내용을 쓴다 (없으면 생성, 있으면 덮어씀). 상위 폴더는 자동 생성.",
  dangerous: true,
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "쓸 파일 경로" },
      content: { type: "string", description: "파일에 쓸 전체 내용" },
    },
    required: ["path", "content"],
  },
  async run(args, ctx) {
    const abs = safeResolve(ctx.cwd, String(args.path));
    const content = String(args.content ?? "");
    const ok = await ctx.requestPermission(
      "파일 쓰기",
      `${args.path} (${content.length}자)`,
    );
    if (!ok) return "사용자가 파일 쓰기를 거부했습니다.";
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, "utf8");
    return `${args.path} 저장 완료 (${content.length}자).`;
  },
};

export const fsTools: Tool[] = [readFileTool, listDirTool, writeFileTool];
