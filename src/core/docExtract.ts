// 바이너리 문서(pdf/docx/pptx/xlsx…) 텍스트 추출 — officeparser 를 지연 로드해 best-effort 로 뽑는다.
// 실패(손상·미지원·의존성 부재)하면 null → 상위(인제스천)가 조용히 건너뛰고 붙여넣기 폴백에 맡긴다.

/** officeparser 가 다루는 바이너리 문서 확장자 (텍스트로 직접 못 읽어 추출이 필요한 것). */
const BINARY_DOC_EXT = new Set(['pdf', 'docx', 'pptx', 'xlsx', 'xls', 'odt', 'odp', 'ods']);

/** 확장자가 바이너리 문서(추출 대상)인지. */
export function isBinaryDoc(ext: string): boolean {
  return BINARY_DOC_EXT.has(ext.toLowerCase());
}

/**
 * 절대경로의 바이너리 문서에서 텍스트를 추출한다. 지연 import(officeparser)라 이 경로가
 * 실제로 불릴 때만 로드된다(앱 시작·다른 경로에는 영향 없음). 어떤 이유로든 실패하면 null.
 */
export async function extractDocText(absPath: string): Promise<string | null> {
  try {
    const op: any = await import('officeparser');
    const parseOffice = op.parseOffice ?? op.default?.parseOffice;
    if (typeof parseOffice !== 'function') return null;
    const result = await parseOffice(absPath);
    // v7: parseOffice → 결과 객체(.toText()). 구버전/변형 대비 문자열 반환도 수용.
    const raw =
      result && typeof result.toText === 'function'
        ? await result.toText()
        : typeof result === 'string'
          ? result
          : '';
    const text = String(raw ?? '').replace(/\r\n/g, '\n').trim();
    return text || null;
  } catch {
    return null; // 손상/미지원/추출 실패 → 붙여넣기 폴백
  }
}
