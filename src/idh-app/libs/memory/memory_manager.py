# ====== Code Summary ======
# MemoryManager — reads and writes per-project CLAUDE.md, SESSION_MEMORY.md,
# and JSONL transcript files.

# ====== Standard Library Imports ======
import pathlib

# ====== Third-Party Library Imports ======
from loggerplusplus import LoggerClass


class MemoryManager(LoggerClass):
    """
    Manages per-project memory files.

    All files live under ``<workspaces_dir>/<project_id>/``:
    - ``CLAUDE.md``          — project context injected into every Claude session.
    - ``SESSION_MEMORY.md``  — running session memory written by the agent.
    - ``*.jsonl``            — Claude Code transcript files.

    Attributes:
        _workspaces_dir (pathlib.Path): Root workspaces directory.
    """

    def __init__(self, workspaces_dir: pathlib.Path) -> None:
        """
        Initialise the MemoryManager.

        Args:
            workspaces_dir (pathlib.Path): Path to the workspaces root directory.
        """
        LoggerClass.__init__(self)
        self._workspaces_dir = workspaces_dir

    # ──────────────────────────── Private helpers ────────────────────────────

    def _memory_path(self, project_id: str) -> pathlib.Path:
        """
        Resolve the CLAUDE.md path for a given project.

        CLAUDE.md lives at the root of the project workspace so Claude Code
        picks it up automatically when it starts in that directory.

        Args:
            project_id (str): Project identifier.

        Returns:
            pathlib.Path: Full path to the project's CLAUDE.md file.
        """
        return self._workspaces_dir / project_id / "CLAUDE.md"

    # ──────────────────────────── Public API ────────────────────────────────

    def read_memory(self, project_id: str) -> str | None:
        """
        Read the CLAUDE.md content for a project.

        Args:
            project_id (str): Project identifier.

        Returns:
            str | None: File content, or None if the file does not exist.
        """
        # 1. Resolve path and return content or None
        path = self._memory_path(project_id)
        if not path.exists():
            return None
        return path.read_text()

    def write_memory(self, project_id: str, content: str) -> None:
        """
        Write content to the CLAUDE.md file for a project.

        Creates the parent directory if it does not exist.

        Args:
            project_id (str): Project identifier.
            content (str): Markdown content to write.
        """
        # 1. Ensure the project directory exists
        path = self._memory_path(project_id)
        path.parent.mkdir(parents=True, exist_ok=True)

        # 2. Write the memory content
        path.write_text(content)
        self.logger.info(f"Memory written for project '{project_id}'")

    def read_session_memory(self, project_id: str) -> str:
        """
        Read SESSION_MEMORY.md content for a project.

        Args:
            project_id (str): Project identifier.

        Returns:
            str: File content.

        Raises:
            FileNotFoundError: If SESSION_MEMORY.md does not exist.
        """
        # 1. Resolve path and return content
        path = self._workspaces_dir / project_id / "SESSION_MEMORY.md"
        if not path.exists():
            raise FileNotFoundError(f"SESSION_MEMORY.md not found for '{project_id}'")
        return path.read_text()

    def write_session_memory(self, project_id: str, content: str) -> None:
        """
        Write content to SESSION_MEMORY.md for a project.

        Creates the workspace directory if it does not exist.

        Args:
            project_id (str): Project identifier.
            content (str): New content to write.
        """
        # 1. Ensure workspace directory exists and write content
        path = self._workspaces_dir / project_id / "SESSION_MEMORY.md"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
        self.logger.info(f"Session memory written for project '{project_id}'")

    def get_latest_transcript(self, project_id: str) -> str:
        """
        Read the content of the most recently modified JSONL transcript file for a project.

        Args:
            project_id (str): Project identifier.

        Returns:
            str: Raw JSONL content.

        Raises:
            FileNotFoundError: If no .jsonl file exists in the project workspace.
        """
        # 1. Find newest JSONL file by modification time
        ws = self._workspaces_dir / project_id
        jsonl_files = sorted(ws.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)
        if not jsonl_files:
            raise FileNotFoundError(f"No transcript found for '{project_id}'")

        # 2. Return content of newest file
        return jsonl_files[0].read_text()
