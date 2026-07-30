import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { requestAgent } from './client.js';

/**
 * 서버(server.ts)의 응답을 흉내 내는 목 TCP 서버. 요청을 받으면 canned 응답을 그대로 흘리고 닫는다.
 * allowHalfOpen: 클라이언트가 요청 후 write 를 닫아도(FIN) 서버가 응답을 쓸 수 있게 한다.
 */
function mockServer(response: string): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const srv = net.createServer({ allowHalfOpen: true }, (sock) => {
      sock.on('data', () => {}); // 요청 바이트는 무시
      sock.on('end', () => sock.end(response)); // 요청 FIN 후 응답 송신
      sock.on('error', () => {});
    });
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as net.AddressInfo).port;
      resolve({ port, close: () => new Promise((r) => srv.close(() => r())) });
    });
  });
}

/** 목 서버 포트로 serverAddr 를 가리키게 하고 requestAgent 를 호출한 뒤 환경을 복원한다. */
async function withMock(response: string, fn: (res: any) => void): Promise<void> {
  const { port, close } = await mockServer(response);
  const prevHost = process.env.AGENT_HOST;
  const prevPort = process.env.AGENT_PORT;
  process.env.AGENT_HOST = '127.0.0.1';
  process.env.AGENT_PORT = String(port);
  try {
    fn(await requestAgent('안녕', { chatId: 'test' }));
  } finally {
    prevHost === undefined ? delete process.env.AGENT_HOST : (process.env.AGENT_HOST = prevHost);
    prevPort === undefined ? delete process.env.AGENT_PORT : (process.env.AGENT_PORT = prevPort);
    await close();
  }
}

test('requestAgent: NDJSON 스트리밍 — t 토큰 줄은 무시하고 done 을 언랩한다(봇 회귀)', async () => {
  const response =
    '{"t":"안"}\n{"t":"녕하세요"}\n' +
    '{"done":{"text":"안녕하세요","intent":"chitchat","skills":["chitchat"]}}\n';
  await withMock(response, (res) => {
    assert.equal(res.text, '안녕하세요'); // done 아래가 아니라 최상위로 언랩돼야
    assert.equal(res.intent, 'chitchat');
    assert.deepEqual(res.skills, ['chitchat']);
    assert.equal(res.done, undefined); // 래퍼가 새어나오면 안 됨
  });
});

test('requestAgent: 토큰 없는 done-only 응답(결정론 경로)도 언랩한다', async () => {
  const response = '{"done":{"text":"✅ 완료","intent":"scaffold_project","files":["/tmp/build.sh"]}}\n';
  await withMock(response, (res) => {
    assert.equal(res.text, '✅ 완료');
    assert.equal(res.intent, 'scaffold_project');
    assert.deepEqual(res.files, ['/tmp/build.sh']);
  });
});

test('requestAgent: 하위호환 — 개행 없는 단일 JSON(done 키 없음)은 그대로 응답', async () => {
  const response = '{"text":"legacy","intent":"unknown"}'; // 구 서버: 개행/래퍼 없음
  await withMock(response, (res) => {
    assert.equal(res.text, 'legacy');
    assert.equal(res.intent, 'unknown');
  });
});

test('requestAgent: 에러 응답도 전달한다', async () => {
  const response = '{"done":{"error":"workspace 를 찾을 수 없어요"}}\n';
  await withMock(response, (res) => {
    assert.equal(res.error, 'workspace 를 찾을 수 없어요');
  });
});
