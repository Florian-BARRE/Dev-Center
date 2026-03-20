# ====== Code Summary ======
# Tests for StateManager — state file CRUD with filelock.

# ====== Standard Library Imports ======
import json
import pathlib

# ====== Third-Party Library Imports ======
import pytest

# ====== Internal Project Imports ======
from libs.state.models import BridgeState, Project, StateFile
from libs.state.state_manager import StateManager


@pytest.fixture
def state_path(tmp_path: pathlib.Path) -> pathlib.Path:
    """Return a temp path for the state file."""
    return tmp_path / "state.json"


@pytest.fixture
def manager(state_path: pathlib.Path) -> StateManager:
    """Return a StateManager instance wired to the temp state file."""
    return StateManager(state_path=state_path)


def test_load_creates_empty_state_when_missing(manager: StateManager) -> None:
    """StateManager.load() returns an empty StateFile when the file does not exist."""
    state = manager.load()
    assert state.projects == {}


def test_save_and_load_roundtrip(manager: StateManager, state_path: pathlib.Path) -> None:
    """Saved state can be reloaded exactly."""
    project = Project(
        group_id="g1",
        project_id="p1",
        repo_url="https://github.com/x/y",
    )
    state = StateFile(projects={"g1": project})
    manager.save(state)

    loaded = manager.load()
    assert loaded.projects["g1"].project_id == "p1"
    assert loaded.projects["g1"].repo_url == "https://github.com/x/y"


def test_state_file_written_as_camel_case(manager: StateManager, state_path: pathlib.Path) -> None:
    """The state JSON on disk uses camelCase keys."""
    project = Project(
        group_id="g1",
        project_id="p1",
        repo_url="https://github.com/x/y",
    )
    state = StateFile(projects={"g1": project})
    manager.save(state)

    raw = json.loads(state_path.read_text())
    project_data = raw["projects"]["g1"]
    assert "groupId" in project_data
    assert "projectId" in project_data
    assert "repoUrl" in project_data


def test_get_project_returns_none_for_missing(manager: StateManager) -> None:
    """StateManager.get_project() returns None for unknown group_id."""
    result = manager.get_project("nonexistent")
    assert result is None


def test_get_project_returns_project(manager: StateManager) -> None:
    """StateManager.get_project() returns the project for a known group_id."""
    project = Project(
        group_id="g1",
        project_id="p1",
        repo_url="https://github.com/x/y",
    )
    state = StateFile(projects={"g1": project})
    manager.save(state)

    result = manager.get_project("g1")
    assert result is not None
    assert result.project_id == "p1"


def test_upsert_project(manager: StateManager) -> None:
    """StateManager.upsert_project() writes a new project and persists it."""
    project = Project(
        group_id="g2",
        project_id="p2",
        repo_url="https://github.com/a/b",
    )
    manager.upsert_project("g2", project)

    result = manager.get_project("g2")
    assert result is not None
    assert result.project_id == "p2"
