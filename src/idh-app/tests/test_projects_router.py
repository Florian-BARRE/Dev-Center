# ====== Code Summary ======
# Tests for the /projects router endpoints.

# ====== Standard Library Imports ======
import json
import pathlib

# ====== Third-Party Library Imports ======
import pytest
from fastapi.testclient import TestClient

# ====== Internal Project Imports ======
from libs.state.models import Project, StateFile


def test_list_projects_empty(client: TestClient) -> None:
    """GET /projects returns an empty list when no projects exist."""
    response = client.get("/api/v1/projects")
    assert response.status_code == 200
    data = response.json()
    assert data["projects"] == []


def test_get_project_not_found(client: TestClient) -> None:
    """GET /projects/{group_id} returns 404 for an unknown group_id."""
    response = client.get("/api/v1/projects/unknown-group")
    assert response.status_code == 404


def test_delete_project_not_found(client: TestClient) -> None:
    """DELETE /projects/{group_id} returns 404 for an unknown group_id."""
    response = client.delete("/api/v1/projects/unknown-group")
    assert response.status_code == 404


def test_list_projects_returns_projects(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """GET /projects returns all projects from state."""
    from backend.context import CONTEXT

    project = Project(
        group_id="g1",
        project_id="p1",
        repo_url="https://github.com/x/y",
    )

    class FakeStateManager:
        def load(self):
            return StateFile(projects={"g1": project})

    monkeypatch.setattr(CONTEXT, "state_manager", FakeStateManager())

    response = client.get("/api/v1/projects")
    assert response.status_code == 200
    data = response.json()
    assert len(data["projects"]) == 1
    assert data["projects"][0]["projectId"] == "p1"


def test_get_project_returns_project(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """GET /projects/{group_id} returns the project when it exists."""
    from backend.context import CONTEXT

    project = Project(
        group_id="g1",
        project_id="p1",
        repo_url="https://github.com/x/y",
    )

    class FakeStateManager:
        def get_project(self, group_id: str):
            return project if group_id == "g1" else None

    monkeypatch.setattr(CONTEXT, "state_manager", FakeStateManager())

    response = client.get("/api/v1/projects/g1")
    assert response.status_code == 200
    assert response.json()["projectId"] == "p1"


def test_delete_project_success(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """DELETE /projects/{group_id} returns 200 with the deleted project data."""
    from backend.context import CONTEXT

    project = Project(group_id="g1", project_id="p1", repo_url="https://github.com/x/y")

    class FakeStateManager:
        def get_project(self, group_id: str):
            return project if group_id == "g1" else None

        def delete_project(self, group_id: str) -> bool:
            return True

    class FakeBridgeManager:
        async def stop_bridge(self, group_id: str) -> None:
            pass

    class FakeWebhookClient:
        def project_deleted(self, group_id: str, project_id: str):
            return None

    monkeypatch.setattr(CONTEXT, "state_manager", FakeStateManager())
    monkeypatch.setattr(CONTEXT, "bridge_manager", FakeBridgeManager())
    monkeypatch.setattr(CONTEXT, "webhook_client", FakeWebhookClient())

    response = client.delete("/api/v1/projects/g1")
    assert response.status_code == 200
    assert response.json()["projectId"] == "p1"
