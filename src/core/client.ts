// 서버(TCP)로 요청을 보내는 클라이언트 헬퍼. 텔레그램 봇 등에서 재사용.
import net from 'node:net';
import { serverAddr } from './serverAddr.js';
import type { AgentReply } from './types.js';

/** 서버 응답 형태 (공용 AgentReply). */
export type AgentResponse = AgentReply;

export interface RequestOpts {
  workspace?: string;
  chatId?: string;
  /** 메신저 업로드 첨부의 절대경로(서버가 읽어 프롬프트에 싣는다). */
  attachments?: string[];
}

export function requestAgent(text: string, opts: RequestOpts = {}): Promise<AgentResponse> {
  const { host, port } = serverAddr();
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host, port }, () =>
      sock.end(JSON.stringify({ text, workspace: opts.workspace, chatId: opts.chatId, attachments: opts.attachments })),
    );
    sock.setEncoding('utf8');
    let buf = '';
    let settled = false;
    // 서버는 NDJSON 으로 응답한다: 생성 토큰을 {"t":"…"} 줄로 흘리고 마지막에 {"done":{…응답}} 한 줄.
    // 봇은 토큰을 스트리밍하지 않으므로 t 줄은 무시하고 done(=최종 응답)만 언랩한다.
    // (하위호환: 개행 없는 단일 JSON 응답도 그대로 수용 — done 키가 없으면 객체 자체가 응답.)
    const consume = (line: string): void => {
      if (settled || !line.trim()) return;
      let msg: any;
      try {
        msg = JSON.parse(line);
      } catch {
        return; // 부분 줄/노이즈는 무시
      }
      if (msg && typeof msg.t === 'string' && !('done' in msg)) return; // 스트리밍 토큰 줄
      settled = true;
      resolve((msg && 'done' in msg ? msg.done : msg) as AgentResponse);
    };
    sock.on('data', (d) => {
      buf += d;
      let nl: number;
      while ((nl = buf.indexOf('\n')) !== -1) {
        consume(buf.slice(0, nl));
        buf = buf.slice(nl + 1);
      }
    });
    sock.on('end', () => {
      if (!settled) consume(buf); // 마지막 줄에 개행이 없을 수 있음
      if (!settled) reject(new Error(`bad response: ${buf.slice(0, 200)}`));
    });
    sock.on('error', () => reject(new Error(`서버 연결 실패 (tcp://${host}:${port}). 먼저 실행: npm run server`)));
  });
}
