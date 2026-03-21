# ====== Code Summary ======
# Tests for bridge action endpoints: renew and WebSocket logs.

# ====== Third-Party Library Imports ======
import pytest
from fastapi.testclient import TestClient

# ====== Internal Project Imports ======
from libs.state.models import Project


def test_renew_bridge_calls_manager(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """POST /bridge/{group_id}/renew returns 200 with status 'renewed' and calls renew_bridge."""
    from backend.context import CONTEXT

    renew_called: list[str] = []

    async def mock_renew(group_id: str) -> None:
        renew_called.append(group_id)

    project = Project(group_id="-100g", project_id="p", repo_url="https://github.com/x/y")
    monkeypatch.setattr(CONTEXT.state_manager, "get_project", lambda gid: project if gid == "-100g" else None)
    monkeypatch.setattr(CONTEXT.bridge_manager, "renew_bridge", mock_renew)

    resp = client.post("/api/v1/bridge/-100g/renew")
    assert resp.status_code == 200
    assert resp.json()["status"] == "renewed"
    assert "-100g" in renew_called


def test_renew_bridge_404_if_not_found(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """POST /bridge/{group_id}/renew returns 404 when the project does not exist."""
    from backend.context import CONTEXT

    monkeypatch.setattr(CONTEXT.state_manager, "get_project", lambda gid: None)

    resp = client.post("/api/v1/bridge/unknown-group/renew")
    assert resp.status_code == 404
