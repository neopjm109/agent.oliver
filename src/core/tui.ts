// 터미널 출력 스타일 (순수 ANSI, 의존성 0). TS 쪽(cli.ts 등)에서 공유.
// bin/agent.mjs 는 dist/cli.js 를 로드하는 얇은 shim 이라 이 모듈을 그대로 재사용한다(사본 없음).
import type { AgentReply } from './types.js';

const canColor = (s: NodeJS.WriteStream): boolean => Boolean(s.isTTY) && !process.env.NO_COLOR;

const paint =
  (code: string) =>
  (str: unknown, stream: NodeJS.WriteStream = process.stderr): string =>
    canColor(stream) ? `\x1b[${code}m${str}\x1b[0m` : String(str);

export const dim = paint('2');
export const bold = paint('1');
export const cyan = paint('36');
export const green = paint('32');
export const yellow = paint('33');
export const red = paint('31');
export const gray = paint('90');

/** 대기 표시 스피너 (TTY 에서만). stop() 으로 라인 정리. */
export function spinner(label: string): { stop(): void } {
  if (!process.stderr.isTTY) return { stop() {} };
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const start = Date.now();
  let i = 0;
  const id = setInterval(() => {
    const secs = ((Date.now() - start) / 1000).toFixed(1);
    process.stderr.write(`\r${cyan(frames[i++ % frames.length])} ${dim(label)} ${gray(secs + 's')} `);
  }, 80);
  return {
    stop() {
      clearInterval(id);
      process.stderr.write('\r\x1b[K');
    },
  };
}

/** 터미널 렌더 입력 형태 (공용 AgentReply). */
export type Rendered = AgentReply;

/** intent 메타는 stderr, 응답 본문은 stdout. 파이프 시 본문은 거터 없이 raw. */
export function printResult(r: Rendered): void {
  if (r.error) {
    console.error(`${red('✗')} ${r.error}`);
    if (/unload|no models|load/i.test(r.error)) {
      console.error(dim('  힌트: LM Studio에서 chat·임베딩 모델을 로드하고, JIT 로딩 켜기 / 유휴 언로드(TTL) 끄기를 확인하세요.'));
    }
    return;
  }
  const sim = typeof r.sim === 'number' ? r.sim.toFixed(2) : '–';
  const amb = r.ambiguous ? yellow(' ~모호') : '';
  console.error(`${dim('┌')} ${cyan(r.intent ?? '?')} ${dim('· sim ' + sim)}${amb}`);
  if (process.stdout.isTTY) {
    const gut = dim('│ ', process.stdout);
    console.log(gut + (r.text ?? '').replace(/\n/g, '\n' + gut));
  } else {
    console.log(r.text ?? '');
  }
}
