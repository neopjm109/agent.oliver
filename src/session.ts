import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import type { ChatCompletionMessageParam } from "./llm.js";

interface SessionData {
  messages: ChatCompletionMessageParam[];
  /** 이 세션에 적용할 페르소나(SOUL) 이름. null 이면 일반 모드. */
  persona: string | null;
  /** 압축된 오래된 대화의 누적 요약 (컨텍스트 유지용). */
  summary: string;
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
    const safe = sessionId.replace(/[^a-zA-Z0-9._-]/g, "_");
    return resolve(this.dir, `${safe}.json`);
  }

  private read(sessionId: string): SessionData {
    const p = this.path(sessionId);
    if (!existsSync(p)) return { messages: [], persona: null, summary: "" };
    try {
      const d = JSON.parse(readFileSync(p, "utf8"));
      return {
        messages: Array.isArray(d.messages) ? d.messages : [],
        persona: typeof d.persona === "string" ? d.persona : null,
        summary: typeof d.summary === "string" ? d.summary : "",
      };
    } catch {
      return { messages: [], persona: null, summary: "" };
    }
  }

  private write(sessionId: string, data: SessionData): void {
    writeFileSync(
      this.path(sessionId),
      JSON.stringify({ sessionId, updatedAt: new Date().toISOString(), ...data }, null, 2),
      "utf8",
    );
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

  /** 대화 내역을 저장한다 (기존 persona·summary 는 보존) */
  save(sessionId: string, messages: ChatCompletionMessageParam[]): void {
    const prev = this.read(sessionId);
    this.write(sessionId, { messages, persona: prev.persona, summary: prev.summary });
  }

  /** 페르소나를 설정/해제한다 (기존 대화 내역·summary 는 보존) */
  savePersona(sessionId: string, persona: string | null): void {
    const prev = this.read(sessionId);
    this.write(sessionId, { messages: prev.messages, persona, summary: prev.summary });
  }

  /** 누적 요약을 저장한다 (기존 대화 내역·persona 는 보존) */
  saveSummary(sessionId: string, summary: string): void {
    const prev = this.read(sessionId);
    this.write(sessionId, { messages: prev.messages, persona: prev.persona, summary });
  }

  /** 세션의 대화 내역과 설정을 삭제한다 (초기화) */
  clear(sessionId: string): void {
    rmSync(this.path(sessionId), { force: true });
  }
}
