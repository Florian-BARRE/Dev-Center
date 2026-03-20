# ====== Code Summary ======
# Tests for GitManager — async git clone into workspace directories.

# ====== Standard Library Imports ======
import pathlib

# ====== Third-Party Library Imports ======
import pytest

# ====== Internal Project Imports ======
from libs.git_ops.git_manager import GitManager


@pytest.fixture
def workspaces_dir(tmp_path: pathlib.Path) -> pathlib.Path:
    """Return a temp directory for workspace storage."""
    d = tmp_path / "workspaces"
    d.mkdir()
    return d


@pytest.fixture
def manager(workspaces_dir: pathlib.Path) -> GitManager:
    """Return a GitManager wired to the temp workspaces directory."""
    return GitManager(workspaces_dir=workspaces_dir)


@pytest.mark.asyncio
async def test_clone_returns_workspace_path(
    manager: GitManager, workspaces_dir: pathlib.Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """clone() returns the workspace path for the given project_id."""

    async def fake_subprocess(*args, **kwargs):
        """Fake subprocess that does nothing (simulates successful git clone)."""

        class FakeProc:
            async def wait(self) -> int:
                return 0
            returncode = 0

        return FakeProc()

    monkeypatch.setattr("libs.git_ops.git_manager.asyncio.create_subprocess_exec", fake_subprocess)

    workspace = await manager.clone("https://github.com/x/y", "project-1")
    assert workspace == workspaces_dir / "project-1"


@pytest.mark.asyncio
async def test_clone_raises_on_nonzero_exit(
    manager: GitManager, monkeypatch: pytest.MonkeyPatch
) -> None:
    """clone() raises RuntimeError when git exits with a non-zero code."""

    async def fake_subprocess(*args, **kwargs):
        class FakeProc:
            async def wait(self) -> int:
                return 1
            returncode = 1

        return FakeProc()

    monkeypatch.setattr("libs.git_ops.git_manager.asyncio.create_subprocess_exec", fake_subprocess)

    with pytest.raises(RuntimeError, match="git clone failed"):
        await manager.clone("https://github.com/x/y", "project-1")


@pytest.mark.asyncio
async def test_clone_skips_if_workspace_exists(
    manager: GitManager, workspaces_dir: pathlib.Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """clone() skips git clone if the workspace directory already exists."""
    # Pre-create the workspace directory
    existing = workspaces_dir / "project-1"
    existing.mkdir()

    called = []

    async def fake_subprocess(*args, **kwargs):
        called.append(True)

        class FakeProc:
            async def wait(self) -> int:
                return 0
            returncode = 0

        return FakeProc()

    monkeypatch.setattr("libs.git_ops.git_manager.asyncio.create_subprocess_exec", fake_subprocess)

    workspace = await manager.clone("https://github.com/x/y", "project-1")
    assert workspace == existing
    assert len(called) == 0  # git was NOT called
