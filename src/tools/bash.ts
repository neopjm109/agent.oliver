import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Tool } from "./types.js";

const execAsync = promisify(exec);

export const bashTool: Tool = {
  name: "run_shell",
  description:
    "셸 명령을 실행하고 stdout/stderr 를 반환한다. 파일 검색(grep, find), 스캐폴딩, 설치, 빌드, 테스트 실행 등에 사용. " +
    "명령은 스스로 종료돼야 한다(기본 타임아웃 60초). 대화형 프롬프트가 뜨는 명령은 무인 플래그를 붙이고" +
    "(예: create-next-app '--yes', 설치 '-y'), 'npm run dev'·'npm start'·'--watch' 같은 끝나지 않는 서버/감시 명령은 실행하지 말 것(타임아웃으로 실패). " +
    "'cd' 는 이 명령 안에서만 유효하고 다음 호출엔 안 남는다 — 하위 폴더에서 계속 작업하려면 change_dir 도구로 이동할 것.",
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
