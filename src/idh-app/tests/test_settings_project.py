# ====== Code Summary ======
# Tests for the /settings/{group_id} project-scoped endpoints.

# ====== Third-Party Library Imports ======
import pytest
from libs.state.models import Project, StateFile, ModelOverride


def test_get_claude_md_returns_content(client, tmp_path, monkeypatch):
    """GET /settings/{group_id}/claude-md returns CLAUDE.md content."""
    from backend.context import CONTEXT
    # Setup: workspace with CLAUDE.md
    ws = tmp_path / "workspaces" / "my-proj"
    ws.mkdir(parents=True)
    (ws / "CLAUDE.md").write_text("# Claude rules")
    monkeypatch.setattr(CONTEXT.RUNTIME_CONFIG, "PATH_WORKSPACES", tmp_path / "workspaces")
    # Setup: state with project
    state = StateFile(projects={"-100g": Project(groupId="-100g", projectId="my-proj", repoUrl="x")})
    monkeypatch.setattr(CONTEXT.state_manager, "get_project", lambda gid: state.projects.get(gid))

    resp = client.get("/api/v1/settings/-100g/claude-md")
    assert resp.status_code == 200
    assert resp.json()["content"] == "# Claude rules"


def test_put_claude_md_writes_file(client, tmp_path, monkeypatch):
    """PUT /settings/{group_id}/claude-md writes CLAUDE.md."""
    from backend.context import CONTEXT
    ws = tmp_path / "workspaces" / "my-proj"
    ws.mkdir(parents=True)
    (ws / "CLAUDE.md").write_text("")
    monkeypatch.setattr(CONTEXT.RUNTIME_CONFIG, "PATH_WORKSPACES", tmp_path / "workspaces")
    state = StateFile(projects={"-100g": Project(groupId="-100g", projectId="my-proj", repoUrl="x")})
    monkeypatch.setattr(CONTEXT.state_manager, "get_project", lambda gid: state.projects.get(gid))

    resp = client.put("/api/v1/settings/-100g/claude-md", json={"content": "# New rules"})
    assert resp.status_code == 200
    assert (ws / "CLAUDE.md").read_text() == "# New rules"


def test_get_model_returns_override(client, monkeypatch):
    """GET /settings/{group_id}/model returns current model."""
    from backend.context import CONTEXT
    project = Project(
        groupId="-100g", projectId="p", repoUrl="x",
        modelOverride=ModelOverride(provider="anthropic", model="claude-sonnet-4-6")
    )
    monkeypatch.setattr(CONTEXT.state_manager, "get_project", lambda gid: project if gid == "-100g" else None)

    resp = client.get("/api/v1/settings/-100g/model")
    assert resp.status_code == 200
    data = resp.json()
    assert data["provider"] == "anthropic"
    assert data["model"] == "claude-sonnet-4-6"


def test_get_telegram_prompt(client, monkeypatch):
    """GET /settings/{group_id}/telegram-prompt returns agent system prompt."""
    from backend.context import CONTEXT
    project = Project(groupId="-100g", projectId="my-agent", repoUrl="x")
    monkeypatch.setattr(CONTEXT.state_manager, "get_project", lambda gid: project if gid == "-100g" else None)
    monkeypatch.setattr(CONTEXT.openclaw_writer, "get_agent_system_prompt", lambda aid: "You are helpful." if aid == "my-agent" else "")

    resp = client.get("/api/v1/settings/-100g/telegram-prompt")
    assert resp.status_code == 200
    data = resp.json()
    assert data["agentId"] == "my-agent"
    assert data["systemPrompt"] == "You are helpful."
