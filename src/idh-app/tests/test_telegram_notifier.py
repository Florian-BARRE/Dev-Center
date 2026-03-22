import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from libs.scheduler.telegram_notifier import TelegramNotifier


@pytest.mark.asyncio
async def test_send_alert_calls_telegram_api():
    notifier = TelegramNotifier(bot_token="test-token")
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()

    with patch("libs.scheduler.telegram_notifier.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client_cls.return_value = mock_client

        await notifier.send_alert("-123456", "Test message")

        mock_client.post.assert_called_once()
        call_args = mock_client.post.call_args
        assert "sendMessage" in call_args[0][0]
        assert call_args[1]["json"]["chat_id"] == "-123456"
        assert call_args[1]["json"]["text"] == "Test message"


@pytest.mark.asyncio
async def test_send_alert_skips_when_no_token():
    notifier = TelegramNotifier(bot_token="")
    # Should not raise, just log a warning and return
    await notifier.send_alert("-123456", "Test message")


@pytest.mark.asyncio
async def test_send_alert_handles_http_error():
    import httpx
    notifier = TelegramNotifier(bot_token="test-token")
    with patch("libs.scheduler.telegram_notifier.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(side_effect=httpx.HTTPError("network error"))
        mock_client_cls.return_value = mock_client
        # Should not raise — log error and continue
        await notifier.send_alert("-123456", "Test message")
