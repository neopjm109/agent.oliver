// 텔레그램 봇 진입점.  실행:  npm run bot   (서버가 먼저 떠 있어야 함: npm run server)
import 'dotenv/config';
import { createBot } from './telegramBot.js';
import { serverAddr } from './core/serverAddr.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN 이 설정되지 않았습니다. .env 에 추가하세요 (.env.example 참고).');
  process.exit(1);
}

const bot = createBot(token);
const { host, port } = serverAddr();

bot.start({
  onStart: () => console.error(`텔레그램 봇 시작. 서버: tcp://${host}:${port}. Ctrl-C 로 종료.`),
});

process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
