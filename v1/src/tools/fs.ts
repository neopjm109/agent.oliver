import { readFileSync, writeFileSync, appendFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { resolve, dirname, relative, basename } from "node:path";
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

/** 검색·순회에서 제외할 노이즈 폴더(빌드 산출물·VCS·의존성). */
const SEARCH_IGNORE = new Set([".git", "node_modules", ".next", "dist", "build", ".turbo", ".cache"]);

/**
 * 파일명 비교용 정규화: 소문자화하고 구분자(-, _, 공백)를 하나로 통일한다.
 * 소형 모델이 'prd/3-data-analysis.md' 를 'prd/3-data_analysis.md' 로 바꿔 부르는(대시↔언더스코어)
 * 1글자 오염을 근접 매칭으로 복구하기 위한 용도.
 */
function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[-_\s]+/g, "-");
}

/**
 * 샌드박스 루트(root) 하위 전체에서 basename 이 일치하는 항목을 찾아,
 * 모델이 곧바로 다시 쓸 수 있도록 cwd 기준 상대경로 목록으로 돌려준다.
 * 토픽 하위폴더로 cwd 가 내려가 사용자가 준 상대경로가 빗나갔을 때(예: 'prd/x.md' →
 * 실제는 '../prd/x.md') read_file·list_dir·change_dir 이 스스로 복구하기 위한 용도.
 * kind 로 파일만/폴더만 걸러내며(디렉터리 탐색은 항상 하위로 내려감), 노이즈 폴더는 건너뛴다.
 * 정확히 일치하는 항목을 우선 반환하고, 하나도 없으면 구분자만 다른 근접 매칭(대시↔언더스코어 등)을
 * 대신 반환한다 — 소형 모델의 1글자 파일명 오염을 자동 복구하기 위함. 결과가 limit 에 차면 조기 종료.
 */
function findByName(
  root: string,
  cwd: string,
  name: string,
  kind: "file" | "dir" = "file",
  limit = 10,
): string[] {
  const target = name.toLowerCase();
  const targetNorm = normalizeName(name);
  const exact: string[] = [];
  const near: string[] = []; // 구분자만 다른 근접 매칭(정확 매칭이 하나도 없을 때만 사용)
  const stack: string[] = [root];
  while (stack.length && exact.length < limit && near.length < limit) {
    const dir = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const e of entries) {
      const abs = resolve(dir, e);
      let isDir = false;
      try {
        isDir = statSync(abs).isDirectory();
      } catch {
        continue; // 접근 불가 항목은 건너뜀
      }
      const kindOk = kind === "dir" ? isDir : !isDir;
      if (kindOk) {
        const el = e.toLowerCase();
        if (el === target) exact.push(relative(cwd, abs) || e);
        else if (normalizeName(e) === targetNorm) near.push(relative(cwd, abs) || e);
      }
      if (isDir && !SEARCH_IGNORE.has(e)) stack.push(abs); // 폴더는 항상 하위로 내려간다
    }
  }
  return exact.length ? exact : near;
}

/** 자동 발급 토픽 폴더명 패턴(`01-slug`, `02-...`). */
const TOPIC_DIR_RE = /^\d{2,}-/;

/**
 * 소형 모델이 현재 토픽 폴더 안에서 그 폴더명을 경로에 또 붙여(예: cwd 가 '01-blueprint' 인데
 * '01-blueprint/architecture.md' 로 씀) '01-blueprint/01-blueprint/' 로 이중 중첩되는 것을 막는다.
 * 현재 workdir 이 자동 토픽 폴더이고, 경로 첫 구간이 그 폴더명과 같을 때만 그 구간을 벗겨낸다
 * (아주 좁은 조건 — 일반 하위 폴더 작업에는 영향 없음).
 */
function stripRedundantTopicPrefix(workdir: string, p: string): string {
  const base = basename(workdir);
  if (!base || !TOPIC_DIR_RE.test(base)) return p;
  const norm = p.replace(/^\.\//, "").replace(/\\/g, "/");
  const first = norm.split("/")[0];
  if (first.toLowerCase() === base.toLowerCase()) {
    return norm.slice(first.length + 1) || ".";
  }
  return p;
}

/** 아주 큰 파일은 앞부분만 잘라 반환(2000줄 초과 시). */
function clip(content: string): string {
  const lines = content.split("\n");
  if (lines.length > 2000) {
    return lines.slice(0, 2000).join("\n") + `\n... (${lines.length - 2000}줄 생략됨)`;
  }
  return content;
}

export const readFileTool: Tool = {
  name: "read_file",
  description:
    "파일의 내용을 읽어 반환한다. 경로는 작업 디렉터리 기준 상대경로. " +
    "지정한 경로에 없으면 같은 파일명을 워크스페이스에서 자동으로 찾아 읽고, 실제 경로를 알려준다.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "읽을 파일 경로" },
    },
    required: ["path"],
  },
  async run(args, ctx) {
    // 현재 토픽 폴더 안에서 그 폴더명을 경로에 또 붙인 경우(예: cwd 가 '02-data-analysis' 인데
    // '02-data-analysis/clicks.csv' 로 읽으려는 경우)를 벗겨낸다 — 안 그러면 경로가 빗나가
    // 자동 복구가 워크스페이스 전체(예: prd/clicks.csv 와 토픽 폴더의 clicks.csv)를 찾아 모호해지고,
    // 모델이 같은 read_file 을 반복해 루프에 빠진다.
    const p = stripRedundantTopicPrefix(ctx.workdir, String(args.path));
    const abs = safeResolve(ctx.cwd, ctx.root, p);
    try {
      return clip(readFileSync(abs, "utf8"));
    } catch (e: any) {
      if (e?.code !== "ENOENT") throw e; // 디렉터리(EISDIR)·권한 오류 등은 그대로 노출
      // 지정 경로에 없음 → 파일명으로 워크스페이스 전체를 뒤져 자동 복구.
      // (토픽 하위폴더로 cwd 가 내려가 'prd/x.md' 가 '../prd/x.md' 였던 경우 등)
      const matches = findByName(ctx.root, ctx.cwd, basename(p));
      if (matches.length === 1) {
        const found = safeResolve(ctx.cwd, ctx.root, matches[0]);
        const note = `("${p}" 경로엔 없어 워크스페이스에서 찾은 '${matches[0]}' 를 읽었습니다. 이후 이 파일은 '${matches[0]}' 로 참조하세요.)\n`;
        return note + clip(readFileSync(found, "utf8"));
      }
      if (matches.length > 1) {
        return (
          `"${p}" 를 찾지 못했습니다. 워크스페이스에 같은 이름의 파일이 여러 개 있습니다:\n` +
          matches.map((m) => `  - ${m}`).join("\n") +
          `\n정확한 경로로 다시 read_file 하세요.`
        );
      }
      return `"${p}" 파일을 찾을 수 없고, 워크스페이스에도 '${basename(p)}' 이름의 파일이 없습니다.`;
    }
  },
};

export const listDirTool: Tool = {
  name: "list_dir",
  description:
    "디렉터리의 파일/폴더 목록을 반환한다. 기본 '.'. " +
    "지정한 폴더가 없으면 같은 이름의 폴더를 워크스페이스에서 자동으로 찾아 나열하고, 실제 경로를 알려준다.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "나열할 디렉터리 경로 (기본: '.')" },
    },
  },
  async run(args, ctx) {
    const p = stripRedundantTopicPrefix(ctx.workdir, String(args.path ?? "."));
    const abs = safeResolve(ctx.cwd, ctx.root, p);
    const listing = (dir: string) => {
      const entries = readdirSync(dir).map((name) => {
        const isDir = statSync(resolve(dir, name)).isDirectory();
        return isDir ? `${name}/` : name;
      });
      return entries.length ? entries.join("\n") : "(빈 디렉터리)";
    };
    try {
      return listing(abs);
    } catch (e: any) {
      if (e?.code !== "ENOENT") throw e;
      // 지정 폴더가 없음 → 폴더명으로 워크스페이스 전체를 뒤져 자동 복구.
      const matches = findByName(ctx.root, ctx.cwd, basename(p), "dir");
      if (matches.length === 1) {
        const found = safeResolve(ctx.cwd, ctx.root, matches[0]);
        return `("${p}" 폴더는 없어 워크스페이스에서 찾은 '${matches[0]}' 를 나열합니다. 이후 이 폴더는 '${matches[0]}' 로 참조하세요.)\n${listing(found)}`;
      }
      if (matches.length > 1) {
        return (
          `"${p}" 폴더를 찾지 못했습니다. 같은 이름의 폴더가 여러 개 있습니다:\n` +
          matches.map((m) => `  - ${m}/`).join("\n") +
          `\n정확한 경로로 다시 list_dir 하세요.`
        );
      }
      return `"${p}" 폴더를 찾을 수 없고, 워크스페이스에도 '${basename(p)}' 이름의 폴더가 없습니다.`;
    }
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
    const path = stripRedundantTopicPrefix(ctx.workdir, String(args.path));
    const abs = safeResolve(ctx.cwd, ctx.root, path);
    const content = String(args.content ?? "");
    const append = String(args.mode ?? "overwrite") === "append";
    const ok = await ctx.requestPermission(
      "파일 쓰기",
      `${path} (${content.length}자${append ? ", 이어쓰기" : ""})`,
    );
    if (!ok) return { content: "사용자가 파일 쓰기를 거부했습니다.", denied: true };
    mkdirSync(dirname(abs), { recursive: true });
    if (append) {
      appendFileSync(abs, content, "utf8");
      return `${path} 에 이어썼습니다 (+${content.length}자).`;
    }
    writeFileSync(abs, content, "utf8");
    return `${path} 저장 완료 (${content.length}자).`;
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
    const p = String(args.path);
    try {
      const wd = ctx.setWorkdir(p);
      return `작업 폴더를 '${wd}' 로 변경했습니다. 이후 write_file·read_file·run_shell 은 이 폴더에서 동작합니다.`;
    } catch (e: any) {
      // 지정 폴더가 없어 실패 → 폴더명으로 워크스페이스를 뒤져 자동 복구('..' '.' 같은 정상 이동은 검색 대상 아님).
      const bn = basename(p);
      if (p !== "." && p !== ".." && bn && bn !== "..") {
        const matches = findByName(ctx.root, ctx.cwd, bn, "dir");
        if (matches.length === 1) {
          try {
            const wd = ctx.setWorkdir(matches[0]);
            return `("${p}" 는 없어 워크스페이스에서 찾은 '${matches[0]}' 로 이동했습니다.) 작업 폴더를 '${wd}' 로 변경했습니다.`;
          } catch {
            /* 복구 이동도 실패하면 아래 원본 오류를 그대로 안내 */
          }
        } else if (matches.length > 1) {
          return (
            `"${p}" 로 이동 실패. 같은 이름의 폴더가 여러 개 있습니다:\n` +
            matches.map((m) => `  - ${m}/`).join("\n") +
            `\n정확한 경로로 다시 change_dir 하세요.`
          );
        }
      }
      return `작업 폴더 변경 실패: ${e.message}`;
    }
  },
};

export const fsTools: Tool[] = [readFileTool, listDirTool, writeFileTool, changeDirTool];
