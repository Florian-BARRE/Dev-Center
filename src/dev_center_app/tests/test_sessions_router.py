# tests/test_sessions_router.py
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from httpx import AsyncClient, ASGITransport
from tests.conftest import setup_context
from libs.state.models import Project
from backend import create_app, CONTEXT


class _AsyncIterableMock:
    """Helper: async-iterable mock that yields nothing."""

    def __aiter__(self):
        return self

    async def __anext__(self):
        raise StopAsyncIteration


def _make_proc(pid: int) -> MagicMock:
    """Build a minimal mock subprocess with an async-iterable stdout."""
    proc = MagicMock()
    proc.pid = pid
    proc.stdout = _AsyncIterableMock()
    return proc


@pytest.fixture
async def client(tmp_data, tmp_path):
    setup_context(tmp_data, tmp_path)
    CONTEXT.state_manager.upsert_project(Project(
        id="myproj", name="myproj",
        repo_url="https://github.com/u/myproj",
        workspace_path="/workspaces/myproj",
    ))
    app = create_app(app_name="test", debug=True)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_start_session(client):
    mock_proc = _make_proc(999)
    with patch("asyncio.create_subprocess_exec", new=AsyncMock(return_value=mock_proc)):
        resp = await client.post("/api/v1/projects/myproj/session/start")
    assert resp.status_code == 200
    assert resp.json()["session"]["pid"] == 999


@pytest.mark.asyncio
async def test_start_session_already_active(client):
    mock_proc = _make_proc(1)
    with patch("asyncio.create_subprocess_exec", new=AsyncMock(return_value=mock_proc)):
        await client.post("/api/v1/projects/myproj/session/start")
    resp = await client.post("/api/v1/projects/myproj/session/start")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_start_session_not_found(client):
    resp = await client.post("/api/v1/projects/nonexistent/session/start")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_stop_session(client):
    mock_proc = _make_proc(2)
    with patch("asyncio.create_subprocess_exec", new=AsyncMock(return_value=mock_proc)):
        await client.post("/api/v1/projects/myproj/session/start")
    with patch("os.kill"):
        resp = await client.post("/api/v1/projects/myproj/session/stop")
    assert resp.status_code == 204
    p = CONTEXT.state_manager.get_project("myproj")
    assert p.session is None


@pytest.mark.asyncio
async def test_stop_session_not_found(client):
    resp = await client.post("/api/v1/projects/nonexistent/session/stop")
    assert resp.status_code == 404
