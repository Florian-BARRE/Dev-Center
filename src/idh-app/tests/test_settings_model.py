# ====== Code Summary ======
# Tests for PUT /settings/{group_id}/model route.

# ====== Third-Party Library Imports ======
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

# ====== Internal Project Imports ======
from backend.context import CONTEXT
from libs.state.models import ModelOverride, Project


class FakeStateManager:
    """Minimal in-memory StateManager stub for testing settings routes."""

    def __init__(self) -> None:
        """Initialize with an empty project store."""
        self._store: dict = {}

    def upsert_project(self, group_id: str, project: Project) -> None:
        """Store project under group_id."""
        self._store[group_id] = project

    def get_project(self, group_id: str) -> Project | None:
        """Return project or None."""
        return self._store.get(group_id)

    def set_model_override(self, group_id: str, model_override: ModelOverride) -> None:
        """Apply model override; raise HTTPException 404 if project missing."""
        project = self._store.get(group_id)
        if project is None:
            raise HTTPException(status_code=404, detail=f"Project '{group_id}' not found")
        project.model_override = model_override
        self._store[group_id] = project


def test_put_model(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Verify that PUT /settings/{group_id}/model persists the model override
    on an existing project and returns HTTP 200 with status 'ok'.
    """
    # 1. Set up a fake manager pre-seeded with a known project
    fake_manager = FakeStateManager()
    project = Project(
        group_id="-100999",
        project_id="myrepo",
        repo_url="git@github.com:u/myrepo.git",
    )
    fake_manager.upsert_project("-100999", project)
    monkeypatch.setattr(CONTEXT, "state_manager", fake_manager)

    # 2. Call the endpoint
    response = client.put("/api/v1/settings/-100999/model", json={
        "provider": "anthropic",
        "model": "claude-sonnet-4-6",
    })

    # 3. Assert HTTP 200 with status 'ok'
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

    # 4. Verify state was updated
    updated = fake_manager.get_project("-100999")
    assert updated.model_override.provider == "anthropic"
    assert updated.model_override.model == "claude-sonnet-4-6"


def test_put_model_not_found(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Verify that PUT /settings/{group_id}/model returns 404 for unknown group.
    """
    # 1. Use an empty fake manager so no project exists
    monkeypatch.setattr(CONTEXT, "state_manager", FakeStateManager())

    # 2. Call the endpoint with an unknown group_id
    response = client.put("/api/v1/settings/-999/model", json={
        "provider": "anthropic",
        "model": "claude-opus-4-6",
    })

    # 3. Assert 404
    assert response.status_code == 404
