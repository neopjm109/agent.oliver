// 슬랙 봇 — 서버(TCP)의 얇은 클라이언트. Socket Mode(공개 URL 불필요)로 동작한다.
// 채널/DM 메시지와 파일 업로드를 받아, 텔레그램과 같은 requestAgent 경로로 서버에 넘긴다.
// 세션 키 = 채널 id(멀티턴 유지). 파일은 url_private 를 봇 토큰으로 내려받아 로컬 저장 후 경로 전달.
import { createReadStream } from 'node:fs';
import { basename } from 'node:path';
import { App } from '@slack/bolt';
import { requestAgent } from './core/client.js';
import { saveUpload } from './core/uploads.js';

/** 문서 첨부에 붙일 짧은 캡션 — 첫 줄(제목)만. 전체 내용은 파일에. */
function shortCaption(text: string): string {
  const title = (text.split('\n').map((s) => s.trim()).find(Boolean) ?? '').replace(/^#+\s*/, '');
  const head = title ? `📄 ${title}` : '📄 결과 문서예요';
  return `${head}\n(전체 내용은 첨부 문서를 확인하세요)`;
}

interface SlackFile {
  id: string;
  name?: string;
  url_private_download?: string;
  url_private?: string;
}
interface SlackMsg {
  text?: string;
  channel?: string;
  user?: string;
  bot_id?: string;
  subtype?: string;
  files?: SlackFile[];
}

export function createSlackApp(botToken: string, appToken: string) {
  const app = new App({ token: botToken, appToken, socketMode: true });

  app.message(async ({ message, say, client }) => {
    const m = message as SlackMsg;
    if (m.bot_id || m.subtype === 'bot_message') return; // 봇/자기 메시지 무시(루프 방지)
    const chatId = m.channel ?? m.user ?? 'slack';
    // 채널에서 붙는 선두 멘션(<@U…>) 제거.
    const text = (m.text ?? '').replace(/^\s*<@[^>]+>\s*/, '').trim();

    // 첨부 다운로드 — url_private 는 인증 필요(봇 토큰).
    const attachments: string[] = [];
    for (const f of m.files ?? []) {
      const url = f.url_private_download ?? f.url_private;
      if (!url) continue;
      try {
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${botToken}` } });
        if (!resp.ok) continue;
        attachments.push(saveUpload(chatId, f.name ?? f.id, Buffer.from(await resp.arrayBuffer())));
      } catch {
        /* 개별 첨부 실패는 건너뛴다 */
      }
    }
    if (!text && attachments.length === 0) return;

    const prompt = text || '첨부한 파일 내용을 분석해줘';
    try {
      const res = await requestAgent(prompt, { chatId, attachments: attachments.length ? attachments : undefined });
      if (res.error) {
        await say(`⚠️ 오류: ${res.error}`);
        return;
      }
      const skills = res.skills ?? [];
      const footer = skills.length ? `\n\n🛠 사용한 스킬: ${skills.join(', ')}` : '';
      // 문서형 결과물이 파일로 왔으면 채널에 파일 업로드(짧은 캡션만), 아니면 텍스트 답신.
      if (res.files?.length) {
        const comment = shortCaption(res.text ?? '') + footer;
        for (const f of res.files) {
          await client.filesUploadV2({ channel_id: chatId, initial_comment: comment, file: createReadStream(f), filename: basename(f) });
        }
      } else {
        await say((res.text || '(빈 응답)') + footer);
      }
    } catch (err) {
      await say(`서버에 연결할 수 없어요. 서버가 켜져 있는지 확인해 주세요.\n(${err instanceof Error ? err.message : String(err)})`);
    }
  });

  return app;
}
