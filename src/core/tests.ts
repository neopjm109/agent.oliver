// 테스트 생성 — 소스 파일에서 테스트 프레임워크·테스트 파일 경로를 결정론으로 정하고(환각 0),
// LLM 이 그 프레임워크 관례로 테스트 코드를 생성한다. 저장은 pipeline 이 확인 게이트로 처리.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LLMClient } from './llmClient.js';
import { stripFence } from './text.js';

export interface TestTarget {
  framework: string; // 표시·프롬프트용(예: "node:test", "pytest", "JUnit 5")
  testPath: string; // 생성할 테스트 파일 경로(workspace 기준 상대)
  hint: string; // 프레임워크 import/관례 한 줄 힌트(소형 모델 안정화)
}

/** JS/TS 테스트 러너 감지 — package.json devDeps. 없으면 node:test(내장, 이 프로젝트 기본). */
function jsRunner(workspace: string): { framework: string; hint: string } {
  try {
    const pkg = JSON.parse(readFileSync(join(workspace, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.vitest) return { framework: 'vitest', hint: "import { describe, it, expect } from 'vitest' 를 쓴다." };
    if (deps.jest || deps['@jest/globals']) return { framework: 'jest', hint: 'describe/it/expect 전역을 쓴다(jest).' };
  } catch {
    /* package.json 없음/파싱 실패 → 내장 러너 */
  }
  return { framework: 'node:test', hint: "import { test } from 'node:test'; import assert from 'node:assert/strict' 를 쓴다." };
}

/** 소스 파일 경로·확장자로 테스트 프레임워크와 테스트 파일 경로를 결정. 미지원 언어면 null. */
export function detectTestTarget(sourcePath: string, workspace: string): TestTarget | null {
  const ext = (sourcePath.split('.').pop() ?? '').toLowerCase();
  const dir = sourcePath.includes('/') ? sourcePath.slice(0, sourcePath.lastIndexOf('/') + 1) : '';
  const base = sourcePath.slice(dir.length);
  const stem = base.replace(/\.[^.]+$/, '');

  if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
    const { framework, hint } = jsRunner(workspace);
    return { framework, hint, testPath: `${dir}${stem}.test.${ext}` };
  }
  if (ext === 'py') {
    return { framework: 'pytest', hint: 'pytest 스타일(test_* 함수, assert 문). 필요한 import 는 소스 기준.', testPath: `${dir}test_${stem}.py` };
  }
  if (ext === 'go') {
    return { framework: 'go test', hint: 'package 는 소스와 동일, func TestXxx(t *testing.T), 표준 testing 패키지.', testPath: `${dir}${stem}_test.go` };
  }
  if (ext === 'java') {
    // src/main/java/... → src/test/java/... , Foo.java → FooTest.java
    const testDir = dir.includes('/main/') ? dir.replace('/main/', '/test/') : dir;
    return { framework: 'JUnit 5', hint: 'JUnit 5(@Test, org.junit.jupiter.api), AssertJ 있으면 assertThat.', testPath: `${testDir}${stem}Test.java` };
  }
  if (ext === 'kt') {
    const testDir = dir.includes('/main/') ? dir.replace('/main/', '/test/') : dir;
    return { framework: 'JUnit 5 (Kotlin)', hint: 'JUnit 5 + kotlin.test.', testPath: `${testDir}${stem}Test.kt` };
  }
  if (ext === 'dart') {
    const testDir = dir.startsWith('lib/') ? dir.replace(/^lib\//, 'test/') : dir;
    return { framework: 'flutter test', hint: "package:test/test.dart (또는 flutter_test), main() 안 test('...', () {}).", testPath: `${testDir}${stem}_test.dart` };
  }
  return null;
}

/** JS/TS 소스에서 named export 심볼을 뽑는다(함수·const/let/var·class + `export { a, b }`). */
function jsExports(source: string): string[] {
  const names = new Set<string>();
  const push = (re: RegExp) => { for (const m of source.matchAll(re)) if (m[1]) names.add(m[1]); };
  push(/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g);
  push(/export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g);
  push(/export\s+(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g);
  for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/i).pop()?.trim();
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  return [...names];
}

/** JS/TS 인가(=import 주입 대상). */
const JS_EXT = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs']);

/** 소스에 대한 테스트 코드를 생성한다. 출력이 잘리면(truncated) 예외(저장 시 반쪽 테스트 방지). */
export async function generateTests(llm: LLMClient, sourcePath: string, source: string, target: TestTarget): Promise<string> {
  const ext = (sourcePath.split('.').pop() ?? '').toLowerCase();
  const base = sourcePath.slice(sourcePath.lastIndexOf('/') + 1);
  const stem = base.replace(/\.[^.]+$/, '');
  // JS/TS 는 소스가 테스트 파일과 같은 폴더 → 상대 import 를 결정론으로 계산(ESM 관례 `.js`).
  const exports = JS_EXT.has(ext) ? jsExports(source) : [];
  const moduleSpec = `./${stem}.js`;
  const importLine =
    exports.length ? `import { ${exports.join(', ')} } from '${moduleSpec}';` : '';

  const sys =
    `너는 숙련 테스트 작성자다. 아래 소스에 대한 단위 테스트를 ${target.framework} 로 작성한다.\n` +
    `- ${target.hint}\n` +
    (importLine ? `- 소스의 export: ${exports.join(', ')}. 반드시 다음 import 로 대상 심볼을 가져온다: \`${importLine}\`\n` : '') +
    '- 핵심 동작·경계조건·예외/에러 경로를 커버한다. 실제로 컴파일·실행되는 코드만 낸다.\n' +
    '- 존재하지 않는 함수/모듈을 지어내지 않는다. 소스에 실제로 있는 export 만 테스트한다.\n' +
    '- 설명·머리말·코드펜스 없이 테스트 파일 전체 내용만 출력한다.';
  const user = `소스 경로: ${sourcePath}\n테스트 파일: ${target.testPath}\n\n[소스]\n${source.slice(0, 12000)}`;
  const { text, truncated } = await llm.chatTextFull(sys, user, 4096, llm.coderModel);
  if (truncated) throw new Error('테스트가 출력 한도에서 잘렸어요. 소스를 더 작은 단위로 나눠 요청해 주세요.');
  let code = stripFence(text);

  // 안전망: JS/TS 인데 대상 심볼 import 가 빠졌으면(소형 모델의 흔한 누락) 결정론으로 앞에 주입한다.
  //  — 이미 어떤 형태로든 import 했으면(다른 경로 포함) 중복 주입하지 않는다.
  if (importLine) {
    const importArea = code.split('\n').filter((l) => /^\s*import\b|require\s*\(/.test(l)).join('\n');
    const alreadyImported = exports.some((n) => new RegExp(`\\b${n}\\b`).test(importArea));
    if (!alreadyImported) code = `${importLine}\n${code}`;
  }
  return code;
}
