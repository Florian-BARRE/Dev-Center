# ====== Code Summary ======
# GitManager — async git clone with line-by-line progress streaming.

from __future__ import annotations
import asyncio
import pathlib
import shutil
from collections.abc import AsyncIterator
from loggerplusplus import LoggerClass


class GitManager(LoggerClass):
    """
    Handles git clone operations with streaming output.

    Attributes:
        _workspaces_dir (pathlib.Path): Root directory for project workspaces.
        _clone_queues (dict[str, asyncio.Queue]): Per-project queues for clone
            progress messages.
    """

    def __init__(self, workspaces_dir: pathlib.Path) -> None:
        LoggerClass.__init__(self)
        self._workspaces_dir = workspaces_dir
        self._workspaces_dir.mkdir(parents=True, exist_ok=True)
        self._clone_queues: dict[str, asyncio.Queue] = {}

    def start_clone_queue(self, project_id: str) -> asyncio.Queue:
        """
        Create and register a progress queue for a clone operation.

        Args:
            project_id (str): Project slug.

        Returns:
            asyncio.Queue: The queue to push progress messages into.
        """
        q: asyncio.Queue = asyncio.Queue()
        self._clone_queues[project_id] = q
        return q

    async def tail_clone(self, project_id: str) -> AsyncIterator[dict]:
        """
        Yield clone progress messages for a project until the clone finishes.

        Args:
            project_id (str): Project slug.

        Yields:
            dict: Progress or done message dicts.
        """
        q = self._clone_queues.get(project_id)
        if q is None:
            yield {"type": "done", "success": False, "error": "no clone in progress"}
            return
        while True:
            msg = await q.get()
            if msg is None:
                break
            yield msg

    def workspace_path(self, project_id: str) -> pathlib.Path:
        """
        Return the expected workspace path for a project.

        Args:
            project_id (str): Project slug.

        Returns:
            pathlib.Path: Absolute workspace path.
        """
        return self._workspaces_dir / project_id

    async def clone(self, repo_url: str, project_id: str) -> AsyncIterator[str]:
        """
        Clone a git repository, yielding stdout lines as they arrive.

        Args:
            repo_url (str): HTTPS or SSH git URL to clone.
            project_id (str): Project slug (determines destination directory).

        Yields:
            str: Output lines from git clone.
        """
        dest = self.workspace_path(project_id)
        self.logger.info(f"Cloning '{repo_url}' → '{dest}'")

        proc = await asyncio.create_subprocess_exec(
            "git", "clone", "--progress", repo_url, str(dest),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )

        async for raw_line in proc.stdout:
            line = raw_line.decode(errors="replace").rstrip()
            yield line

        await proc.wait()

        if proc.returncode != 0:
            self.logger.error(f"git clone failed (exit {proc.returncode}) for '{repo_url}'")
            yield f"[ERROR] git clone exited with code {proc.returncode}"
        else:
            self.logger.info(f"Clone completed for '{project_id}'")

    def cleanup(self, project_id: str) -> None:
        """
        Remove the workspace directory for a project (cleanup on clone failure).

        Args:
            project_id (str): Project slug.
        """
        dest = self.workspace_path(project_id)
        if dest.exists():
            shutil.rmtree(dest, ignore_errors=True)
            self.logger.info(f"Cleaned up workspace for '{project_id}'")
