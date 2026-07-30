// 슬랙 봇 진입점.  실행:  npm run slack   (서버가 먼저 떠 있어야 함: npm run server)
// 필요 토큰(.env): SLACK_BOT_TOKEN(xoxb-) · SLACK_APP_TOKEN(xapp-, Socket Mode 용 app-level token).
import 'dotenv/config';
import { createSlackApp } from './slackBot.js';
import { serverAddr } from './core/serverAddr.js';

const botToken = process.env.SLACK_BOT_TOKEN;
const appToken = process.env.SLACK_APP_TOKEN;
if (!botToken || !appToken) {
  console.error('SLACK_BOT_TOKEN / SLACK_APP_TOKEN 이 필요합니다. .env 에 추가하세요 (.env.example 참고).');
  process.exit(1);
}

const app = createSlackApp(botToken, appToken);
const { host, port } = serverAddr();

await app.start();
console.error(`슬랙 봇 시작(Socket Mode). 서버: tcp://${host}:${port}. Ctrl-C 로 종료.`);

process.once('SIGINT', async () => {
  await app.stop();
  process.exit(0);
});
process.once('SIGTERM', async () => {
  await app.stop();
  process.exit(0);
});
