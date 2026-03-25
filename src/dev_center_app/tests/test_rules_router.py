# tests/test_rules_router.py
import pathlib
import pytest
from httpx import AsyncClient, ASGITransport
from tests.conftest import setup_context
from libs.state.models import Project
from backend import create_app, CONTEXT


@pytest.fixture
async def client_with_project(tmp_data, tmp_path):
    setup_context(tmp_data, tmp_path)
    ws = tmp_path / "workspaces" / "myproj"
    ws.mkdir(parents=True)
    (ws / "CLAUDE.md").write_text("# My rules\n- Use type hints\n")
    CONTEXT.state_manager.upsert_project(Project(
        id="myproj", name="myproj",
        repo_url="https://github.com/u/r",
        workspace_path=str(ws),
    ))
    app = create_app(app_name="test", debug=True)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_get_rules(client_with_project):
    resp = await client_with_project.get("/api/v1/projects/myproj/rules")
    assert resp.status_code == 200
    assert "# My rules" in resp.json()["content"]


@pytest.mark.asyncio
async def test_update_rules(client_with_project):
    resp = await client_with_project.put("/api/v1/projects/myproj/rules", json={"content": "# Updated"})
    assert resp.status_code == 200
    assert resp.json()["content"] == "# Updated"


@pytest.mark.asyncio
async def test_sync_rules(client_with_project, tmp_data):
    CONTEXT.state_manager.save_global_rules("- Always use uv\n")
    resp = await client_with_project.post("/api/v1/projects/myproj/rules/sync")
    assert resp.status_code == 200
    assert "dev-center: global-rules-start" in resp.json()["content"]
    assert "Always use uv" in resp.json()["content"]
    assert resp.json()["globalRulesOutOfSync"] is False


@pytest.mark.asyncio
async def test_out_of_sync_detection(client_with_project, tmp_data):
    CONTEXT.state_manager.save_global_rules("- New global rule\n")
    resp = await client_with_project.get("/api/v1/projects/myproj/rules")
    # CLAUDE.md has no global block → out of sync
    assert resp.json()["globalRulesOutOfSync"] is True


@pytest.mark.asyncio
async def test_get_rules_project_not_found(client_with_project):
    resp = await client_with_project.get("/api/v1/projects/nonexistent/rules")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_rules_no_claude_md(tmp_data, tmp_path):
    setup_context(tmp_data, tmp_path)
    ws = tmp_path / "workspaces" / "noclaudemd"
    ws.mkdir(parents=True)
    # Note: no CLAUDE.md written
    CONTEXT.state_manager.upsert_project(Project(
        id="noclaudemd", name="noclaudemd",
        repo_url="https://github.com/u/r",
        workspace_path=str(ws),
    ))
    app = create_app(app_name="test", debug=True)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/v1/projects/noclaudemd/rules")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_sync_rules_creates_file(tmp_data, tmp_path):
    setup_context(tmp_data, tmp_path)
    ws = tmp_path / "workspaces" / "newproj"
    ws.mkdir(parents=True)
    # Note: no CLAUDE.md written
    CONTEXT.state_manager.upsert_project(Project(
        id="newproj", name="newproj",
        repo_url="https://github.com/u/r",
        workspace_path=str(ws),
    ))
    CONTEXT.state_manager.save_global_rules("- Use uv\n")
    app = create_app(app_name="test", debug=True)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/projects/newproj/rules/sync")
    assert resp.status_code == 200
    assert "dev-center: global-rules-start" in resp.json()["content"]
    assert (ws / "CLAUDE.md").exists()
