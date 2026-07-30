// 문서 변환 — 목표 포맷 감지 + LLM 내용 정형 + 패키징(오피스=pandoc / 텍스트=직접 저장).
// pandoc 은 스캐폴드와 동일하게 화이트리스트 execFile(셸 미개입). 미설치/실패 시 마크다운 폴백 + 안내.
import { execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { LLMClient } from './llmClient.js';
import { stripFence } from './text.js';
import { saveOutbox, outboxDir, uniqueStamped } from './uploads.js';

export interface ConvertTarget {
  ext: string;
  label: string;
  /** LLM 이 낼 중간 형식(오피스는 markdown → pandoc). */
  kind: 'markdown' | 'csv' | 'json' | 'text';
  /** true 면 pandoc 등 외부 도구로 패키징(텍스트가 아닌 산출). */
  office: boolean;
}

/** 마크다운(md) 은 텍스트라 pandoc 불필요 — office:false 로 직접 저장. */
const TARGETS: Array<{ re: RegExp; t: ConvertTarget }> = [
  { re: /워드|\bdocx\b|ms\s*word|doc\s*(문서|파일)/i, t: { ext: 'docx', label: '워드(docx)', kind: 'markdown', office: true } },
  { re: /파워포인트|피피티|\bpptx?\b|슬라이드/i, t: { ext: 'pptx', label: '파워포인트(pptx)', kind: 'markdown', office: true } },
  { re: /\bpdf\b|피디에프/i, t: { ext: 'pdf', label: 'PDF', kind: 'markdown', office: true } },
  { re: /엑셀|\bxlsx?\b|스프레드시트/i, t: { ext: 'xlsx', label: '엑셀(xlsx)', kind: 'csv', office: true } },
  { re: /\bhtml\b|웹\s*페이지/i, t: { ext: 'html', label: 'HTML', kind: 'markdown', office: true } },
  { re: /마크다운|\bmarkdown\b|\bmd\b|md\s*로|\.md/i, t: { ext: 'md', label: '마크다운(md)', kind: 'markdown', office: false } },
  { re: /\bcsv\b/i, t: { ext: 'csv', label: 'CSV', kind: 'csv', office: false } },
  { re: /제이슨|\bjson\b/i, t: { ext: 'json', label: 'JSON', kind: 'json', office: false } },
  { re: /텍스트|\btxt\b|\.txt|평문/i, t: { ext: 'txt', label: '텍스트(txt)', kind: 'text', office: false } },
];

/** 목표 형식이 없으면 null (호출부가 기본값 결정). */
export function detectConvertTarget(text: string): ConvertTarget | null {
  // 목표 감지 오염 방지: 원본을 가리키는 토큰은 먼저 지운다(목표는 보통 "…로/으로" 자리라 보존됨).
  //  (a) 파일명("sample.md 를 …")의 확장자,  (b) 포맷 단어("엑셀을 csv로"의 '엑셀을') —
  //  둘 다 목적어/주어 자리(를·을·은·는·이·가·파일·문서·from 앞)에 오는 경우만.
  const SRC_SUFFIX = '(?=\\s*(?:를|을|은|는|이|가|파일|문서|from))';
  const FMT = '워드|docx|파워포인트|피피티|pptx?|슬라이드|pdf|피디에프|엑셀|xlsx?|스프레드시트|html|마크다운|markdown|md|csv|제이슨|json|텍스트|txt|평문';
  const cleaned = text
    .replace(new RegExp(`[\\w.\\-/]+\\.[A-Za-z0-9]{1,5}${SRC_SUFFIX}`, 'gi'), ' ')
    // 앞 경계는 \b 대신 lookbehind — \b 는 한글("엑셀")에서 동작하지 않는다. 뒷경계는 SRC_SUFFIX.
    .replace(new RegExp(`(?<![A-Za-z0-9가-힣])(?:${FMT})${SRC_SUFFIX}`, 'gi'), ' ');
  for (const { re, t } of TARGETS) if (re.test(cleaned)) return t;
  return null;
}

/** 목표 미지정 시 기본값 — 가장 안전하고 손실 없는 마크다운. */
export const DEFAULT_TARGET: ConvertTarget = { ext: 'md', label: '마크다운(md)', kind: 'markdown', office: false };

const KIND_FORMAT: Record<ConvertTarget['kind'], string> = {
  markdown: '마크다운(제목·목록·표는 GFM 문법). 전체를 코드펜스로 감싸지 마라.',
  csv: 'CSV(첫 줄 헤더, 쉼표 구분, 필요한 셀은 큰따옴표). 표 데이터만.',
  json: '유효한 JSON 하나만.',
  text: '평문 텍스트(마크다운 기호 없이).',
};

/**
 * 입력 문서를 목표 형식으로 정형한다. 샘플이 있으면 그 "구조·섹션 구성·항목 순서·표기"를 따르되
 * 내용은 입력에서 가져와 그 틀에 맞춘다(구조 기반 변환). 없으면 내용 보존 단순 변환.
 */
export async function shapeContent(
  llm: LLMClient,
  input: string,
  target: ConvertTarget,
  request: string,
  sample?: string,
): Promise<string> {
  const fmt = KIND_FORMAT[target.kind];
  const sys = sample
    ? '너는 문서 변환기다. [샘플]의 구조·섹션 구성·항목 순서·표기 방식을 그대로 따르되, 내용은 [입력]에서 ' +
      '가져와 그 틀에 맞춰 재구성한다.\n- 샘플에 있는 섹션이 입력에 없으면 비워두거나 생략하고, 없는 내용을 지어내지 않는다.\n' +
      `- 출력 형식: ${fmt}\n- 설명·머리말 없이 변환 결과만 출력한다.`
    : '너는 문서 변환기다. [입력] 문서의 내용을 보존하면서 요청한 형식으로 변환한다.\n' +
      `- 내용을 임의로 늘리거나 줄이지 않는다.\n- 출력 형식: ${fmt}\n- 설명·머리말 없이 변환 결과만 출력한다.`;
  const user =
    (sample ? `[샘플 — 이 형식/구조를 따르라]\n${sample.slice(0, 6000)}\n\n` : '') +
    `[입력 — 이 내용을 변환]\n${input.slice(0, 12000)}\n\n요청: ${request}`;
  return stripFence(await llm.chatText(sys, user));
}

/** pandoc 실행 (화이트리스트). inputPath(md) → outputPath. referenceDoc: docx 스타일 템플릿(선택). */
function runPandoc(inputPath: string, outputPath: string, referenceDoc?: string): Promise<{ ok: boolean; notFound?: boolean; error?: string }> {
  const args = [inputPath, '-o', outputPath, '--standalone'];
  if (referenceDoc && outputPath.endsWith('.docx')) args.push(`--reference-doc=${referenceDoc}`);
  return new Promise((resolve) => {
    execFile('pandoc', args, { timeout: 60_000, maxBuffer: 16 * 1024 * 1024 }, (err) => {
      if (!err) return resolve({ ok: true });
      const e = err as NodeJS.ErrnoException;
      if (e.code === 'ENOENT') return resolve({ ok: false, notFound: true });
      resolve({ ok: false, error: (err as Error).message.split('\n').slice(0, 4).join('\n') });
    });
  });
}

/**
 * 정형된 내용을 목표 포맷 파일로 만든다. 텍스트형은 그대로 저장, 오피스형은 pandoc.
 * 실패/미설치는 마크다운으로 폴백하고 안내를 반환한다(조용히 실패하지 않음). {files, note} 반환.
 */
export async function packageConversion(
  chatId: string,
  stem: string,
  content: string,
  target: ConvertTarget,
): Promise<{ files: string[]; note: string }> {
  // 엑셀 직접 생성은 pandoc 이 못 한다 → CSV 로(엑셀에서 바로 열림).
  if (target.ext === 'xlsx') {
    const p = saveOutbox(chatId, `${stem}.csv`, content);
    return { files: [p], note: `✅ 엑셀 직접 생성은 지원하지 않아 CSV 로 냈어요(엑셀에서 바로 열려요): ${basename(p)}` };
  }
  // 텍스트형(md/txt/csv/json) — 그대로 저장.
  if (!target.office) {
    const p = saveOutbox(chatId, `${stem}.${target.ext}`, content);
    return { files: [p], note: `✅ ${target.label} 로 변환했어요: ${basename(p)}` };
  }
  // 오피스형(docx/pptx/pdf/html) — 중간 마크다운 → pandoc.
  const tmp = mkdtempSync(join(tmpdir(), 'agent-convert-'));
  const mdPath = join(tmp, `${stem}.md`);
  writeFileSync(mdPath, content, 'utf8');
  const dir = outboxDir(chatId);
  const outName = uniqueStamped(dir, `${stem}.${target.ext}`);
  const outPath = join(dir, outName);
  const r = await runPandoc(mdPath, outPath);
  if (r.ok) return { files: [outPath], note: `✅ ${target.label} 로 변환했어요: ${outName}` };
  if (r.notFound) {
    const p = saveOutbox(chatId, `${stem}.md`, content);
    return {
      files: [p],
      note:
        `⚠️ pandoc 이 설치돼 있지 않아 ${target.label} 로는 못 만들고 마크다운으로 저장했어요.\n` +
        `설치: brew install pandoc (macOS) · apt install pandoc (Linux) · https://pandoc.org/installing`,
    };
  }
  // pdf 는 LaTeX 엔진 부재로 자주 실패 → 워드(docx)로 대체 시도.
  if (target.ext === 'pdf') {
    const docxName = uniqueStamped(dir, `${stem}.docx`);
    const docxPath = join(dir, docxName);
    const r2 = await runPandoc(mdPath, docxPath);
    if (r2.ok) return { files: [docxPath], note: `⚠️ PDF 변환에 실패해(보통 LaTeX 엔진 부재) 워드(docx)로 냈어요: ${docxName}` };
  }
  const p = saveOutbox(chatId, `${stem}.md`, content);
  return { files: [p], note: `⚠️ ${target.label} 변환에 실패해 마크다운으로 저장했어요.\n(pandoc: ${r.error ?? '알 수 없는 오류'})` };
}
