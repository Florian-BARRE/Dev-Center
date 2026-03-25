# tests/test_settings_router.py
import pytest
from httpx import AsyncClient, ASGITransport
from tests.conftest import setup_context
from backend import create_app, CONTEXT
from libs.state.models import Project


@pytest.fixture
async def client(tmp_data, tmp_path):
    setup_context(tmp_data, tmp_path)
    app = create_app(app_name="test", debug=True)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_get_settings_defaults(client):
    resp = await client.get("/api/settings")
    assert resp.status_code == 200
    assert resp.json()["defaults"]["defaultModel"] == "claude-sonnet-4-6"


@pytest.mark.asyncio
async def test_update_settings(client):
    resp = await client.put("/api/settings", json={
        "defaults": {"defaultModel": "claude-opus-4-6", "defaultProvider": "anthropic",
                     "defaultTtlHours": 12, "renewThresholdMinutes": 20}
    })
    assert resp.status_code == 200
    assert resp.json()["defaults"]["defaultModel"] == "claude-opus-4-6"


@pytest.mark.asyncio
async def test_global_rules_roundtrip(client):
    await client.put("/api/settings/rules", json={"content": "# My global rules\n"})
    resp = await client.get("/api/settings/rules")
    assert "My global rules" in resp.json()["content"]


@pytest.mark.asyncio
async def test_out_of_sync_count(tmp_data, tmp_path):
    setup_context(tmp_data, tmp_path)
    # Create a project with a stale CLAUDE.md (no global block)
    ws = tmp_path / "workspaces" / "staleproj"
    ws.mkdir(parents=True)
    (ws / "CLAUDE.md").write_text("# Project rules\n- Use type hints\n")
    CONTEXT.state_manager.upsert_project(Project(
        id="staleproj", name="staleproj",
        repo_url="https://github.com/u/r",
        workspace_path=str(ws),
    ))
    CONTEXT.state_manager.save_global_rules("- Always use uv\n")
    app = create_app(app_name="test", debug=True)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/settings/rules")
    assert resp.status_code == 200
    # CLAUDE.md has no global block â†’ staleproj is out of sync
    assert resp.json()["outOfSyncProjects"] == 1

