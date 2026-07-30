import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PlanOrchestrator } from './orchestrator.js';
import type { Intent, Context, StagedPlan, PlanStep } from '../core/types.js';
import type { LLMClient } from '../core/llmClient.js';
import type { Runtime } from '../core/runtime.js';

const intents: Intent[] = [
  { name: 'research_topic', examples: ['조사해줘'], skill: 'researcher' },
  { name: 'write_proposal', examples: ['제안서 써줘'], skill: 'proposal-writer' },
  { name: 'design_system', examples: ['설계해줘'], skill: 'architect' },
  { name: 'scaffold_project', examples: ['프로젝트 만들어줘'], skill: 'project-scaffolder' },
  { name: 'write_docs', examples: ['문서 써줘'], skill: 'doc-writer' },
];

// chatJson 이 실패하는 가짜 LLM → buildPlan 이 heuristicPlan(결정론 폴백)으로 간다.
const failingLlm = { chatJson: async () => { throw new Error('planner down'); } } as unknown as LLMClient;
const getRuntime = () => undefined as unknown as Runtime;
const ctxFor = (userText: string): Context =>
  ({ userText, workspace: '/w', slots: {}, history: [], outputs: [], session: {} }) as unknown as Context;

test('heuristicPlan: LLM 실패 시 조사+제안서를 다단계로 복구(L6 gap) — 논리 순서', async () => {
  const orch = new PlanOrchestrator(failingLlm, intents, getRuntime);
  const ctx = ctxFor('결제 트렌드 조사하고 그걸로 제안서까지 만들어줘');
  const r = await orch.run(ctx);
  assert.equal(r.ok, true);
  const plan = ctx.session!.pendingPlan as StagedPlan;
  assert.deepEqual(plan.steps.map((s) => s.skill), ['research_topic', 'write_proposal']); // 이전엔 폴백 미커버 → null
});

test('heuristicPlan: 설계+문서도 폴백에서 순서대로 복구', async () => {
  const orch = new PlanOrchestrator(failingLlm, intents, getRuntime);
  const ctx = ctxFor('DB 스키마 설계하고 API 문서까지 작성해줘');
  await orch.run(ctx);
  const skills = (ctx.session!.pendingPlan as StagedPlan).steps.map((s) => s.skill);
  assert.ok(skills.includes('design_system') && skills.includes('write_docs'));
  assert.ok(skills.indexOf('design_system') < skills.indexOf('write_docs')); // 설계 → 문서 순서
});

test('heuristicPlan: 아무 신호 없으면 null → 정상 degrade 안내', async () => {
  const orch = new PlanOrchestrator(failingLlm, intents, getRuntime);
  const r = await orch.run(ctxFor('음 그냥 뭐 좀'));
  assert.equal(r.ok, false);
  assert.match(r.text ?? '', /여러 단계로 나눠/);
});

// ── A: MAX_STEPS 설정화(>4 가능) ──
const sixIntents: Intent[] = [
  { name: 'research_topic', examples: ['x'], skill: 'r' },
  { name: 'design_system', examples: ['x'], skill: 'a' },
  { name: 'write_docs', examples: ['x'], skill: 'd' },
  { name: 'review_code', examples: ['x'], skill: 'rc' },
  { name: 'write_proposal', examples: ['x'], skill: 'p' },
  { name: 'write_message', examples: ['x'], skill: 'm' },
];
const planningLlm = (steps: PlanStep[]): LLMClient =>
  ({ chatJson: async () => ({ goal: '테스트 목표', steps }) }) as unknown as LLMClient;
const sixSteps = sixIntents.map((i, k) => ({ skill: i.name, instruction: `단계${k + 1}` }));

test('maxSteps: 6 지정 시 6단계 계획 유지(4로 안 잘림)', async () => {
  const orch = new PlanOrchestrator(planningLlm(sixSteps), sixIntents, getRuntime, 6);
  const ctx = ctxFor('여섯 단계 요청');
  await orch.run(ctx);
  assert.equal((ctx.session!.pendingPlan as StagedPlan).steps.length, 6);
});

test('maxSteps: 기본 4면 6단계 요청도 4로 절단(저사양 안전장치)', async () => {
  const orch = new PlanOrchestrator(planningLlm(sixSteps), sixIntents, getRuntime); // 기본 4
  const ctx = ctxFor('여섯 단계 요청');
  await orch.run(ctx);
  assert.equal((ctx.session!.pendingPlan as StagedPlan).steps.length, 4);
});

// ── 맥락 유지: 단계별 산출물이 ctx.outputs 로 누적 전달(체이닝) ──
test('체이닝: 각 단계 실행 시 이전 단계 산출물이 누적 전달되고 완료 후 계획 정리', async () => {
  const ws = mkdtempSync(join(tmpdir(), 'orch-'));
  const steps = sixSteps.slice(0, 5);
  const seen: number[] = [];
  const runtime = {
    execute: async (intent: Intent, c: Context) => {
      seen.push(c.outputs.length); // 이 단계가 본 "이전 산출물 개수"
      return { ok: true, text: `OUT_${intent.name}` };
    },
  } as unknown as Runtime;
  const orch = new PlanOrchestrator(planningLlm(steps), sixIntents, () => runtime, 6);
  const ctx = { userText: '다섯 단계', workspace: ws, slots: {}, history: [], outputs: [], session: {} } as unknown as Context;
  await orch.run(ctx);
  for (let k = 0; k < 5; k++) await orch.continuePlan('응', ctx);
  assert.deepEqual(seen, [0, 1, 2, 3, 4]); // 단계 k 는 이전 k개 산출물을 본다(맥락 유지)
  assert.equal(ctx.session!.pendingPlan, undefined); // 완주 후 정리
});
