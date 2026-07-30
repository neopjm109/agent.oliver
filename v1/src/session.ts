import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { ChatCompletionMessageParam } from "./llm.js";

/** 세션 목록 표시용 요약 정보 */
export interface SessionInfo {
  id: string;
  messages: number;
  persona: string | null;
  updatedAt: string;
}

/** 세션 ID를 파일/폴더명에 안전한 문자로 정규화한다 (경로 주입 방지). */
export function sanitizeSessionId(sessionId: string): string {
  return sessionId.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** 세션별 작업 폴더 경로 (workspace 루트 밑의 세션 하위폴더). */
export function sessionWorkspace(root: string, sessionId: string): string {
  return resolve(root, sanitizeSessionId(sessionId));
}

interface SessionData {
  messages: ChatCompletionMessageParam[];
  /** 이 세션에 적용할 페르소나(SOUL) 이름. null 이면 일반 모드. */
  persona: string | null;
  /** 압축된 오래된 대화의 누적 요약 (컨텍스트 유지용). */
  summary: string;
  /** 세션 워크스페이스 루트 기준 현재 작업 하위 폴더(change_dir). "" = 루트. 재시작 시 복원. */
  workdir: string;
}

/**
 * 대화 히스토리와 세션 설정(페르소나)을 세션 단위로 디스크(JSON)에 영속화한다.
 * 시스템 프롬프트는 저장하지 않는다(로드 시 최신 프롬프트로 재생성) —
 * 사용자/어시스턴트/도구 메시지와 persona 만 보관한다.
 */
export class SessionStore {
  constructor(private dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  private path(sessionId: string): string {
    // 경로 주입 방지: 세션 ID를 안전한 문자로 제한
    return resolve(this.dir, `${sanitizeSessionId(sessionId)}.json`);
  }

  private read(sessionId: string): SessionData {
    const p = this.path(sessionId);
    const empty: SessionData = { messages: [], persona: null, summary: "", workdir: "" };
    if (!existsSync(p)) return empty;
    try {
      const d = JSON.parse(readFileSync(p, "utf8"));
      return {
        messages: Array.isArray(d.messages) ? d.messages : [],
        persona: typeof d.persona === "string" ? d.persona : null,
        summary: typeof d.summary === "string" ? d.summary : "",
        workdir: typeof d.workdir === "string" ? d.workdir : "",
      };
    } catch {
      return empty;
    }
  }

  private write(sessionId: string, data: SessionData): void {
    writeFileSync(
      this.path(sessionId),
      JSON.stringify({ sessionId, updatedAt: new Date().toISOString(), ...data }, null, 2),
      "utf8",
    );
  }

  /** 기존 세션 데이터에 일부 필드만 덮어써 저장한다 (나머지 필드 보존). */
  private patch(sessionId: string, partial: Partial<SessionData>): void {
    this.write(sessionId, { ...this.read(sessionId), ...partial });
  }

  load(sessionId: string): ChatCompletionMessageParam[] {
    return this.read(sessionId).messages;
  }

  /** 세션에 설정된 페르소나 이름 (없으면 null) */
  loadPersona(sessionId: string): string | null {
    return this.read(sessionId).persona;
  }

  /** 세션의 누적 요약 (없으면 "") */
  loadSummary(sessionId: string): string {
    return this.read(sessionId).summary;
  }

  /** 세션의 마지막 작업 하위 폴더(change_dir). 없으면 "". */
  loadWorkdir(sessionId: string): string {
    return this.read(sessionId).workdir;
  }

  /** 대화 내역을 저장한다 (기존 persona·summary·workdir 은 보존) */
  save(sessionId: string, messages: ChatCompletionMessageParam[]): void {
    this.patch(sessionId, { messages });
  }

  /** 페르소나를 설정/해제한다 (나머지 보존) */
  savePersona(sessionId: string, persona: string | null): void {
    this.patch(sessionId, { persona });
  }

  /** 누적 요약을 저장한다 (나머지 보존) */
  saveSummary(sessionId: string, summary: string): void {
    this.patch(sessionId, { summary });
  }

  /** 작업 하위 폴더를 저장한다 (나머지 보존) — 재시작 시 복원용 */
  saveWorkdir(sessionId: string, workdir: string): void {
    this.patch(sessionId, { workdir });
  }

  /** 세션의 대화 내역과 설정을 통째로 삭제한다 (파일 제거) */
  clear(sessionId: string): void {
    rmSync(this.path(sessionId), { force: true });
  }

  /** 대화 내역과 요약만 비운다. 페르소나·작업 폴더 등 세션 설정은 유지한다 (/reset 용) */
  resetConversation(sessionId: string): void {
    this.patch(sessionId, { messages: [], summary: "" });
  }

  /** 세션 파일이 존재하는지 */
  exists(sessionId: string): boolean {
    return existsSync(this.path(sessionId));
  }

  /** 마지막으로 활성이던 세션 ID 를 기록한다 (다음 실행 시 자동 복원용). */
  saveLast(sessionId: string): void {
    try {
      writeFileSync(resolve(this.dir, ".last-session"), sanitizeSessionId(sessionId), "utf8");
    } catch {
      /* 기록 실패는 무시 — 기능 저하 없음 */
    }
  }

  /** 마지막 활성 세션 ID. 해당 세션 파일이 실제로 있을 때만 반환(삭제된 세션은 무시), 없으면 null. */
  loadLast(): string | null {
    try {
      const id = readFileSync(resolve(this.dir, ".last-session"), "utf8").trim();
      return id && this.exists(id) ? id : null;
    } catch {
      return null;
    }
  }

  /** 저장된 모든 세션의 요약 목록 (수정 시각 최신순) */
  list(): SessionInfo[] {
    let files: string[];
    try {
      files = readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    } catch {
      return [];
    }
    const infos = files.map((f): SessionInfo => {
      const id = f.replace(/\.json$/, "");
      try {
        const d = JSON.parse(readFileSync(resolve(this.dir, f), "utf8"));
        return {
          id,
          messages: Array.isArray(d.messages) ? d.messages.length : 0,
          persona: typeof d.persona === "string" ? d.persona : null,
          updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : "",
        };
      } catch {
        return { id, messages: 0, persona: null, updatedAt: "" };
      }
    });
    return infos.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}
