// CLI 하네스 — 하나의 TUI 로 두 가지 전송(transport)을 지원한다.
//   in-process(기본): 파이프라인을 이 프로세스에서 직접 로드 (서버 불필요)
//   remote(--remote / AGENT_REMOTE=1): 상주 서버(TCP)로 요청 (전역 `agent` 가 이 모드)
//
//   대화형(REPL):  npm run cli            |   agent
//   단발 실행:      npm run cli -- "상태"  |   agent "상태"
//   서버 접속:      npm run cli -- --remote
import 'dotenv/config';
import net from 'node:net';
import { createInterface } from 'node:readline';
import { serverAddr } from './core/serverAddr.js';
import { dim, red, spinner, printResult, type Rendered } from './core/tui.js';

// ── 배너용 경량 색상·정렬 유틸 (stdout 기준, 외부 의존성 없음) ──
// 색은 대화형 TTY 에서만, NO_COLOR 가 있으면 끈다(파이프·로그 오염 방지).
const COLOR = !process.env.NO_COLOR && process.stdout.isTTY;
const sgr = (code: string) => (s: string) => (COLOR ? `\x1b[${code}m${s}\x1b[0m` : s);
const c = {
  bold: sgr('1'),
  dim: sgr('2'),
  cyan: sgr('36'),
  green: sgr('32'),
  yellow: sgr('33'),
  magenta: sgr('35'),
  gray: sgr('90'),
};

/** 배너에 표시할 메타 (파이프라인 info + 소울 목록). 두 전송이 동일하게 채운다. */
interface BannerInfo {
  intents: number;
  skills: number;
  profile: string;
  chatModel: string;
  embedModel: string;
  baseURL: string;
  soul: string | null;
  souls: string[];
}

/** 전송 추상화 — in-process/remote 가 동일 인터페이스를 구현한다. */
interface Client {
  /** 배너용 메타 조회 */
  info(): Promise<BannerInfo>;
  /** 한 턴 처리 (응답 or 에러 payload). onToken 을 주면 생성 토큰을 오는 대로 흘린다. */
  ask(
    text: string,
    workspace: string,
    onToken?: (t: string) => void,
  ): Promise<Rendered & { skills?: string[]; files?: string[] }>;
  /** 세션 대화 맥락 초기화 */
  reset(workspace: string): Promise<void>;
  /** 전송 라벨 (배너 표기용). in-process 면 null. */
  readonly remote: string | null;
  close(): void;
}

// ── in-process 전송: 파이프라인을 직접 로드 (openai 등 무거운 의존성은 이 경로에서만) ──
async function inProcessClient(): Promise<Client> {
  const load = spinner('로딩 중…');
  let pipe;
  try {
    const { createPipeline } = await import('./pipeline.js'); // 지연 로드
    pipe = await createPipeline();
  } finally {
    load.stop();
  }
  const { listSouls } = await import('./core/soul.js');
  return {
    remote: null,
    async info() {
      return { ...pipe.info(), souls: listSouls() };
    },
    async ask(text, workspace, onToken) {
      return pipe.handle(text, { workspace, onToken });
    },
    async reset(workspace) {
      pipe.reset({ workspace });
    },
    close() {},
  };
}

// ── remote 전송: 상주 서버(TCP)로 JSON 한 건씩 왕복 ──
function remoteClient(): Client {
  const { host, port } = serverAddr();
  const label = `tcp://${host}:${port}`;
  // NDJSON 스트림 수신: {"t":"…"} 토큰 줄은 onToken 으로, 그 외(done/error/info/ok)는 종결로 resolve.
  const send = (payload: unknown, onToken?: (t: string) => void): Promise<any> =>
    new Promise((resolve, reject) => {
      const sock = net.connect({ host, port }, () => sock.end(JSON.stringify(payload)));
      sock.setEncoding('utf8');
      let buf = '';
      let settled = false;
      const consume = (line: string) => {
        if (settled || !line.trim()) return;
        let msg: any;
        try {
          msg = JSON.parse(line);
        } catch {
          return; // 부분 줄/노이즈는 무시
        }
        if (msg && typeof msg.t === 'string') {
          onToken?.(msg.t);
          return;
        }
        settled = true;
        resolve(msg && 'done' in msg ? msg.done : msg); // done 은 실제 응답으로 언랩
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
        if (!settled) reject(new Error(`서버 응답을 해석할 수 없어요: ${buf.slice(0, 120)}`));
      });
      sock.on('error', () =>
        reject(new Error(`서버에 연결할 수 없어요 (${label}). 먼저 실행:  npm run server`)),
      );
    });
  return {
    remote: label,
    async info() {
      const r = await send({ op: 'info' });
      return { souls: [], soul: null, ...r };
    },
    ask(text, workspace, onToken) {
      return send({ text, workspace, chatId: null }, onToken);
    },
    async reset(workspace) {
      await send({ op: 'reset', workspace });
    },
    close() {},
  };
}

/** 터미널 표시 폭 근사치 — 한글·전각·이모지는 2칸으로 센다(라벨 정렬용). */
function dispWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    const wide =
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x2e80 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe4f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      cp >= 0x1f000;
    w += wide ? 2 : 1;
  }
  return w;
}

/** 표시 폭 기준으로 오른쪽을 공백 채움(색 코드가 붙기 전 원문 라벨에 쓸 것). */
function padEndDisp(s: string, width: number): string {
  const pad = width - dispWidth(s);
  return pad > 0 ? s + ' '.repeat(pad) : s;
}

/** 시작 배너 — 모델·엔드포인트·인텐트/스킬·소울·작업폴더를 정렬해 보여준다. */
function printBanner(info: BannerInfo, remote: string | null): void {
  const RULE = c.gray('─'.repeat(56));
  console.log();
  console.log(RULE);
  console.log(`  ${c.bold(c.cyan('🪶 AI Agent Lite'))}   ${c.gray('저사양 LLM 경량 에이전트 · Router + DAG + Skill')}`);
  console.log(RULE);

  type Row = { icon: string; label: string; value: string; sub?: string };
  const rows: Row[] = [
    {
      icon: '🚀',
      label: '모드',
      value: remote ? c.yellow('remote') + c.gray(` · 서버 ${remote}`) : c.green('in-process') + c.gray(' · 서버리스'),
    },
    { icon: '🧠', label: '모델', value: c.green(info.chatModel) },
    { icon: '🔗', label: '임베딩', value: c.dim(info.embedModel) },
    { icon: '🔌', label: '엔드포인트', value: c.dim(`${info.profile} · ${info.baseURL}`) },
    {
      icon: '🧭',
      label: '인텐트',
      value: `${c.bold(String(info.intents))}개` + c.gray(` · 스킬 ${c.bold(String(info.skills))}개`),
    },
    {
      icon: '🎭',
      label: '소울',
      value: info.soul ? c.magenta(info.soul) : c.gray('(기본 에이전트)'),
      sub: info.souls.length ? c.gray('└ 사용 가능: ') + c.dim(info.souls.join(', ')) : undefined,
    },
    { icon: '📁', label: '작업폴더', value: process.cwd() + c.gray('  (파일/셸 작업은 이 안에서만)') },
  ];
  const labelW = Math.max(...rows.map((r) => dispWidth(r.label)));
  const subIndent = ' '.repeat(labelW + 8);
  for (const r of rows) {
    console.log(`  ${r.icon}  ${c.dim(padEndDisp(r.label, labelW))}  ${r.value}`);
    if (r.sub) console.log(subIndent + r.sub);
  }

  console.log(RULE);
  const footW = dispWidth('명령어');
  console.log(`  ${c.dim(padEndDisp('명령어', footW))}  ${c.cyan('/help')} ${c.gray('· /status · /soul [이름|off] · /reset')}`);
  console.log(`  ${c.dim(padEndDisp('여러 줄', footW))}  ${c.gray('줄 끝에 \\ 로 이어쓰기 · Enter 로 전송')}`);
  console.log(`  ${c.dim(padEndDisp('종료', footW))}  ${c.gray('exit / quit / Ctrl+C')}`);
  console.log();
}

/** /help 도움말. */
function printHelp(souls: string[]): void {
  console.log(c.bold('사용 가능한 명령어'));
  console.log(`  ${c.cyan('/help')}              이 도움말`);
  console.log(`  ${c.cyan('/status')}            에이전트 상태(결정론·즉시) — 동작·intent/skill·모델·uptime`);
  console.log(`  ${c.cyan('/soul')} ${c.gray('[이름|off]')}  소울(페르소나) 전환 · 인자 없으면 목록`);
  console.log(`  ${c.cyan('/reset')}             현재 세션 대화 맥락 초기화`);
  console.log(`  ${c.cyan('exit')} ${c.gray('/')} ${c.cyan('quit')}         종료`);
  if (souls.length) console.log(c.gray(`  소울 목록: ${souls.join(', ')}`));
  console.log();
}

/** 한 턴 처리 — 스피너를 돌리며 클라이언트를 호출하고 결과를 출력. */
async function runTurn(client: Client, input: string, workspace: string): Promise<void> {
  const think = spinner('생각 중…');
  let streamed = false;
  // 첫 토큰이 오면 스피너를 멈추고, 이후 토큰을 그대로 표준출력에 흘린다.
  const onToken = (t: string): void => {
    if (!streamed) {
      think.stop();
      streamed = true;
    }
    process.stdout.write(t);
  };
  let res;
  try {
    res = await client.ask(input, workspace, onToken);
  } finally {
    think.stop();
  }
  if (streamed) {
    process.stdout.write('\n'); // 스트리밍 본문 뒤 줄바꿈 (본문은 이미 출력됨 → 재출력 안 함)
  } else {
    printResult(res);
  }
  if (res.skills?.length) console.log(dim(`🧩 사용한 스킬: ${res.skills.join(', ')}`));
  if (res.files?.length) console.log(dim(`📄 결과물 파일: ${res.files.join(', ')}`));
}

/** 대화형 REPL — 멀티턴 대화(세션 유지는 전송 측이 담당). */
async function repl(client: Client): Promise<void> {
  const workspace = process.cwd();
  const info = await client.info();
  const souls = info.souls;
  printBanner(info, client.remote);

  const PROMPT = '👤 ';
  const CONT = c.gray('… '); // 여러 줄 이어쓰기 프롬프트
  const completions = ['/help', '/status', '/soul', '/reset', 'exit', 'quit', ...souls.map((s) => `/soul ${s}`)];
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: PROMPT,
    completer: (line: string) => {
      const hits = completions.filter((cmd) => cmd.startsWith(line));
      return [hits.length ? hits : completions, line];
    },
  });
  rl.on('SIGINT', () => rl.close()); // Ctrl+C → 조용히 종료

  // async-iterator 로 읽는다: 명령 처리(네트워크 등) 도중 들어온 입력도 버퍼링돼 유실되지 않는다.
  let buffered: string[] = []; // 여러 줄 누적 버퍼
  rl.prompt();
  for await (const line of rl) {
    // 줄 끝 `\` → 다음 줄로 이어쓰기
    if (line.endsWith('\\')) {
      buffered.push(line.slice(0, -1));
      rl.setPrompt(CONT);
      rl.prompt();
      continue;
    }
    buffered.push(line);
    const input = buffered.join('\n').trim();
    buffered = [];

    const next = () => {
      rl.setPrompt(PROMPT);
      rl.prompt();
    };
    if (!input) {
      next();
      continue;
    }
    if (input === 'exit' || input === 'quit') break;
    if (input === '/help') {
      printHelp(souls);
      next();
      continue;
    }
    if (input === '/reset') {
      try {
        await client.reset(workspace);
        console.log(dim('세션 대화 맥락을 초기화했어요.\n'));
      } catch (err) {
        console.error(`${red('✗')} ${err instanceof Error ? err.message : String(err)}\n`);
      }
      next();
      continue;
    }
    try {
      await runTurn(client, input, workspace);
    } catch (err) {
      console.error(`${red('✗')} ${err instanceof Error ? err.message : String(err)}`);
    }
    console.log();
    next();
  }
  rl.close();
  console.log('\n안녕히 가세요 👋');
}

/** 단발 실행 — 인자로 준 한 줄만 처리하고 종료(스크립트 모드). */
async function oneShot(client: Client, text: string): Promise<void> {
  const info = await client.info();
  console.error(
    dim(`${client.remote ? 'remote' : 'server-less'} · intents=${info.intents} · skills=${info.skills}`),
  );
  await runTurn(client, text, process.cwd());
}

async function main() {
  const argv = process.argv.slice(2);
  const remote = argv.includes('--remote') || argv.includes('-r') || process.env.AGENT_REMOTE === '1';
  const text = argv.filter((a) => a !== '--remote' && a !== '-r').join(' ').trim();

  const client = remote ? remoteClient() : await inProcessClient();
  try {
    if (text) await oneShot(client, text);
    else await repl(client);
  } finally {
    client.close();
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`${red('✗')} ${msg}`);
  console.error(dim('힌트: Ollama(11434)가 떠 있고 chat·임베딩 모델이 로드됐는지,'));
  console.error(dim('      config/settings.yaml 의 profile·모델명도 확인하세요.'));
  console.error(dim('      remote 모드(agent/--remote)라면 먼저:  npm run server'));
  process.exit(1);
});
