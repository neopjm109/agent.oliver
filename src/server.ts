// 상주 서버 — 파이프라인(router centroids · LLM 연결)을 한 번만 로드해 워밍 유지.
// TCP(기본 127.0.0.1:7000)로 요청 1건씩 처리. 요청마다 클라이언트 cwd 가 workspace 로 전달됨.
//   실행:  npm run server   (프로젝트 루트에서 — config/ · skills/ 가 여기 기준)
import 'dotenv/config';
import net from 'node:net';
import { isAbsolute, resolve } from 'node:path';
import { statSync } from 'node:fs';
import { createPipeline } from './pipeline.js';
import { serverAddr, isLoopbackHost } from './core/serverAddr.js';
import { listSouls } from './core/soul.js';

interface Req {
  /** 제어 요청: 'info'(배너용 메타) | 'reset'(세션 초기화). 없으면 일반 대화 턴. */
  op?: 'info' | 'reset';
  text?: string;
  workspace?: string;
  chatId?: string;
  /** 메신저 업로드 첨부의 절대경로 목록(봇이 다운로드해 로컬에 저장). */
  attachments?: string[];
}

const { host, port } = serverAddr();

// 서버는 요청이 보낸 workspace 를 파일쓰기·스캐폴드 명령의 실행 루트로 쓴다(클라이언트가 자기 cwd 전달).
// AGENT_ALLOWED_ROOTS(콜론 구분)가 설정되면 그 하위만 허용해, 임의 위치에서의 쓰기/실행을 막는다.
const allowedRoots = (process.env.AGENT_ALLOWED_ROOTS ?? '')
  .split(':')
  .map((p) => p.trim())
  .filter(Boolean)
  .map((p) => resolve(p));

/** 요청 workspace 검증 — 미지정이면 서버 cwd 로 위임(null 반환). 유효하면 절대경로, 부적합하면 에러 문자열. */
function validateWorkspace(ws?: string): { ok: true; path: string | undefined } | { ok: false; error: string } {
  if (ws === undefined || ws === '') return { ok: true, path: undefined }; // 파이프라인이 서버 cwd 로 폴백
  if (!isAbsolute(ws)) return { ok: false, error: `workspace 는 절대경로여야 해요: ${ws}` };
  const abs = resolve(ws);
  try {
    if (!statSync(abs).isDirectory()) return { ok: false, error: `workspace 가 디렉토리가 아니에요: ${abs}` };
  } catch {
    return { ok: false, error: `workspace 를 찾을 수 없어요: ${abs}` };
  }
  if (allowedRoots.length) {
    const inside = allowedRoots.some((root) => abs === root || abs.startsWith(root + '/'));
    if (!inside) return { ok: false, error: `허용되지 않은 workspace 예요(AGENT_ALLOWED_ROOTS 밖): ${abs}` };
  }
  return { ok: true, path: abs };
}

const pipe = await createPipeline();
console.error(`[pipeline 로드됨] intents=${pipe.info().intents} skills=${pipe.info().skills}`);

// 모델 예열 + 주기 keep-alive — 상주 서버는 첫 요청 콜드스타트를 없애고, 유휴 시 Ollama 가
// 모델을 내리지 않도록 4분마다 최소 호출로 상주 유지한다(베스트에포트, 실패 무시).
await pipe.warmup().then(
  () => console.error('[모델 예열 완료]'),
  () => {},
);
setInterval(() => void pipe.warmup().catch(() => {}), 4 * 60_000).unref();

// allowHalfOpen: 클라이언트가 요청을 보내고 write 를 닫아도(FIN), 서버가 비동기 처리
// 후 응답을 쓸 수 있도록 쓰기측을 자동으로 닫지 않는다.
const server = net.createServer({ allowHalfOpen: true }, (conn) => {
  let buf = '';
  conn.setEncoding('utf8');
  conn.on('data', (d) => {
    buf += d;
  });
  conn.on('end', async () => {
    try {
      const req = JSON.parse(buf) as Req;
      if (req.op === 'info') {
        conn.end(JSON.stringify({ ...pipe.info(), souls: listSouls() }) + '\n');
        return;
      }
      const v = validateWorkspace(req.workspace);
      if (!v.ok) {
        conn.end(JSON.stringify({ error: v.error }) + '\n');
        return;
      }
      // 첨부(봇 업로드) 검증 — 절대경로 + 실제 파일만, 최대 10개. 그 외는 조용히 버린다.
      const atts = (req.attachments ?? [])
        .filter((p): p is string => typeof p === 'string' && isAbsolute(p))
        .filter((p) => {
          try {
            return statSync(p).isFile();
          } catch {
            return false;
          }
        })
        .slice(0, 10);
      const opts = { workspace: v.path, chatId: req.chatId, attachments: atts.length ? atts : undefined };
      if (req.op === 'reset') {
        pipe.reset(opts);
        conn.end(JSON.stringify({ ok: true }) + '\n');
      } else {
        // NDJSON 스트리밍: 생성 토큰을 {"t":"…"} 줄로 흘리고, 마지막에 {"done":{…응답}} 한 줄로 마무리.
        // (구 클라이언트/봇은 onToken 을 안 주므로 토큰 줄 없이 done 만 받는다 — 하위호환)
        const onToken = (t: string) => conn.write(JSON.stringify({ t }) + '\n');
        const res = await pipe.handle(req.text ?? '', { ...opts, onToken });
        conn.end(JSON.stringify({ done: res }) + '\n');
      }
    } catch (err) {
      conn.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) + '\n');
    }
  });
  conn.on('error', () => {
    /* 클라이언트가 끊어도 서버는 계속 */
  });
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`포트 ${port} 가 이미 사용 중입니다. 다른 서버가 떠 있는지 확인하세요.`);
    process.exit(1);
  }
  throw err;
});

server.listen(port, host, () => {
  console.error(`agent 서버 대기 중: tcp://${host}:${port}`);
  if (!isLoopbackHost(host)) {
    console.error(
      `⚠️  비-루프백(${host}) 바인딩입니다. 이 서버는 요청이 지정한 workspace 에서 파일쓰기·스캐폴드 명령을 실행하므로,\n` +
        '   네트워크에 노출되면 위험합니다. 반드시 AGENT_ALLOWED_ROOTS 로 허용 경로를 제한하고 신뢰된 망에서만 사용하세요.',
    );
    if (!allowedRoots.length) {
      console.error('   현재 AGENT_ALLOWED_ROOTS 가 비어 있어 모든 절대경로가 허용됩니다.');
    }
  }
  console.error('전역 CLI:  agent "메시지"  |  대화형:  agent  |  텔레그램:  npm run bot');
});

function shutdown(): void {
  server.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
