// 실행·검증 — 테스트/빌드/린트/타입체크를 화이트리스트로 "결정론 조립"해 argv 를 만든다.
// 사용자 발화에서 임의 명령을 절대 실행하지 않는다(주입 불가): 액션(test/build/lint/typecheck)만 뽑고,
// 실제 명령은 프로젝트 스택+설정(package.json scripts·gradlew 등)에서 코드가 정한다. 실행은 commitStep(exec).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectStack } from './deploy.js';

export type RunAction = 'test' | 'build' | 'lint' | 'typecheck';

/** 발화에서 실행할 액션을 뽑는다. 못 정하면 null(→ 되묻기). */
export function detectRunAction(text: string): RunAction | null {
  if (/타입\s*체크|타입\s*검사|typecheck|\btsc\b/i.test(text)) return 'typecheck';
  if (/린트|린팅|\blint\b/i.test(text)) return 'lint';
  if (/빌드|\bbuild\b|컴파일/i.test(text)) return 'build';
  if (/테스트|test\b|유닛|단위\s*검증/i.test(text)) return 'test';
  return null;
}

export interface ResolvedCommand {
  argv: string[];
  label: string;
  timeoutMs: number;
}

function pkgScripts(workspace: string): Record<string, string> {
  try {
    const pkg = JSON.parse(readFileSync(join(workspace, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
    return pkg.scripts ?? {};
  } catch {
    return {};
  }
}

/**
 * 스택+액션 → 실행할 argv. 지원 안 하거나 스크립트가 없으면 {error}.
 * node 계열은 package.json scripts 에 실제 존재하는 것만 실행(없으면 정직하게 거부).
 */
export function resolveRunCommand(workspace: string, action: RunAction): ResolvedCommand | { error: string } {
  const stack = detectStack(workspace);
  const gw = existsSync(join(workspace, 'gradlew')) ? './gradlew' : 'gradle';
  const T = { test: 300_000, build: 300_000, lint: 120_000, typecheck: 180_000 }[action];

  // Node 계열 — package.json scripts 기반.
  if (stack === 'node' || stack === 'nextjs' || stack === 'nestjs' || stack === 'tauri') {
    const scripts = pkgScripts(workspace);
    if (action === 'typecheck') {
      if (scripts.typecheck) return { argv: ['npm', 'run', 'typecheck'], label: 'npm run typecheck', timeoutMs: T };
      if (existsSync(join(workspace, 'tsconfig.json'))) return { argv: ['npx', '--no-install', 'tsc', '--noEmit'], label: 'npx tsc --noEmit', timeoutMs: T };
      return { error: 'typecheck 스크립트나 tsconfig.json 이 없어요.' };
    }
    if (scripts[action]) return { argv: ['npm', 'run', action], label: `npm run ${action}`, timeoutMs: T };
    return { error: `package.json 에 "${action}" 스크립트가 없어요. (scripts 에 추가하거나 다른 액션을 말씀해 주세요)` };
  }
  if (stack === 'spring') {
    if (action === 'test') return { argv: [gw, 'test'], label: `${gw} test`, timeoutMs: T };
    if (action === 'build') return { argv: [gw, 'build', '-x', 'test'], label: `${gw} build -x test`, timeoutMs: T };
    if (action === 'typecheck') return { argv: [gw, 'compileJava'], label: `${gw} compileJava`, timeoutMs: T };
    return { error: 'Spring 에서는 test·build·typecheck 만 지원해요(lint 는 프로젝트 설정에 따라 달라요).' };
  }
  if (stack === 'django') {
    if (action === 'test') return { argv: ['python', 'manage.py', 'test'], label: 'python manage.py test', timeoutMs: T };
    return { error: 'Django 에서는 test 만 지원해요(빌드 개념 없음).' };
  }
  if (stack === 'flutter') {
    if (action === 'test') return { argv: ['flutter', 'test'], label: 'flutter test', timeoutMs: T };
    if (action === 'typecheck') return { argv: ['flutter', 'analyze'], label: 'flutter analyze', timeoutMs: T };
    return { error: 'Flutter 빌드는 배포(setup_deployment)에서 다뤄요. 여기선 test·analyze 만.' };
  }
  if (stack === 'go') {
    if (action === 'test') return { argv: ['go', 'test', './...'], label: 'go test ./...', timeoutMs: T };
    if (action === 'build') return { argv: ['go', 'build', './...'], label: 'go build ./...', timeoutMs: T };
    if (action === 'typecheck' || action === 'lint') return { argv: ['go', 'vet', './...'], label: 'go vet ./...', timeoutMs: T };
    return { error: 'Go 에서는 test·build·vet 만 지원해요.' };
  }
  return { error: '실행할 스택을 못 찾았어요. 프로젝트 루트(작업 폴더)에서 실행했는지 확인해 주세요.' };
}
