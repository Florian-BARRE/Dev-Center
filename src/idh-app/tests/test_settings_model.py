# ====== Code Summary ======
# Tests for PUT /settings/{group_id}/model route.

# ====== Third-Party Library Imports ======
import pytest
from fastapi.testclient import TestClient

# ====== Internal Project Imports ======
from backend.context import CONTEXT
from libs.state.models import Project


def test_put_model(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """PUT /settings/{group_id}/model updates modelOverride."""
    # Create a real project and track calls
    project = Project(
        group_id="-100999",
        project_id="myrepo",
        repo_url="git@github.com:u/myrepo.git",
    )

    class FakeStateManager:
        def get_project(self, group_id: str):
            if group_id == "-100999":
                return project
            return None

        def upsert_project(self, group_id: str, proj: Project):
            nonlocal project
            # Also update the in-memory variable so assertions work
            project = proj

    # Replace with the fake manager for this test only
    original_manager = CONTEXT.state_manager
    monkeypatch.setattr(CONTEXT, "state_manager", FakeStateManager())

    response = client.put("/api/v1/settings/-100999/model", json={
        "provider": "anthropic",
        "model": "claude-sonnet-4-6",
    })
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

    # Verify state was updated
    assert project.model_override.provider == "anthropic"
    assert project.model_override.model == "claude-sonnet-4-6"
