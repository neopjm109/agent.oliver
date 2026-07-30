import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareScaffold } from './step.js';
import { scaffoldDirName } from './executor.js';

test('prepareScaffold: exec 커밋에 올바른 projectDir 을 담는다(argv 역추론 금지 회귀)', () => {
  // nest/next/tauri 는 argv 마지막 원소가 프로젝트 이름이 아니다(--yes/npm 등).
  // 과거 commitExec 가 argv[last] 로 폴더명을 역추론해 lastProjectDir 이 '--yes'/'npm' 으로 잘못
  // 잡혔다. 이제 빌드 시점의 projectDir(=scaffoldDirName)을 커밋에 실어 넘긴다.
  const cases: Array<[string, string]> = [
    ['spring', 'MyApp'],
    ['django', 'Blog'],
    ['flutter', 'MyApp'],
    ['nextjs', 'MyApp'],
    ['nestjs', 'MyApp'],
    ['tauri', 'MyApp'],
  ];
  for (const [fw, name] of cases) {
    const p = prepareScaffold(fw, name, '/ws');
    assert.equal(p.kind, 'mutate', `${fw} 는 mutate 여야`);
    if (p.kind !== 'mutate' || p.commit.type !== 'exec') throw new Error(`${fw}: exec mutate 기대`);
    assert.equal(p.commit.projectDir, scaffoldDirName(fw, name), `${fw}: projectDir 이 스캐폴더 실제 폴더명과 일치해야`);
  }
});

test('prepareScaffold: 이름이 argv 마지막이 아닌 스캐폴더는 projectDir≠argv[last] (회귀 방어)', () => {
  for (const fw of ['nextjs', 'nestjs', 'tauri']) {
    const p = prepareScaffold(fw, 'MyApp', '/ws');
    if (p.kind !== 'mutate' || p.commit.type !== 'exec') throw new Error(`${fw}: exec mutate 기대`);
    const last = p.commit.argv[p.commit.argv.length - 1];
    assert.notEqual(p.commit.projectDir, last, `${fw}: projectDir 이 argv 마지막(${last})과 달라야 (역추론 버그 재현 방지)`);
    assert.equal(p.commit.projectDir, 'myapp', `${fw}: npm 계열은 소문자 폴더명`);
  }
});

test('prepareScaffold: 잘못된 이름/미지원 프레임워크는 error', () => {
  assert.equal(prepareScaffold('spring', '1bad', '/ws').kind, 'error'); // 숫자 시작 이름
  assert.equal(prepareScaffold('unknown-fw', 'app', '/ws').kind, 'error'); // 미지원 프레임워크
});
