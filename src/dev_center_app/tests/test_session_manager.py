# tests/test_session_manager.py
import asyncio
import pathlib
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from libs.state.models import Project, ScheduleConfig
from libs.state.state_manager import StateManager
from libs.event_bus.event_bus import EventBus
from libs.session_manager.session_manager import SessionManager


@pytest.fixture
def session_manager(tmp_data, tmp_path):
    sm = StateManager(data_dir=tmp_data)
    eb = EventBus()
    return SessionManager(
        state_manager=sm,
        workspaces_dir=tmp_path / "workspaces",
        claude_dir=tmp_path / ".claude",
        event_bus=eb,
        default_ttl_hours=8,
        renew_threshold_minutes=30,
    )


@pytest.fixture
def project_in_state(state_manager):
    p = Project(
        id="my-proj",
        name="my-proj",
        repo_url="https://github.com/user/my-proj",
        workspace_path="/workspaces/my-proj",
    )
    state_manager.upsert_project(p)
    return p


@pytest.mark.asyncio
async def test_start_session(session_manager, state_manager, project_in_state):
    mock_proc = MagicMock()
    mock_proc.pid = 1234
    mock_proc.stdout = AsyncMock()

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc) as mock_exec:
        await session_manager.start_session("my-proj")

    project = state_manager.get_project("my-proj")
    assert project.session is not None
    assert project.session.pid == 1234
    assert project.session.auto_renew is True
    # Verify --continue flag was passed
    args = mock_exec.call_args[0]
    assert "--continue" in args


@pytest.mark.asyncio
async def test_start_session_already_active(session_manager, state_manager, project_in_state):
    mock_proc = MagicMock()
    mock_proc.pid = 1234
    mock_proc.stdout = AsyncMock()

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        await session_manager.start_session("my-proj")

    with patch("asyncio.create_subprocess_exec") as mock_exec:
        await session_manager.start_session("my-proj")
        mock_exec.assert_not_called()


@pytest.mark.asyncio
async def test_stop_session(session_manager, state_manager, project_in_state):
    mock_proc = MagicMock()
    mock_proc.pid = 5678
    mock_proc.stdout = AsyncMock()

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        await session_manager.start_session("my-proj")

    with patch("os.kill") as mock_kill:
        await session_manager.stop_session("my-proj")
        mock_kill.assert_called_once()

    project = state_manager.get_project("my-proj")
    assert project.session is None


@pytest.mark.asyncio
async def test_stop_session_no_session(session_manager, project_in_state):
    # Should not raise
    await session_manager.stop_session("my-proj")


@pytest.mark.asyncio
async def test_renew_session(session_manager, state_manager, project_in_state):
    mock_proc = MagicMock()
    mock_proc.pid = 100
    mock_proc.stdout = AsyncMock()

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        await session_manager.start_session("my-proj")

    mock_proc2 = MagicMock()
    mock_proc2.pid = 200
    mock_proc2.stdout = AsyncMock()

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc2), \
         patch("os.kill"):
        await session_manager.renew_session("my-proj")

    project = state_manager.get_project("my-proj")
    assert project.session.pid == 200


@pytest.mark.asyncio
async def test_session_publishes_event(tmp_data, tmp_path):
    sm = StateManager(data_dir=tmp_data)
    eb = EventBus()
    events = []
    async def capture(event_type, data):
        events.append((event_type, data))
    eb.subscribe("session.started", capture)

    mgr = SessionManager(
        state_manager=sm, workspaces_dir=tmp_path / "w",
        claude_dir=tmp_path / ".claude", event_bus=eb,
        default_ttl_hours=8, renew_threshold_minutes=30,
    )
    sm.upsert_project(Project(
        id="p", name="p",
        repo_url="https://github.com/u/p",
        workspace_path="/workspaces/p",
    ))
    mock_proc = MagicMock()
    mock_proc.pid = 42
    mock_proc.stdout = AsyncMock()

    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        await mgr.start_session("p")

    assert any(t == "session.started" for t, _ in events)
