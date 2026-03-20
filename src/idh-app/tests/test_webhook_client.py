# ====== Code Summary ======
# Tests for WebhookClient — HTTP callbacks for project lifecycle events.

# ====== Third-Party Library Imports ======
import httpx
import pytest
import respx

# ====== Internal Project Imports ======
from libs.webhook.webhook_client import WebhookClient


@pytest.fixture
def client() -> WebhookClient:
    """Return a WebhookClient pointed at a test URL."""
    return WebhookClient(webhook_url="http://test-webhook.local/events")


def test_project_created_posts_event(client: WebhookClient) -> None:
    """project_created() POSTs a 'project_created' event to the webhook URL."""
    with respx.mock(base_url="http://test-webhook.local") as mock:
        mock.post("/events").mock(return_value=httpx.Response(200, json={"ok": True}))
        response = client.project_created(group_id="g1", project_id="p1")
    assert response.status_code == 200


def test_project_created_sends_correct_payload(client: WebhookClient) -> None:
    """project_created() sends event, group_id, and project_id in the body."""
    with respx.mock(base_url="http://test-webhook.local") as mock:
        import json
        route = mock.post("/events").mock(return_value=httpx.Response(200, json={}))
        client.project_created(group_id="g1", project_id="p1")

    sent = json.loads(route.calls[0].request.content)
    assert sent["event"] == "project_created"
    assert sent["group_id"] == "g1"
    assert sent["project_id"] == "p1"


def test_project_deleted_posts_event(client: WebhookClient) -> None:
    """project_deleted() POSTs a 'project_deleted' event to the webhook URL."""
    with respx.mock(base_url="http://test-webhook.local") as mock:
        import json
        route = mock.post("/events").mock(return_value=httpx.Response(200, json={}))
        response = client.project_deleted(group_id="g1", project_id="p1")
        sent = json.loads(route.calls[0].request.content)

    assert response.status_code == 200
    assert sent["event"] == "project_deleted"
