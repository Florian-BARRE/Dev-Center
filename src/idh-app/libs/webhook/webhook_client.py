# ====== Code Summary ======
# WebhookClient — fires project lifecycle events to a registered HTTP endpoint.

# ====== Third-Party Library Imports ======
import httpx
from loggerplusplus import LoggerClass


class WebhookClient(LoggerClass):
    """
    HTTP client for sending project lifecycle event notifications.

    Fires POST requests to a pre-configured webhook URL whenever a project
    is created or deleted.

    Attributes:
        _webhook_url (str): Full URL of the webhook endpoint.
    """

    def __init__(self, webhook_url: str) -> None:
        """
        Initialise the WebhookClient.

        Args:
            webhook_url (str): Full URL to POST lifecycle events to.
        """
        LoggerClass.__init__(self)
        self._webhook_url = webhook_url

    # ──────────────────────────── Private helpers ────────────────────────────

    def _post_event(self, payload: dict) -> httpx.Response:
        """
        POST a lifecycle event payload to the webhook URL.

        Args:
            payload (dict): Event data to send as JSON.

        Returns:
            httpx.Response: Raw HTTP response from the webhook endpoint.
        """
        # 1. POST the event payload and return the raw response
        self.logger.info(f"Posting event '{payload.get('event')}' to webhook")
        return httpx.post(self._webhook_url, json=payload)

    # ──────────────────────────── Public API ────────────────────────────────

    def project_created(self, group_id: str, project_id: str) -> httpx.Response:
        """
        Fire a 'project_created' lifecycle event.

        Args:
            group_id (str): Telegram group ID that owns the project.
            project_id (str): Identifier of the newly created project.

        Returns:
            httpx.Response: Raw HTTP response from the webhook endpoint.
        """
        # 1. Build and send the project_created event
        return self._post_event(
            {"event": "project_created", "group_id": group_id, "project_id": project_id}
        )

    def project_deleted(self, group_id: str, project_id: str) -> httpx.Response:
        """
        Fire a 'project_deleted' lifecycle event.

        Args:
            group_id (str): Telegram group ID that owned the project.
            project_id (str): Identifier of the deleted project.

        Returns:
            httpx.Response: Raw HTTP response from the webhook endpoint.
        """
        # 1. Build and send the project_deleted event
        return self._post_event(
            {"event": "project_deleted", "group_id": group_id, "project_id": project_id}
        )
