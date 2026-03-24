# tests/conftest.py
# Shared pytest fixtures — services wired with temp directories.
# Note: conftest imports from libs/backend are deferred to avoid import errors
# before those modules are implemented in later tasks.

import pathlib
import pytest
from loggerplusplus import loggerplusplus
from libs.state.state_manager import StateManager


@pytest.fixture
def tmp_data(tmp_path: pathlib.Path) -> pathlib.Path:
    """Temporary /data directory for state files."""
    d = tmp_path / "data"
    d.mkdir()
    return d


@pytest.fixture
def state_manager(tmp_data: pathlib.Path) -> StateManager:
    """StateManager wired to a temp directory."""
    return StateManager(data_dir=tmp_data)


def setup_context(tmp_data: pathlib.Path, tmp_path: pathlib.Path) -> None:
    """
    Wire all CONTEXT services with temp directories for integration tests.

    Sets up StateManager, EventBus, GitManager, SessionManager, and a
    no-op logger on the CONTEXT class. Does not start the watchdog or
    scheduler — those are tested in isolation.

    Args:
        tmp_data (pathlib.Path): Temp directory for state files.
        tmp_path (pathlib.Path): Temp root for workspaces and .claude dir.
    """
    from backend.context import CONTEXT
    from libs.state.state_manager import StateManager
    from libs.event_bus.event_bus import EventBus
    from libs.git_manager.git_manager import GitManager
    from libs.session_manager.session_manager import SessionManager
    from loggerplusplus import loggerplusplus

    # 1. Wire all services
    CONTEXT.state_manager = StateManager(data_dir=tmp_data)
    CONTEXT.event_bus = EventBus()
    CONTEXT.git_manager = GitManager(workspaces_dir=tmp_path / "workspaces")
    CONTEXT.session_manager = SessionManager(
        state_manager=CONTEXT.state_manager,
        workspaces_dir=tmp_path / "workspaces",
        claude_dir=tmp_path / ".claude",
        event_bus=CONTEXT.event_bus,
        default_ttl_hours=8,
        renew_threshold_minutes=30,
    )

    # 2. Bind a test logger
    CONTEXT.logger = loggerplusplus.bind(identifier="TEST")
