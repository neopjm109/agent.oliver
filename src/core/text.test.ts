import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripFence, withTimeout, priorOutputsBlock } from './text.js';

test('stripFence: 코드펜스로 감싼 내용만 남긴다', () => {
  assert.equal(stripFence('```ts\nconst x = 1;\n```'), 'const x = 1;');
  assert.equal(stripFence('```\nhello\n```'), 'hello');
  assert.equal(stripFence('그냥 텍스트'), '그냥 텍스트'); // 펜스 없으면 그대로(trim)
  assert.equal(stripFence('  여백  '), '여백');
});

test('withTimeout: 제한 내 완료는 값 반환, 초과는 timeout reject', async () => {
  assert.equal(await withTimeout(Promise.resolve(42), 1000), 42);
  await assert.rejects(
    withTimeout(new Promise((r) => setTimeout(() => r('late'), 100)), 10),
    /timeout 10ms/,
  );
});

test('withTimeout: 빠른 완료 후 타이머를 정리해 이벤트 루프를 붙들지 않는다', async () => {
  // 타이머가 정리되지 않으면 이 테스트(짧은 p, 긴 timeout)가 5초 뒤까지 프로세스를 살려둔다.
  // 정리되면 즉시 반환 후 대기 중인 타이머가 없다.
  assert.equal(await withTimeout(Promise.resolve('ok'), 5000), 'ok');
});

test('priorOutputsBlock: 총량 예산으로 num_ctx 넘침 방지 — 최근 단계 우선', () => {
  const mk = (skill: string, n: number) => ({ skill, result: { text: 'x'.repeat(n) } });
  // 6단계 × 각 2000자. 고정 700절단이면 6×700=4200자로 누적되지만, 총량 2800 예산으로 묶인다.
  const outs = [mk('a', 2000), mk('b', 2000), mk('c', 2000), mk('d', 2000), mk('e', 2000), mk('f', 2000)];
  const block = priorOutputsBlock(outs, { perStep: 700, total: 2800 });
  const bodyLen = block.replace(/## \d+\. \w+\n/g, '').replace(/…\(이전 단계[^\n]*\)/g, '').replace(/…/g, '').replace(/\n\n/g, '').length;
  assert.ok(bodyLen <= 2800, `본문 총량 ${bodyLen} ≤ 2800`);
  // 최근 단계(f, 6번)는 700자 실림, 오래된 단계는 예산 소진 시 생략
  assert.match(block, /## 6\. f\nx{700}/);
  assert.match(block, /## 1\. a\n…\(이전 단계/);
  // 순서·헤더 보존(1..6)
  assert.ok(block.indexOf('## 1.') < block.indexOf('## 6.'));
});

test('priorOutputsBlock: 예산 내면 전부 싣고 절단 표시 없음', () => {
  const outs = [{ skill: 'design', result: { text: '짧은 설계' } }, { skill: 'code', result: { text: '짧은 코드' } }];
  const block = priorOutputsBlock(outs);
  assert.match(block, /## 1\. design\n짧은 설계/);
  assert.match(block, /## 2\. code\n짧은 코드/);
  assert.ok(!block.includes('…'));
});
