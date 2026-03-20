# ====== Code Summary ======
# GitManager — async git operations for workspace initialisation.

# ====== Standard Library Imports ======
import asyncio
import pathlib

# ====== Third-Party Library Imports ======
from loggerplusplus import LoggerClass


class GitManager(LoggerClass):
    """
    Manages git operations for project workspace initialisation.

    Clones repositories into per-project workspace directories under
    the configured workspaces root. Uses ``asyncio.create_subprocess_exec``
    to run git non-blocking.

    Attributes:
        _workspaces_dir (pathlib.Path): Root directory where workspaces are created.
    """

    def __init__(self, workspaces_dir: pathlib.Path) -> None:
        """
        Initialise the GitManager.

        Args:
            workspaces_dir (pathlib.Path): Root directory for workspace storage.
        """
        LoggerClass.__init__(self)
        self._workspaces_dir = workspaces_dir

    # ──────────────────────────── Public API ────────────────────────────────

    async def clone(self, repo_url: str, project_id: str) -> pathlib.Path:
        """
        Clone a git repository into a workspace directory.

        If the workspace directory already exists, the clone is skipped and
        the existing path is returned.

        Args:
            repo_url (str): Git repository URL to clone.
            project_id (str): Project identifier used as the workspace directory name.

        Returns:
            pathlib.Path: Absolute path to the project workspace directory.

        Raises:
            RuntimeError: If the git clone process exits with a non-zero code.
        """
        # 1. Resolve the target workspace path
        workspace = self._workspaces_dir / project_id

        # 2. Skip clone if workspace already exists
        if workspace.exists():
            self.logger.info(f"Workspace '{project_id}' already exists, skipping clone")
            return workspace

        # 3. Run git clone and wait for completion
        self.logger.info(f"Cloning '{repo_url}' into '{workspace}'")
        proc = await asyncio.create_subprocess_exec(
            "git", "clone", repo_url, str(workspace)
        )
        await proc.wait()

        # 4. Raise on non-zero exit
        if proc.returncode != 0:
            raise RuntimeError(f"git clone failed for '{repo_url}' (exit {proc.returncode})")

        self.logger.info(f"Clone complete: '{workspace}'")
        return workspace
