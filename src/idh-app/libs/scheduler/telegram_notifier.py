# ====== Code Summary ======
# Sends Telegram Bot API messages for session transition alerts.

# ====== Third-Party Library Imports ======
import httpx
from loggerplusplus import LoggerClass


class TelegramNotifier(LoggerClass):
    """
    Sends Telegram messages via the Bot API for session scheduling alerts.

    Uses httpx for async HTTP. If the bot token is empty, all sends are
    silently skipped (useful for environments where Telegram is not configured).

    Attributes:
        _bot_token (str): Telegram Bot API token.
    """

    _API_BASE = "https://api.telegram.org"

    def __init__(self, bot_token: str) -> None:
        """
        Initialise the TelegramNotifier.

        Args:
            bot_token (str): Telegram Bot API token. Empty string disables sending.
        """
        LoggerClass.__init__(self)
        self._bot_token = bot_token
        if bot_token:
            self.logger.info(f"TelegramNotifier ready")
        else:
            self.logger.warning(f"TelegramNotifier: TELEGRAM_BOT_TOKEN is empty — alerts disabled")

    # ──────────────────────────── Public API ────────────────────────────────

    async def send_alert(self, group_id: str, message: str) -> None:
        """
        Send a message to a Telegram group.

        Silently skips if the bot token is empty. Logs but does not raise on
        HTTP errors to prevent scheduler disruption.

        Args:
            group_id (str): Telegram group ID (e.g. "-5104943549").
            message (str): Text message to send.
        """
        # 1. Skip if token not configured
        if not self._bot_token:
            self.logger.debug(f"Skipping alert to {group_id} — no bot token configured")
            return

        # 2. Send via Telegram Bot API
        url = f"{self._API_BASE}/bot{self._bot_token}/sendMessage"
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json={"chat_id": group_id, "text": message})
                resp.raise_for_status()
                self.logger.info(f"Alert sent to group '{group_id}'")
        except httpx.HTTPError as exc:
            self.logger.error(f"Failed to send alert to group '{group_id}': {exc}")
