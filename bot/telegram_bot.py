#!/usr/bin/env python3
"""
Skillful Agent 텔레그램 봇 (python-telegram-bot 기반).

텔레그램 채팅 메시지를 TS 에이전트 HTTP 서버(POST /chat)로 전달하고,
응답을 다시 채팅으로 보낸다. 대화는 chat_id 별 세션으로 서버에서 영속화된다.

의존성: python-telegram-bot (httpx 포함) — requirements.txt 참고
환경변수 (bot/.env 또는 실제 환경변수):
  TELEGRAM_BOT_TOKEN   BotFather 에서 발급한 봇 토큰 (필수)
  AGENT_URL            에이전트 서버 주소 (기본 http://localhost:8787)
  AGENT_SERVER_TOKEN   서버 토큰 (서버에서 설정했다면 동일 값)

명령어:
  /start   안내 메시지
  /reset   현재 채팅의 대화 기록 초기화
그 외 모든 텍스트 메시지는 에이전트에게 전달된다.
"""
import os
import json
import sys
import time

import httpx
from telegram import Update
from telegram.constants import ChatAction, ParseMode
from telegram.error import BadRequest
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

try:
    import telegramify_markdown  # 표준 마크다운 → 텔레그램 MarkdownV2 변환
except ImportError:
    telegramify_markdown = None


def _load_dotenv(path: str):
    """의존성 없이 bot/.env 를 읽어 os.environ 에 주입 (이미 설정된 값은 유지)."""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
AGENT_URL = os.environ.get("AGENT_URL", "http://localhost:8787").rstrip("/")
AGENT_TOKEN = os.environ.get("AGENT_SERVER_TOKEN", "").strip()

# 허용할 텔레그램 chat_id 목록(콤마 구분). 비어 있으면 전체 허용(경고 출력).
# 에이전트가 셸/파일 도구를 쓰므로, 공개 봇이라면 반드시 본인 chat_id 만 허용할 것.
ALLOWED_CHAT_IDS = {
    int(x) for x in os.environ.get("TELEGRAM_ALLOWED_CHAT_IDS", "").replace(" ", "").split(",") if x
}

if not TELEGRAM_TOKEN:
    sys.exit("환경변수 TELEGRAM_BOT_TOKEN 이 필요합니다.")

TG_MAX = 4096  # 텔레그램 메시지 길이 제한


def _is_allowed(chat_id: int) -> bool:
    return not ALLOWED_CHAT_IDS or chat_id in ALLOWED_CHAT_IDS


def _headers() -> dict:
    return {"x-api-key": AGENT_TOKEN} if AGENT_TOKEN else {}


def _session_id(chat_id: int) -> str:
    return f"tg-{chat_id}"


def _to_markdown_v2(text: str):
    """표준 마크다운을 텔레그램 MarkdownV2 로 변환. 불가하면 None."""
    if telegramify_markdown is None:
        return None
    try:
        return telegramify_markdown.markdownify(text)
    except Exception:
        return None


async def _edit_final(message, text: str):
    """진행 표시 메시지를 최종 답변으로 교체. 마크다운 우선, 실패/초과 시 평문 분할."""
    text = text or "(빈 응답)"
    if len(text) <= TG_MAX:
        md = _to_markdown_v2(text)
        if md is not None and len(md) <= TG_MAX:
            try:
                await message.edit_text(md, parse_mode=ParseMode.MARKDOWN_V2)
                return
            except BadRequest:
                pass  # 파싱 실패 → 평문 폴백
        try:
            await message.edit_text(text)
            return
        except BadRequest:
            pass
    # 길거나 편집 실패: 진행 메시지 지우고 평문 4096자 분할 전송
    chat = message.chat
    try:
        await message.delete()
    except BadRequest:
        pass
    for i in range(0, len(text), TG_MAX):
        await chat.send_message(text[i : i + TG_MAX])


async def start(update: Update, _: ContextTypes.DEFAULT_TYPE):
    """텔레그램 관례상 /start 는 봇 자체 환영 메시지. 명령 체계는 서버와 공유하는 /help 참고."""
    chat_id = update.effective_chat.id
    print(f"[/start] chat_id={chat_id}")
    await update.message.reply_text(
        "안녕하세요! 스킬 기반 AI 에이전트입니다. 무엇이든 물어보세요.\n\n"
        "명령어 (CLI 와 동일):\n"
        "/help — 명령 도움말\n"
        "/skills — 카테고리 스킬 목록\n"
        "/soul [이름|off] — 페르소나 목록 / 변경 / 해제\n"
        "/reset — 대화 초기화\n"
        "/<스킬명> [요청] — 스킬 직접 실행\n"
        f"\n(내 chat_id: {chat_id})"
    )


async def on_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/start 를 제외한 모든 슬래시 명령(/help·/skills·/soul·/reset·/<스킬>)을
    그대로 에이전트 서버로 넘겨, CLI 와 동일한 명령 해석기가 처리하게 한다."""
    await _run_agent(update, context, (update.message.text or "").strip())


async def on_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """일반 텍스트 메시지."""
    await _run_agent(update, context, (update.message.text or "").strip())


async def _run_agent(update: Update, context: ContextTypes.DEFAULT_TYPE, text: str):
    """입력(일반 텍스트 또는 슬래시 명령)을 서버 /chat/stream 으로 보내고 응답을 표시한다."""
    chat_id = update.effective_chat.id
    if not text:
        return

    if not _is_allowed(chat_id):
        print(f"[차단] 허용되지 않은 chat_id={chat_id} 의 메시지 거부")
        await update.message.reply_text(
            f"이 봇을 사용할 권한이 없습니다.\n(내 chat_id: {chat_id})"
        )
        return

    await context.bot.send_chat_action(chat_id=chat_id, action=ChatAction.TYPING)
    # 진행 상황을 보여줄 메시지(이후 계속 편집)
    status = await update.message.reply_text("🤔 생각 중…")

    reply = None
    used_skills = []
    last_shown = ""
    last_edit = 0.0

    async def show_progress(line: str):
        """진행 로그 한 줄을 상태 메시지에 반영 (편집 rate limit 회피용 스로틀)."""
        nonlocal last_shown, last_edit
        line = line.strip()
        if not line or line == last_shown:
            return
        now = time.monotonic()
        if now - last_edit < 1.2:  # 너무 잦은 편집 방지
            return
        last_shown, last_edit = line, now
        try:
            await status.edit_text(f"⏳ {line[:300]}")
        except BadRequest:
            pass  # not modified 등 무시

    try:
        async with httpx.AsyncClient(timeout=600) as client:
            async with client.stream(
                "POST",
                f"{AGENT_URL}/chat/stream",
                json={"session": _session_id(chat_id), "message": text},
                headers=_headers(),
            ) as r:
                if r.status_code != 200:
                    body = (await r.aread()).decode(errors="replace")
                    reply = f"⚠️ 에이전트 오류 ({r.status_code}): {body[:300]}"
                else:
                    async for line in r.aiter_lines():
                        if not line.strip():
                            continue
                        ev = json.loads(line)
                        kind = ev.get("type")
                        if kind == "step":
                            await show_progress(ev.get("text", ""))
                        elif kind == "done":
                            reply = ev.get("reply", "(응답 없음)")
                            used_skills = ev.get("skills") or []
                        elif kind == "error":
                            reply = f"⚠️ 처리 오류: {ev.get('error')}"
    except httpx.HTTPError as e:
        reply = f"⚠️ 에이전트 서버에 연결할 수 없습니다: {e}"

    final = reply if reply is not None else "(응답 없음)"
    if used_skills:
        final += "\n\n🧩 사용한 스킬: " + ", ".join(used_skills)
    await _edit_final(status, final)


def main():
    print(f"텔레그램 봇 시작. 에이전트 서버: {AGENT_URL}")
    if ALLOWED_CHAT_IDS:
        print(f"허용 chat_id: {sorted(ALLOWED_CHAT_IDS)}")
    else:
        print(
            "⚠️  경고: TELEGRAM_ALLOWED_CHAT_IDS 미설정 → 누구나 이 봇을 사용할 수 있습니다.\n"
            "    에이전트가 셸/파일 도구를 쓰므로, 봇에게 /start 를 보내 본인 chat_id 를 확인한 뒤\n"
            "    bot/.env 의 TELEGRAM_ALLOWED_CHAT_IDS 에 그 값을 넣고 재시작하세요."
        )
    app = Application.builder().token(TELEGRAM_TOKEN).build()
    # /start 만 봇 네이티브(환영 메시지). 나머지 모든 명령은 서버로 포워딩해
    # CLI 와 동일한 명령 해석기(commands.interpret)가 처리한다.
    # (같은 그룹에선 먼저 등록된 매칭 핸들러 하나만 실행되므로 start 를 앞에 둔다.)
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.COMMAND, on_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_message))
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
