import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cosine, stripCodeForRouting } from './router.js';

test('cosine: 동일 벡터=1, 직교=0, 영벡터 안전(0)', () => {
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.equal(cosine([0, 0], [1, 1]), 0); // 0으로 나눔 → || 1 가드
});

test('stripCodeForRouting: 코드 꼬리를 걷어내되 앞 자연어는 보존', () => {
  assert.equal(stripCodeForRouting('이 코드 리뷰해줘 ```const x=1```').trim(), '이 코드 리뷰해줘');
  assert.equal(stripCodeForRouting('리팩터링 해줘 function foo() {}').trim(), '리팩터링 해줘');
  // 앞 자연어가 거의 없으면(코드가 지배) 원문 유지(빈 문자열로 만들지 않음)
  assert.ok(stripCodeForRouting('select * from t').length > 0);
  // 코드 신호가 없으면 그대로
  assert.equal(stripCodeForRouting('여행 계획 짜줘'), '여행 계획 짜줘');
});
