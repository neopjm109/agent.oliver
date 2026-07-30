#!/usr/bin/env node
// 전역 CLI — 얇은 런처(shim). 실제 로직·TUI 는 dist/cli.js(= src/cli.ts 빌드본) 한 곳에 있다.
// 전역 `agent` 는 상주 서버(TCP)로 요청하는 remote 모드로 cli 를 띄운다.
//   agent "메시지"  → one-shot   |   agent  → 대화형 REPL
//   준비:  npm run build   그리고   npm run server
//   설치:  npm link   또는   npm i -g .
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

process.env.AGENT_REMOTE = process.env.AGENT_REMOTE ?? '1'; // 전역 agent 기본값 = remote (override 가능)

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, '..', 'dist', 'cli.js');
try {
  await import(pathToFileURL(entry).href); // cli.js 가 process.argv 를 그대로 읽어 실행
} catch (err) {
  if (err && err.code === 'ERR_MODULE_NOT_FOUND') {
    console.error('\x1b[31m✗\x1b[0m 빌드 산출물이 없습니다 (dist/cli.js). 먼저 빌드하세요:  npm run build');
    process.exit(1);
  }
  throw err;
}
