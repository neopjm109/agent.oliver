// 텔레그램 봇 — 서버(TCP)의 얇은 클라이언트. chat.id 를 세션 키로 넘겨 멀티턴 유지.
// 텍스트뿐 아니라 문서/사진 업로드도 받아 로컬에 저장하고 경로를 서버에 넘겨 인제스천한다.
import { Bot, InputFile, type Context } from 'grammy';
import { requestAgent } from './core/client.js';
import { saveUpload } from './core/uploads.js';

/** 문서 첨부에 붙일 짧은 캡션 — 첫 줄(제목)만. 전체 내용은 파일에. */
function shortCaption(text: string): string {
  const title = (text.split('\n').map((s) => s.trim()).find(Boolean) ?? '').replace(/^#+\s*/, '');
  const head = title ? `📄 ${title}` : '📄 결과 문서예요';
  return `${head}\n(전체 내용은 첨부 문서를 확인하세요)`;
}

export function createBot(token: string): Bot {
  const bot = new Bot(token);

  bot.command('start', (ctx) =>
    ctx.reply('안녕하세요! 무엇이든 말씀해 주세요. 파일(pdf·엑셀·ppt·워드·코드 등)을 올리면 읽고 분석해요.'),
  );

  // 소울(페르소나) 전환 — 서버 파이프라인의 /soul 메타명령으로 그대로 전달 (세션 키 = chat.id).
  bot.command(['soul', 'souls'], async (ctx) => {
    const payload = (ctx.match?.toString() ?? '').trim();
    try {
      const res = await requestAgent(`/soul ${payload}`.trim(), { chatId: String(ctx.chat.id) });
      await ctx.reply(res.text || res.error || '(빈 응답)');
    } catch (err) {
      await ctx.reply(`서버에 연결할 수 없어요. (${err instanceof Error ? err.message : String(err)})`);
    }
  });

  /** 서버로 보내고 응답을 답신한다(typing 유지, 스킬 꼬리말). 텍스트·첨부 공통 경로. */
  async function relay(ctx: Context, text: string, attachments?: string[]): Promise<void> {
    if (!ctx.chat) return;
    await ctx.replyWithChatAction('typing').catch(() => {});
    const typing = setInterval(() => ctx.replyWithChatAction('typing').catch(() => {}), 4000);
    try {
      const res = await requestAgent(text, { chatId: String(ctx.chat.id), attachments });
      if (res.error) {
        await ctx.reply(`⚠️ 오류: ${res.error}`);
        return;
      }
      const skills = res.skills ?? [];
      const footer = skills.length ? `\n\n🛠 사용한 스킬: ${skills.join(', ')}` : '';
      // 문서형 결과물이 파일로 왔으면 첨부로 업로드(짧은 캡션만), 아니면 텍스트 답신.
      if (res.files?.length) {
        const caption = (shortCaption(res.text ?? '') + footer).slice(0, 1024);
        for (let i = 0; i < res.files.length; i++) {
          await ctx.replyWithDocument(new InputFile(res.files[i]), i === 0 ? { caption } : {});
        }
      } else {
        await ctx.reply((res.text || '(빈 응답)') + footer);
      }
    } catch (err) {
      await ctx.reply(`서버에 연결할 수 없어요. 서버가 켜져 있는지 확인해 주세요.\n(${err instanceof Error ? err.message : String(err)})`);
    } finally {
      clearInterval(typing);
    }
  }

  /** file_id 를 내려받아 로컬에 저장하고 절대경로를 반환. 실패 시 null. */
  async function download(fileId: string, fileName: string, chatId: number): Promise<string | null> {
    try {
      const file = await bot.api.getFile(fileId); // file_path 획득
      if (!file.file_path) return null;
      const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const buf = Buffer.from(await resp.arrayBuffer());
      return saveUpload(String(chatId), fileName, buf);
    } catch {
      return null;
    }
  }

  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (!text || text.startsWith('/')) return;
    await relay(ctx, text);
  });

  // 문서 업로드(pdf·docx·xlsx·pptx·코드 등) — 다운로드 후 경로를 서버에 전달해 인제스천.
  bot.on('message:document', async (ctx) => {
    const doc = ctx.message.document;
    const caption = (ctx.message.caption ?? '').trim();
    const path = await download(doc.file_id, doc.file_name ?? `file_${doc.file_unique_id}`, ctx.chat.id);
    if (!path) {
      await ctx.reply('파일을 내려받지 못했어요. 다시 시도해 주세요.');
      return;
    }
    await relay(ctx, caption || `첨부한 파일(${doc.file_name ?? '문서'}) 내용을 분석해줘`, [path]);
  });

  // 사진 업로드 — 가장 큰 해상도만. (이미지 자체 분석은 텍스트 추출 대상이 아니라 안내 위주)
  bot.on('message:photo', async (ctx) => {
    const caption = (ctx.message.caption ?? '').trim();
    const largest = ctx.message.photo[ctx.message.photo.length - 1];
    const path = await download(largest.file_id, `photo_${largest.file_unique_id}.jpg`, ctx.chat.id);
    await relay(ctx, caption || '방금 보낸 이미지에 대해 도와줘', path ? [path] : undefined);
  });

  bot.catch((err) => console.error('[bot error]', err));
  return bot;
}
