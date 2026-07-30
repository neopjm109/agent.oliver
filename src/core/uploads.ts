// 메신저 업로드 파일을 로컬 임시 폴더에 저장 — 봇(텔레그램·슬랙)이 다운로드한 바이트를 여기 두고,
// 서버에는 그 절대경로만 넘긴다(TCP 로 바이트를 싣지 않음). 서버가 읽어 프롬프트에 인제스천한다.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';

/** chatId(채널/채팅방) 별 업로드 폴더. 세션 격리와 동일 키를 쓴다. */
export function uploadDir(chatId: string): string {
  const dir = join(tmpdir(), 'agent-uploads', chatId.replace(/[^\w-]/g, '_') || 'default');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * 업로드 바이트를 안전한 파일명으로 저장하고 절대경로를 반환한다.
 * 파일명은 basename + 화이트리스트로 정화(경로 탈출·특수문자 차단). 확장자는 인제스천 판정에 쓰이니 보존.
 */
export function saveUpload(chatId: string, fileName: string, data: Buffer | Uint8Array): string {
  const safe = basename(fileName).replace(/[^\w.\-]/g, '_') || `file_${Date.now()}`;
  const p = join(uploadDir(chatId), safe);
  writeFileSync(p, data);
  return p;
}

/** 결과물(문서) 출력 폴더 — 봇이 다시 첨부로 올리거나 CLI 가 경로로 안내한다. chatId 별 격리. */
export function outboxDir(chatId: string): string {
  const dir = join(tmpdir(), 'agent-outbox', chatId.replace(/[^\w-]/g, '_') || 'default');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * 표준명 base 에 날짜+순번을 붙여 dir 안에서 유일한 파일명을 만든다: `<stem>_YYYYMMDD_NN.<ext>`.
 * 표준 문서명이 반복돼도(설계서.md 를 매번 생성) 덮어쓰지 않고 정렬 가능한 이름으로 쌓인다.
 * 예: 설계서.md → 설계서_20260727_01.md, 같은 날 재생성 → 설계서_20260727_02.md.
 */
export function uniqueStamped(dir: string, base: string): string {
  const ext = extname(base);
  const stem = base.slice(0, base.length - ext.length) || base;
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  let i = 1;
  let name: string;
  do {
    name = `${stem}_${ymd}_${String(i).padStart(2, '0')}${ext}`;
    i++;
  } while (existsSync(join(dir, name)));
  return name;
}

/**
 * 문서형 결과물을 파일로 저장하고 절대경로를 반환한다. 표준명(설계서.md 등)에 날짜+순번을 붙여
 * (uniqueStamped) 반복 생성에도 덮어쓰지 않는다. 경로 탈출 문자는 정화, 한글은 보존.
 */
export function saveOutbox(chatId: string, fileName: string, content: string): string {
  const base = basename(fileName).replace(/[/\\?%*:|"<>\0]/g, '_').trim() || 'result.md';
  const dir = outboxDir(chatId);
  const p = join(dir, uniqueStamped(dir, base));
  writeFileSync(p, content, 'utf8');
  return p;
}
