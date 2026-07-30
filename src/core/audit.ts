// 감사 로그(JSONL) — 매 턴의 라우팅 결정을 구조화해 남긴다.
// 목적: "어느 결정 경로가 약한지 / 어느 intent 가 느린지"를 감이 아니라 데이터로 판단
// (예: llm-classify 로 결정된 턴만 모아 오분류율을 보거나, 지연 p95 를 intent 별로 집계).
// best-effort append — 실패해도 대화엔 영향 없다. 원문은 남기지 않고 길이만 기록(프라이버시).
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface AuditEntry {
  trace_id: string;
  ts: string; // ISO8601
  session: string; // 세션 키(chatId 또는 workspace)
  text_len: number; // 원문 길이(내용 미기록)
  intent: string;
  /** 라우팅 유사도 — 임베딩 신뢰도 프록시(confidence). 결정 경로에 따라 없을 수 있다. */
  sim?: number;
  /**
   * 결정 경로: deterministic-scaffold | deterministic-oos | embedding-direct | llm-classify |
   * promote-complex | fallback | pending-commit | plan-continue | awaiting-name | awaiting-path | soul
   */
  decided_by: string;
  /** plan_and_run 으로 복합 승격됐는가. */
  promoted?: boolean;
  /** 첨부(파일 인제스천) 라벨 — 있으면 그 턴이 파일을 참조·분석했다는 신호. */
  attachments?: string[];
  latency_ms: number;
  /** 실제 실행된 스킬(중복 제거, 실행 순서). */
  skills: string[];
}

export class AuditLogger {
  constructor(
    private path: string | undefined,
    private enabled: boolean,
  ) {}

  /** 짧은 추적 id (턴 단위). */
  newTraceId(): string {
    return randomUUID().slice(0, 8);
  }

  log(entry: AuditEntry): void {
    if (!this.enabled || !this.path) return;
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      appendFileSync(this.path, JSON.stringify(entry) + '\n');
    } catch {
      /* best-effort: 로깅 실패는 대화를 막지 않는다 */
    }
  }
}
