// 번역 — KO↔EN 중심(+일/중). MarkdownSkill 의 "한국어 강제" 래퍼를 우회하려 코드 경로에서 직접 chatText 로 돈다.
// 대상 언어는 발화에서 감지, 없으면 원문 언어의 반대로 자동 결정. 결과는 파일(첨부/장문) 또는 인라인.
import type { LLMClient } from './llmClient.js';

export interface TargetLang {
  code: string; // 파일명 접미사(en/ko/ja/zh)
  label: string; // 프롬프트·안내용(영어/한국어/…)
}

const LANGS: Array<{ re: RegExp; t: TargetLang }> = [
  { re: /영어|영문|english|\ben\b/i, t: { code: 'en', label: '영어(English)' } },
  { re: /한국어|한글|국문|korean|\bko\b/i, t: { code: 'ko', label: '한국어' } },
  { re: /일본어|일어|japanese|\bja\b/i, t: { code: 'ja', label: '일본어(日本語)' } },
  { re: /중국어|중문|chinese|\bzh\b/i, t: { code: 'zh', label: '중국어(中文)' } },
];

/** 발화에서 목표 언어를 감지. 없으면 null(→ autoTarget). */
export function detectTargetLang(text: string): TargetLang | null {
  for (const { re, t } of LANGS) if (re.test(text)) return t;
  return null;
}

/** 목표 미지정 시: 원문이 한글 위주면 영어로, 아니면 한국어로(가장 흔한 실무 쌍). */
export function autoTarget(source: string): TargetLang {
  const ko = (source.match(/[가-힣]/g) ?? []).length;
  const latin = (source.match(/[A-Za-z]/g) ?? []).length;
  return ko >= latin ? { code: 'en', label: '영어(English)' } : { code: 'ko', label: '한국어' };
}

/**
 * source(파일 내용 또는 사용자 발화)를 target 언어로 번역한다. 마크다운·코드·고유명사는 보존.
 * 발화에 "~로 번역해줘" 같은 지시가 섞여 있으면 지시는 빼고 대상 텍스트만 번역하도록 지시한다.
 */
export async function translateText(llm: LLMClient, source: string, target: TargetLang): Promise<string> {
  const sys =
    `You are a professional translator. Translate the user's text into ${target.label}.\n` +
    '- Output ONLY the translation. No notes, no preamble, no explanation.\n' +
    '- Preserve markdown structure, code blocks, inline code, numbers, URLs, tables, and proper nouns.\n' +
    '- Translate natural-language text only; keep code, identifiers, and file paths unchanged.\n' +
    "- If the input contains an instruction like '번역해줘'/'translate this', translate only the actual content, not the instruction.";
  return (await llm.chatText(sys, source)).trim();
}
