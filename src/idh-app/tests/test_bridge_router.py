# ====== Code Summary ======
# Tests for the /bridge router endpoints.

# ====== Standard Library Imports ======
import pathlib

# ====== Third-Party Library Imports ======
import pytest
from fastapi.testclient import TestClient

# ====== Internal Project Imports ======
from libs.state.models import BridgeState, Project


def test_get_bridge_status_not_found(client: TestClient) -> None:
    """GET /bridge/{group_id} returns 404 for an unknown group_id."""
    response = client.get("/api/v1/bridge/unknown-group")
    assert response.status_code == 404


def test_get_bridge_status_no_bridge(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """GET /bridge/{group_id} returns bridge: null when project has no active bridge."""
    from backend.context import CONTEXT

    project = Project(group_id="g1", project_id="p1", repo_url="https://github.com/x/y")

    class FakeStateManager:
        def get_project(self, group_id: str):
            return project if group_id == "g1" else None

    monkeypatch.setattr(CONTEXT, "state_manager", FakeStateManager())

    response = client.get("/api/v1/bridge/g1")
    assert response.status_code == 200
    assert response.json()["bridge"] is None


def test_start_bridge_not_found(client: TestClient) -> None:
    """POST /bridge/{group_id}/start returns 404 when the project does not exist."""
    response = client.post("/api/v1/bridge/unknown-group/start")
    assert response.status_code == 404


def test_stop_bridge_not_found(client: TestClient) -> None:
    """DELETE /bridge/{group_id} returns 404 when the project does not exist."""
    response = client.delete("/api/v1/bridge/unknown-group")
    assert response.status_code == 404
