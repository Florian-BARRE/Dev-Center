# ====== Code Summary ======
# MemoryManager — reads and writes per-project CLAUDE.md files.

# ====== Standard Library Imports ======
import pathlib

# ====== Third-Party Library Imports ======
from loggerplusplus import LoggerClass


class MemoryManager(LoggerClass):
    """
    Manages per-project memory stored as CLAUDE.md files.

    Memory files live at ``<claude_dir>/projects/<project_id>/CLAUDE.md``
    and are used to provide project context to Claude agents.

    Attributes:
        _claude_dir (pathlib.Path): Root Claude configuration directory.
    """

    def __init__(self, claude_dir: pathlib.Path) -> None:
        """
        Initialise the MemoryManager.

        Args:
            claude_dir (pathlib.Path): Path to the Claude config directory.
        """
        LoggerClass.__init__(self)
        self._claude_dir = claude_dir

    # ──────────────────────────── Private helpers ────────────────────────────

    def _memory_path(self, project_id: str) -> pathlib.Path:
        """
        Resolve the CLAUDE.md path for a given project.

        Args:
            project_id (str): Project identifier.

        Returns:
            pathlib.Path: Full path to the project's CLAUDE.md file.
        """
        return self._claude_dir / "projects" / project_id / "CLAUDE.md"

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
