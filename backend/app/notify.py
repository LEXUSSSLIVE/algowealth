import os

import httpx


def send_tg(text: str) -> bool:
    """Telegram push to the admin. Silent no-op when the bot is not configured."""
    token = os.environ.get("ALGOWEALTH_TG_TOKEN")
    chat = os.environ.get("ALGOWEALTH_TG_CHAT")
    if not token or not chat:
        return False
    try:
        httpx.post(f"https://api.telegram.org/bot{token}/sendMessage",
                   data={"chat_id": chat, "text": text}, timeout=10.0)
        return True
    except Exception:
        return False
