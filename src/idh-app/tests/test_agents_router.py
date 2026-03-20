# ====== Code Summary ======
# Tests for the /agents router endpoints.

# ====== Third-Party Library Imports ======
import pytest
from fastapi.testclient import TestClient


def test_list_agents_returns_agents(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """GET /agents returns the agents dict from openclaw.json."""
    from backend.context import CONTEXT

    class FakeOpenClawWriter:
        def read_config(self) -> dict:
            return {
                "agents": {"agent-1": {"system_prompt": "You are helpful."}},
                "channels": {"telegram": {"groups": {}}},
            }

    monkeypatch.setattr(CONTEXT, "openclaw_writer", FakeOpenClawWriter())

    response = client.get("/api/v1/agents")
    assert response.status_code == 200
    data = response.json()
    assert "agent-1" in data["agents"]


def test_list_agents_empty(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """GET /agents returns empty agents dict when openclaw.json has no agents."""
    from backend.context import CONTEXT

    class FakeOpenClawWriter:
        def read_config(self) -> dict:
            return {"agents": {}, "channels": {"telegram": {"groups": {}}}}

    monkeypatch.setattr(CONTEXT, "openclaw_writer", FakeOpenClawWriter())

    response = client.get("/api/v1/agents")
    assert response.status_code == 200
    assert response.json()["agents"] == {}
