# tests/test_git_manager.py
import asyncio
import pathlib
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from libs.git_manager.git_manager import GitManager


class _AsyncLineIter:
    """Helper: async iterator over a list of byte lines."""

    def __init__(self, lines: list[bytes]) -> None:
        self._lines = iter(lines)

    def __aiter__(self):
        return self

    async def __anext__(self) -> bytes:
        try:
            return next(self._lines)
        except StopIteration:
            raise StopAsyncIteration


@pytest.fixture
def git_manager(tmp_path):
    return GitManager(workspaces_dir=tmp_path / "workspaces")


@pytest.mark.asyncio
async def test_clone_yields_progress_lines(git_manager, tmp_path):
    # Mock git subprocess that emits two output lines then exits
    mock_proc = MagicMock()
    mock_proc.stdout = _AsyncLineIter([
        b"Cloning into '/workspaces/my-repo'...\n",
        b"Receiving objects: 100%\n",
    ])
    mock_proc.wait = AsyncMock(return_value=0)
    mock_proc.returncode = 0

    lines = []
    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        async for line in git_manager.clone("https://github.com/u/my-repo", "my-repo"):
            lines.append(line)

    assert any("Cloning" in l for l in lines)


@pytest.mark.asyncio
async def test_clone_returns_error_on_nonzero_exit(git_manager):
    mock_proc = MagicMock()
    mock_proc.stdout = _AsyncLineIter([b"fatal: repo not found\n"])
    mock_proc.wait = AsyncMock(return_value=128)
    mock_proc.returncode = 128

    lines = []
    with patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        async for line in git_manager.clone("https://github.com/u/bad-repo", "bad-repo"):
            lines.append(line)

    assert any("fatal" in l.lower() or "error" in l.lower() for l in lines)


def test_workspace_path(git_manager, tmp_path):
    path = git_manager.workspace_path("my-repo")
    assert path == tmp_path / "workspaces" / "my-repo"
