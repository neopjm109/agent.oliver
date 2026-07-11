import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Tool } from "./types.js";

const execAsync = promisify(exec);

export const bashTool: Tool = {
  name: "run_shell",
  description:
    "셸 명령을 실행하고 stdout/stderr 를 반환한다. 파일 검색(grep, find), 빌드, 테스트 실행 등에 사용.",
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
    const timeout = Number(args.timeout_ms ?? 60000);
    const ok = await ctx.requestPermission("셸 실행", command);
    if (!ok) return "사용자가 명령 실행을 거부했습니다.";
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: ctx.cwd,
        timeout,
        maxBuffer: 10 * 1024 * 1024,
      });
      const out = [stdout, stderr].filter(Boolean).join("\n").trim();
      return out || "(출력 없음, 정상 종료)";
    } catch (err: any) {
      const out = [err.stdout, err.stderr].filter(Boolean).join("\n").trim();
      return `명령 실패 (exit ${err.code ?? "?"}):\n${out || err.message}`;
    }
  },
};
