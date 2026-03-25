# tests/test_projects_router.py
# Integration tests for the /projects router using a real FastAPI app instance
# with CONTEXT wired to temporary directories and a no-op lifespan.

from __future__ import annotations
import asyncio
import pathlib
import pytest
from contextlib import asynccontextmanager
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI

from backend.context import CONTEXT
from backend.routers import health_router, projects_router
from libs.state.models import Project
from tests.conftest import setup_context

# Access the module-level _cloning set to clear it between tests.
import backend.routers.projects.router as _projects_router_module


def _build_test_app() -> FastAPI:
    """
    Build a minimal FastAPI app for testing â€” no lifespan, just the routers.

    Returns:
        FastAPI: App with health and projects routers registered.
    """

    @asynccontextmanager
    async def _null_lifespan(app):
        """No-op lifespan â€” skips service startup for tests."""
        yield

    app = FastAPI(title="test", lifespan=_null_lifespan)
    prefix = "/api"
    app.include_router(health_router, prefix=prefix)
    app.include_router(projects_router, prefix=prefix)
    return app


@pytest.fixture
async def client(tmp_data, tmp_path):
    """
    AsyncClient wired to a test app with CONTEXT populated from temp dirs.

    Cancels any remaining background tasks after the client closes so that
    fire-and-forget clone tasks do not block the event loop cleanup.
    """
    setup_context(tmp_data, tmp_path)
    # Clear cloning state so tests are isolated
    _projects_router_module._cloning.clear()
    app = _build_test_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    # Cancel any lingering background tasks (e.g. _clone_bg) after client closes
    for task in asyncio.all_tasks():
        if not task.done() and task != asyncio.current_task():
            task.cancel()
            try:
                await asyncio.wait_for(asyncio.shield(task), timeout=0.1)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass


@pytest.mark.asyncio
async def test_list_projects_empty(client):
    """GET /projects returns an empty list when no projects exist."""
    resp = await client.get("/api/projects")
    assert resp.status_code == 200
    assert resp.json()["projects"] == []


@pytest.mark.asyncio
async def test_create_project_returns_202(client):
    """POST /projects returns 202 and a project with id derived from the URL."""

    # Fake clone: async generator that yields one progress line then exits cleanly.
    # Use side_effect so it receives (repo_url, project_id) args.
    async def fake_clone(repo_url, project_id):
        yield "Cloning into directory..."

    with patch.object(CONTEXT.git_manager, "clone", side_effect=fake_clone):
        resp = await client.post("/api/projects", json={
            "repoUrl": "https://github.com/user/patrimonium",
        })

    assert resp.status_code == 202
    data = resp.json()
    assert data["id"] == "patrimonium"
    assert data["status"] in ("cloning", "ready")


@pytest.mark.asyncio
async def test_create_project_derives_id_from_url(client):
    """POST /projects derives slug from the last path segment of the repo URL."""

    async def fake_clone(repo_url, project_id):
        yield "Cloning..."

    with patch.object(CONTEXT.git_manager, "clone", side_effect=fake_clone):
        resp = await client.post("/api/projects", json={
            "repoUrl": "https://github.com/user/My_Repo.git",
        })

    assert resp.status_code == 202
    assert resp.json()["id"] == "my-repo"


@pytest.mark.asyncio
async def test_get_project(client):
    """GET /projects/{id} returns 200 and the project when it exists."""
    # Directly insert a project into state without triggering a clone
    CONTEXT.state_manager.upsert_project(Project(
        id="myrepo",
        name="myrepo",
        repo_url="https://github.com/user/myrepo",
        workspace_path="/w/myrepo",
    ))

    resp = await client.get("/api/projects/myrepo")
    assert resp.status_code == 200
    assert resp.json()["id"] == "myrepo"
    assert resp.json()["status"] == "ready"


@pytest.mark.asyncio
async def test_get_project_not_found(client):
    """GET /projects/{id} returns 404 when the project does not exist."""
    resp = await client.get("/api/projects/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_project_model(client):
    """PUT /projects/{id} updates the model field and returns the updated project."""
    CONTEXT.state_manager.upsert_project(Project(
        id="my-proj",
        name="my-proj",
        repo_url="https://github.com/u/my-proj",
        workspace_path="/w/my-proj",
    ))

    resp = await client.put("/api/projects/my-proj", json={"model": "claude-opus-4"})
    assert resp.status_code == 200
    assert resp.json()["model"] == "claude-opus-4"


@pytest.mark.asyncio
async def test_update_project_not_found(client):
    """PUT /projects/{id} returns 404 when the project does not exist."""
    resp = await client.put("/api/projects/nope", json={"model": "claude-opus-4"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_project(client):
    """DELETE /projects/{id} removes the project, calls cleanup, and returns 204."""
    CONTEXT.state_manager.upsert_project(Project(
        id="to-delete",
        name="to-delete",
        repo_url="https://github.com/u/r",
        workspace_path="/w/to-delete",
    ))

    with patch.object(CONTEXT.git_manager, "cleanup") as mock_cleanup:
        resp = await client.delete("/api/projects/to-delete")

    assert resp.status_code == 204
    assert CONTEXT.state_manager.get_project("to-delete") is None
    mock_cleanup.assert_called_once_with("to-delete")


@pytest.mark.asyncio
async def test_delete_nonexistent_project_is_idempotent(client):
    """DELETE /projects/{id} is idempotent â€” no error when project does not exist."""
    resp = await client.delete("/api/projects/ghost")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_list_projects_after_insert(client):
    """GET /projects returns all inserted projects."""
    for slug in ("alpha", "beta", "gamma"):
        CONTEXT.state_manager.upsert_project(Project(
            id=slug, name=slug,
            repo_url=f"https://github.com/u/{slug}",
            workspace_path=f"/w/{slug}",
        ))

    resp = await client.get("/api/projects")
    assert resp.status_code == 200
    ids = {p["id"] for p in resp.json()["projects"]}
    assert ids == {"alpha", "beta", "gamma"}

