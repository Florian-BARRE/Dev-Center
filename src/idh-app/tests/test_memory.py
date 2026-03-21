# ====== Code Summary ======
# Tests for MemoryManager and CodexSummarizer.

# ====== Standard Library Imports ======
import pathlib

# ====== Third-Party Library Imports ======
import pytest

# ====== Internal Project Imports ======
from libs.memory.memory_manager import MemoryManager
from libs.memory.codex_summarizer import CodexSummarizer


@pytest.fixture
def claude_dir(tmp_path: pathlib.Path) -> pathlib.Path:
    """Return a temp Claude config directory with the projects subdir."""
    d = tmp_path / "claude"
    (d / "projects").mkdir(parents=True)
    return d


@pytest.fixture
def workspaces_dir(tmp_path: pathlib.Path) -> pathlib.Path:
    """Return a temp workspaces directory."""
    d = tmp_path / "workspaces"
    d.mkdir(parents=True)
    return d


@pytest.fixture
def memory_manager(claude_dir: pathlib.Path, workspaces_dir: pathlib.Path) -> MemoryManager:
    """Return a MemoryManager wired to the temp Claude dir and workspaces dir."""
    return MemoryManager(claude_dir=claude_dir, workspaces_dir=workspaces_dir)


@pytest.fixture
def codex_dir(tmp_path: pathlib.Path) -> pathlib.Path:
    """Return a temp Codex home directory."""
    d = tmp_path / "codex"
    d.mkdir()
    return d


def test_write_and_read_memory(memory_manager: MemoryManager) -> None:
    """write_memory() persists content; read_memory() retrieves it."""
    memory_manager.write_memory("proj-1", "# Memory\n\nSome context.")
    content = memory_manager.read_memory("proj-1")
    assert content == "# Memory\n\nSome context."


def test_read_memory_returns_none_when_missing(memory_manager: MemoryManager) -> None:
    """read_memory() returns None when no CLAUDE.md exists for the project."""
    result = memory_manager.read_memory("nonexistent-project")
    assert result is None


def test_memory_file_path(memory_manager: MemoryManager, claude_dir: pathlib.Path) -> None:
    """CLAUDE.md is written inside <claude_dir>/projects/<project_id>/CLAUDE.md."""
    memory_manager.write_memory("proj-2", "content")
    expected = claude_dir / "projects" / "proj-2" / "CLAUDE.md"
    assert expected.exists()


@pytest.mark.asyncio
async def test_codex_summarizer_runs_subprocess(
    codex_dir: pathlib.Path,
    tmp_path: pathlib.Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """CodexSummarizer.summarize() runs codex compress and returns stdout."""
    workspace = tmp_path / "ws"
    workspace.mkdir()

    async def fake_subprocess(*args, **kwargs):
        class FakeProc:
            async def communicate(self):
                return (b"Summary output\n", b"")
            returncode = 0
        return FakeProc()

    monkeypatch.setattr(
        "libs.memory.codex_summarizer.asyncio.create_subprocess_exec",
        fake_subprocess,
    )

    summarizer = CodexSummarizer(codex_dir=codex_dir)
    result = await summarizer.summarize(workspace=workspace)
    assert result == "Summary output"
