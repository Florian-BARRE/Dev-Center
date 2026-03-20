# ====== Code Summary ======
# Tests for the /settings router endpoints.

# ====== Standard Library Imports ======
import hashlib
import hmac
import json

# ====== Third-Party Library Imports ======
import pytest
from fastapi.testclient import TestClient


def _make_signature(payload: dict, secret: str = "test-secret-for-pytest-only") -> str:
    """Compute the HMAC-SHA256 signature for a payload dict.

    Uses compact JSON separators to match what the httpx-based TestClient sends
    when called with ``json=payload`` (no spaces after separators).
    """
    body = json.dumps(payload, separators=(",", ":")).encode()
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def test_webhook_rejects_invalid_signature(client: TestClient) -> None:
    """POST /settings/webhook returns 403 when the signature is wrong."""
    payload = {"project_id": "p1", "group_id": "g1", "repo_url": "https://github.com/x/y", "agent_id": "a1"}
    response = client.post(
        "/api/v1/settings/webhook",
        json=payload,
        headers={"X-IDH-Signature": "sha256=bad"},
    )
    assert response.status_code == 403


def test_webhook_accepts_valid_signature(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """POST /settings/webhook returns 200 when the signature is valid."""
    from backend.context import CONTEXT

    payload = {"project_id": "p1", "group_id": "g1", "repo_url": "https://github.com/x/y", "agent_id": "a1"}

    class FakeGitManager:
        async def clone(self, repo_url, project_id):
            import pathlib
            return pathlib.Path("/tmp/workspace")

    class FakeMemoryManager:
        def write_memory(self, project_id, content):
            pass

    class FakeOpenClawWriter:
        def register_group(self, group_id, project_id, agent_id):
            return None
        def update_agent_system_prompt(self, agent_id, prompt):
            pass

    class FakeBridgeManager:
        async def start_bridge(self, group_id, workspace):
            pass

    class FakeStateManager:
        def upsert_project(self, group_id, project):
            pass

    class FakeWebhookClient:
        def project_created(self, group_id, project_id):
            return None

    monkeypatch.setattr(CONTEXT, "git_manager", FakeGitManager())
    monkeypatch.setattr(CONTEXT, "memory_manager", FakeMemoryManager())
    monkeypatch.setattr(CONTEXT, "openclaw_writer", FakeOpenClawWriter())
    monkeypatch.setattr(CONTEXT, "bridge_manager", FakeBridgeManager())
    monkeypatch.setattr(CONTEXT, "state_manager", FakeStateManager())
    monkeypatch.setattr(CONTEXT, "webhook_client", FakeWebhookClient())

    sig = _make_signature(payload)
    response = client.post(
        "/api/v1/settings/webhook",
        json=payload,
        headers={"X-IDH-Signature": sig},
    )
    assert response.status_code == 200


def test_put_telegram_prompt(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """PUT /settings/telegram/prompt/{agent_id} calls update_agent_system_prompt."""
    from backend.context import CONTEXT

    calls = []

    class FakeOpenClawWriter:
        def update_agent_system_prompt(self, agent_id, prompt):
            calls.append((agent_id, prompt))

    monkeypatch.setattr(CONTEXT, "openclaw_writer", FakeOpenClawWriter())

    response = client.put(
        "/api/v1/settings/telegram/prompt/my-agent",
        json={"system_prompt": "You are helpful."},
    )
    assert response.status_code == 200
    assert ("my-agent", "You are helpful.") in calls


def test_put_telegram_prompt_missing_body(client: TestClient) -> None:
    """PUT /settings/telegram/prompt/{agent_id} returns 422 when body is missing."""
    response = client.put("/api/v1/settings/telegram/prompt/my-agent", json={})
    assert response.status_code == 422
