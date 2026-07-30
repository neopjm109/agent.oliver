// settings.yaml / intents.yaml 로더
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import type { Settings, Intent, ProviderConfig } from './types.js';

const CONFIG_DIR = resolve(process.cwd(), 'config');

/** provider 설정 필수 필드 검증 — 오타/누락을 부팅 시점에 명확한 메시지로 잡는다. */
function validateProvider(p: unknown, label: string): ProviderConfig {
  if (!p || typeof p !== 'object') throw new Error(`settings.yaml: '${label}' 프로필이 없거나 형식이 잘못됐어요.`);
  const o = p as Record<string, unknown>;
  for (const key of ['baseURL', 'chatModel', 'embedModel'] as const) {
    if (typeof o[key] !== 'string' || !(o[key] as string).trim()) {
      throw new Error(`settings.yaml: '${label}.${key}' 는 비어 있지 않은 문자열이어야 해요.`);
    }
  }
  return p as ProviderConfig;
}

export function loadSettings(): Settings {
  const raw = parse(readFileSync(resolve(CONFIG_DIR, 'settings.yaml'), 'utf8')) as Record<string, unknown>;
  if (!raw || typeof raw !== 'object') throw new Error('settings.yaml 을 객체로 파싱하지 못했어요.');
  // AGENT_PROFILE 로 활성 프로필을 오버라이드(평가·벤치에서 한 프로세스로 m4↔m2 전환). 없으면 파일값.
  const envProfile = process.env.AGENT_PROFILE?.trim();
  if (envProfile) raw.profile = envProfile;
  if (raw.profile !== 'm4' && raw.profile !== 'm2') {
    throw new Error(`settings.yaml: 'profile' 은 'm4' 또는 'm2' 여야 해요 (현재: ${JSON.stringify(raw.profile)}).`);
  }
  // 활성 프로필만 엄격 검증(비활성 프로필의 사소한 결손으로 부팅을 막지 않는다).
  validateProvider(raw[raw.profile as 'm4' | 'm2'], raw.profile as string);
  const r = raw as Record<string, any>;
  if (!r.router || typeof r.router.directThreshold !== 'number' || typeof r.router.unknownThreshold !== 'number') {
    throw new Error("settings.yaml: 'router.directThreshold'·'router.unknownThreshold' 숫자 설정이 필요해요.");
  }
  if (!r.skills || typeof r.skills.root !== 'string') {
    throw new Error("settings.yaml: 'skills.root' 문자열 설정이 필요해요.");
  }
  return raw as unknown as Settings;
}

/** 현재 하드웨어 프로필의 모델 설정 반환 */
export function activeProvider(s: Settings): ProviderConfig {
  return s.profile === 'm2' ? s.m2 : s.m4;
}

export function loadIntents(): Intent[] {
  const raw = parse(readFileSync(resolve(CONFIG_DIR, 'intents.yaml'), 'utf8')) as Array<
    Record<string, unknown>
  >;
  return raw.map((r) => ({
    name: r.name as string,
    description: r.description as string | undefined,
    examples: (r.examples as string[]) ?? [],
    skill: (r.skill as string) ?? r.name, // 생략 시 intent명과 동일한 스킬
    slot: r.slot as Intent['slot'],
    notes: r.notes as string | undefined,
  }));
}
