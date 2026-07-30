// 모델 출력 텍스트 후처리 공용 유틸.

/**
 * 프로미스에 상한 시간을 건다. ms 안에 안 끝나면 reject.
 * warm(인사·상태) 같은 "빠른 경로"에서 느린 LLM이 응답을 지연시키지 않도록 폴백 트리거로 쓴다.
 * (내부 fetch 는 계속 돌 수 있으나 결과를 안 기다릴 뿐 — 폴백이 즉시 응답한다.)
 */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer!: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms);
  });
  // p 가 먼저 끝나면 타이머를 지운다 — 안 지우면 최대 ms 동안 살아 있는 타이머가 이벤트 루프를 붙든다.
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

/** 모델이 파일/코드 내용을 코드펜스(```)로 감쌌으면 벗겨 순수 내용만 남긴다. */
export function stripFence(s: string): string {
  const t = s.trim();
  const m = t.match(/^```[\w.-]*\n([\s\S]*?)\n```$/);
  return m ? m[1] : t;
}

/**
 * 계획 단계 체이닝에서 "이전 단계 산출물"을 프롬프트에 실을 블록으로 만든다.
 * 단계 수가 늘어도 num_ctx 를 넘지 않도록 **총량 예산(total)** 을 두고, 뒤(최근)에서부터 채워
 * 최근 단계에 우선순위를 준다(다음 단계와 가장 관련↑). 예산 소진 시 오래된 단계는 앞부분만/생략.
 * (LLM 요약 호출 없이 결정론으로 압축 — 단계당 고정 절단이 누적돼 컨텍스트를 넘치게 하던 문제 해결.)
 */
export function priorOutputsBlock(
  outputs: Array<{ skill: string; result: { text?: string } }>,
  opts: { perStep?: number; total?: number } = {},
): string {
  const perStep = opts.perStep ?? 700;
  const total = opts.total ?? 2800;
  const parts = new Array<string>(outputs.length);
  let used = 0;
  for (let i = outputs.length - 1; i >= 0; i--) {
    const text = outputs[i].result.text ?? '';
    const head = `## ${i + 1}. ${outputs[i].skill}\n`;
    const budget = Math.max(0, Math.min(perStep, total - used));
    if (budget <= 0) {
      parts[i] = head + '…(이전 단계 — 지면 관계상 생략, plan 상태엔 원문 보존)';
    } else {
      const slice = text.slice(0, budget);
      parts[i] = head + slice + (text.length > budget ? '…' : '');
      used += slice.length;
    }
  }
  return parts.join('\n\n');
}
