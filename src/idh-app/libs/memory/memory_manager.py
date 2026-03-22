# ====== Code Summary ======
# MemoryManager — reads and writes per-project CLAUDE.md, SESSION_MEMORY.md,
# and JSONL transcript files.

# ====== Standard Library Imports ======
from __future__ import annotations

import asyncio
import pathlib
from typing import TYPE_CHECKING

# ====== Third-Party Library Imports ======
from loggerplusplus import LoggerClass

if TYPE_CHECKING:
    from libs.event_bus.event_bus import EventBus


class MemoryManager(LoggerClass):
    """
    Manages per-project memory files.

    CLAUDE.md files live at ``<claude_dir>/projects/<project_id>/CLAUDE.md``
    and are used to provide project context to Claude agents.

    SESSION_MEMORY.md and JSONL transcript files live at
    ``<workspaces_dir>/<project_id>/``.

    Attributes:
        _claude_dir (pathlib.Path): Root Claude configuration directory.
        _workspaces_dir (pathlib.Path): Root workspaces directory.
        _event_bus (EventBus | None): Optional event bus for publishing real-time events.
    """

    def __init__(
        self,
        claude_dir: pathlib.Path,
        workspaces_dir: pathlib.Path,
        event_bus: "EventBus | None" = None,
    ) -> None:
        """
        Initialise the MemoryManager.

        Args:
            claude_dir (pathlib.Path): Path to the Claude config directory.
            workspaces_dir (pathlib.Path): Path to the workspaces root directory.
            event_bus (EventBus | None): Optional event bus for real-time event emission.
        """
        LoggerClass.__init__(self)
        self._claude_dir = claude_dir
        self._workspaces_dir = workspaces_dir
        self._event_bus: "EventBus | None" = event_bus

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

        # 3. Emit memory.updated event
        if self._event_bus is not None:
            asyncio.create_task(
                self._event_bus.publish(
                    "memory.updated",
                    {"project_id": project_id, "file": "CLAUDE.md"},
                )
            )

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

        # 3. Emit memory.updated event
        if self._event_bus is not None:
            asyncio.create_task(
                self._event_bus.publish(
                    "memory.updated",
                    {"project_id": project_id, "file": "SESSION_MEMORY.md"},
                )
            )

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
