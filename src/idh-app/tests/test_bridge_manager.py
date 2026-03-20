# ====== Code Summary ======
# Tests for BridgeManager — bridge lifecycle and watchdog.

# ====== Standard Library Imports ======
import asyncio
import datetime
import pathlib

# ====== Third-Party Library Imports ======
import pytest

# ====== Internal Project Imports ======
from libs.bridge.bridge_manager import BridgeManager
from libs.state.models import BridgeState, Project, StateFile
from libs.state.state_manager import StateManager


@pytest.fixture
def state_path(tmp_path: pathlib.Path) -> pathlib.Path:
    """Return a temp path for the state file."""
    return tmp_path / "state.json"


@pytest.fixture
def manager(
    state_path: pathlib.Path,
    tmp_path: pathlib.Path,
) -> BridgeManager:
    """Return a BridgeManager wired to temp directories."""
    return BridgeManager(
        state_manager=StateManager(state_path=state_path),
        codex_dir=tmp_path / "codex",
        claude_dir=tmp_path / "claude",
        bridge_ttl_hours=8,
    )


@pytest.mark.asyncio
async def test_start_bridge_writes_state(
    manager: BridgeManager,
    state_path: pathlib.Path,
    tmp_path: pathlib.Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """start_bridge() persists the bridge PID and workspace in state."""
    workspace = tmp_path / "ws"
    workspace.mkdir()

    # Pre-seed state with the project
    sm = StateManager(state_path=state_path)
    sm.upsert_project(
        "g1",
        Project(group_id="g1", project_id="p1", repo_url="https://github.com/x/y"),
    )

    async def fake_subprocess(*args, **kwargs):
        class FakeProc:
            pid = 9999
            async def wait(self) -> int:
                return 0
        return FakeProc()

    monkeypatch.setattr(
        "libs.bridge.bridge_manager.asyncio.create_subprocess_exec", fake_subprocess
    )

    await manager.start_bridge(group_id="g1", workspace=workspace)

    project = sm.get_project("g1")
    assert project is not None
    assert project.bridge is not None
    assert project.bridge.pid == 9999
    assert project.bridge.workspace == str(workspace)


@pytest.mark.asyncio
async def test_stop_bridge_clears_state(
    manager: BridgeManager,
    state_path: pathlib.Path,
    tmp_path: pathlib.Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """stop_bridge() kills the process and removes bridge state."""
    workspace = tmp_path / "ws"

    # Seed state with an active bridge
    sm = StateManager(state_path=state_path)
    expires = (datetime.datetime.now(datetime.UTC) + datetime.timedelta(hours=8)).isoformat()
    sm.upsert_project(
        "g1",
        Project(
            group_id="g1",
            project_id="p1",
            repo_url="https://github.com/x/y",
            bridge=BridgeState(pid=1234, workspace=str(workspace), expires_at=expires),
        ),
    )

    killed = []

    def fake_kill(pid: int, sig: int) -> None:
        killed.append(pid)

    monkeypatch.setattr("libs.bridge.bridge_manager.os.kill", fake_kill)

    await manager.stop_bridge("g1")

    project = sm.get_project("g1")
    assert project is not None
    assert project.bridge is None
    assert 1234 in killed


@pytest.mark.asyncio
async def test_watchdog_kills_expired_bridges(
    manager: BridgeManager,
    state_path: pathlib.Path,
    tmp_path: pathlib.Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """_check_expired() kills bridges whose expires_at is in the past."""
    workspace = tmp_path / "ws"

    # Seed state with an expired bridge
    sm = StateManager(state_path=state_path)
    past = (datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=1)).isoformat()
    sm.upsert_project(
        "g1",
        Project(
            group_id="g1",
            project_id="p1",
            repo_url="https://github.com/x/y",
            bridge=BridgeState(pid=5555, workspace=str(workspace), expires_at=past),
        ),
    )

    killed = []

    def fake_kill(pid: int, sig: int) -> None:
        killed.append(pid)

    monkeypatch.setattr("libs.bridge.bridge_manager.os.kill", fake_kill)

    await manager._check_expired()

    project = sm.get_project("g1")
    assert project is not None
    assert project.bridge is None
    assert 5555 in killed


@pytest.mark.asyncio
async def test_watchdog_leaves_active_bridges_alone(
    manager: BridgeManager,
    state_path: pathlib.Path,
    tmp_path: pathlib.Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """_check_expired() does not kill bridges that have not yet expired."""
    workspace = tmp_path / "ws"

    sm = StateManager(state_path=state_path)
    future = (datetime.datetime.now(datetime.UTC) + datetime.timedelta(hours=4)).isoformat()
    sm.upsert_project(
        "g1",
        Project(
            group_id="g1",
            project_id="p1",
            repo_url="https://github.com/x/y",
            bridge=BridgeState(pid=7777, workspace=str(workspace), expires_at=future),
        ),
    )

    killed = []

    def fake_kill(pid: int, sig: int) -> None:
        killed.append(pid)

    monkeypatch.setattr("libs.bridge.bridge_manager.os.kill", fake_kill)

    await manager._check_expired()

    project = sm.get_project("g1")
    assert project is not None
    assert project.bridge is not None  # still alive
    assert 7777 not in killed
