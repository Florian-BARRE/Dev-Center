# ====== Code Summary ======
# BridgeManager — starts/stops claude remote-control bridges and runs the expiry watchdog.

# ====== Standard Library Imports ======
import asyncio
import datetime
import os
import pathlib
import signal
from collections.abc import AsyncIterator

# ====== Third-Party Library Imports ======
from loggerplusplus import LoggerClass

# ====== Local Project Imports ======
from libs.state.models import BridgeState
from libs.state.state_manager import StateManager


class BridgeManager(LoggerClass):
    """
    Manages the lifecycle of ``claude remote-control`` bridge subprocesses.

    Each project gets one bridge process that allows Claude to operate in its
    workspace. Bridges are tracked via BridgeState in the shared state file and
    are automatically killed by the watchdog when they expire.

    Attributes:
        _state_manager (StateManager): Persisted project state.
        _codex_dir (pathlib.Path): Path to the Codex CLI home directory.
        _claude_dir (pathlib.Path): Path to the Claude config directory.
        _bridge_ttl_hours (int): Bridge lifetime in hours.
        _processes (dict[str, asyncio.subprocess.Process]): In-memory map of
            group_id → live subprocess handle for log streaming.
    """

    def __init__(
        self,
        state_manager: StateManager,
        codex_dir: pathlib.Path,
        claude_dir: pathlib.Path,
        bridge_ttl_hours: int,
    ) -> None:
        """
        Initialise the BridgeManager.

        Args:
            state_manager (StateManager): Shared state manager instance.
            codex_dir (pathlib.Path): Codex home directory path.
            claude_dir (pathlib.Path): Claude config directory path.
            bridge_ttl_hours (int): Bridge TTL in hours.
        """
        LoggerClass.__init__(self)
        self._state_manager = state_manager
        self._codex_dir = codex_dir
        self._claude_dir = claude_dir
        self._bridge_ttl_hours = bridge_ttl_hours
        # In-memory process map — enables log streaming via tail_logs()
        self._processes: dict[str, asyncio.subprocess.Process] = {}

    # ──────────────────────────── Private helpers ────────────────────────────

    def _expires_at(self) -> str:
        """
        Compute the ISO-8601 UTC expiry timestamp for a new bridge.

        Returns:
            str: ISO-8601 formatted UTC expiry timestamp.
        """
        return (
            datetime.datetime.now(datetime.UTC)
            + datetime.timedelta(hours=self._bridge_ttl_hours)
        ).isoformat()

    def _kill_bridge(self, pid: int) -> None:
        """
        Send SIGTERM to a bridge process, ignoring process-not-found and permission errors.

        Args:
            pid (int): OS process ID of the bridge subprocess.
        """
        try:
            os.kill(pid, signal.SIGTERM)
            self.logger.info(f"Sent SIGTERM to bridge PID {pid}")
        except ProcessLookupError:
            self.logger.warning(f"Bridge PID {pid} already gone")
        except PermissionError:
            self.logger.warning(f"No permission to signal bridge PID {pid} — PID may have been recycled")

    # ──────────────────────────── Protected (watchdog) ──────────────────────

    async def _check_expired(self) -> None:
        """
        Check all bridges in state and kill any that have expired.

        Iterates the full state, compares each bridge's ``expires_at`` to
        the current UTC time, and stops expired bridges.
        """
        # 1. Load current state
        state = self._state_manager.load()
        now = datetime.datetime.now(datetime.UTC)

        # 2. Iterate all projects and kill expired bridges
        for group_id, project in state.projects.items():
            if project.bridge is None:
                continue
            expires = datetime.datetime.fromisoformat(project.bridge.expires_at)
            if expires <= now:
                self.logger.info(f"Bridge for group '{group_id}' expired — killing PID {project.bridge.pid}")
                self._kill_bridge(project.bridge.pid)
                project.bridge = None

        # 3. Persist the updated state
        self._state_manager.save(state)

    async def _watchdog_loop(self) -> None:
        """
        Run the expiry watchdog indefinitely, checking every 60 seconds.
        """
        while True:
            await asyncio.sleep(60)
            await self._check_expired()

    # ──────────────────────────── Public API ────────────────────────────────

    async def start_bridge(self, group_id: str, workspace: pathlib.Path) -> None:
        """
        Launch a ``claude remote-control`` bridge for the given project.

        Starts the bridge subprocess, records its PID and expiry in the
        state file, and returns once the process is running.

        Args:
            group_id (str): Telegram group ID that owns the project.
            workspace (pathlib.Path): Project workspace directory.
        """
        # 1. Check if a bridge is already running for this project
        project = self._state_manager.get_project(group_id)
        if project is not None and project.bridge is not None:
            self.logger.info(f"Bridge already running for group '{group_id}' (PID {project.bridge.pid}) — skipping")
            return

        # 2. Compute expiry and build the bridge command
        expires = self._expires_at()
        projects_dir = self._claude_dir / "projects"

        # 3. Launch the claude remote-control subprocess with stdout piped for log streaming
        self.logger.info(f"Starting bridge for group '{group_id}' in '{workspace}'")
        proc = await asyncio.create_subprocess_exec(
            "claude",
            "remote-control",
            "--workspace", str(workspace),
            "--codex-dir", str(self._codex_dir),
            "--claude-dir", str(self._claude_dir),
            "--claude-projects-dir", str(projects_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )

        # 4. Persist the bridge state and retain the process handle for log streaming
        bridge = BridgeState(pid=proc.pid, workspace=str(workspace), expires_at=expires)
        project = self._state_manager.get_project(group_id)
        if project is not None:
            project.bridge = bridge
            self._state_manager.upsert_project(group_id, project)
        self._processes[group_id] = proc
        self.logger.info(f"Bridge PID {proc.pid} started for group '{group_id}'")

    async def stop_bridge(self, group_id: str) -> None:
        """
        Stop the active bridge for a project and clear its state.

        Args:
            group_id (str): Telegram group ID whose bridge should be stopped.
        """
        # 1. Load the project's bridge state
        project = self._state_manager.get_project(group_id)
        if project is None or project.bridge is None:
            self.logger.warning(f"No active bridge found for group '{group_id}'")
            return

        # 2. Kill the bridge process and clear state
        self._kill_bridge(project.bridge.pid)
        project.bridge = None
        self._state_manager.upsert_project(group_id, project)
        # Remove the in-memory process handle so tail_logs returns early
        self._processes.pop(group_id, None)
        self.logger.info(f"Bridge stopped for group '{group_id}'")

    async def renew_bridge(self, group_id: str) -> None:
        """
        Renew a bridge: stop the current one, then restart it using the same workspace.

        Args:
            group_id (str): Telegram group ID.
        """
        # 1. Capture workspace from current bridge state BEFORE stopping
        project = self._state_manager.get_project(group_id)
        if project is None:
            self.logger.warning(f"Cannot renew bridge for group '{group_id}': project not found")
            return
        workspace = pathlib.Path(project.bridge.workspace) if project.bridge is not None else None

        # 2. Stop the current bridge
        await self.stop_bridge(group_id)

        # 3. If no prior workspace was recorded, we cannot restart
        if workspace is None:
            self.logger.warning(f"Cannot renew bridge for group '{group_id}': no prior workspace recorded")
            return

        # 4. Respawn bridge at the same workspace
        await self.start_bridge(group_id=group_id, workspace=workspace)

    async def tail_logs(self, group_id: str) -> AsyncIterator[str]:
        """
        Async generator that yields stdout lines from the active bridge process.

        Yields one decoded, right-stripped line at a time. If no active process
        exists for the group, a single sentinel message is yielded and the
        generator exits.

        Args:
            group_id (str): Telegram group ID.

        Yields:
            str: One line of output at a time.
        """
        # 1. Look up the running subprocess handle
        process = self._processes.get(group_id)
        if process is None or process.stdout is None:
            yield f"(no active bridge process for group '{group_id}')"
            return

        # 2. Stream stdout lines until the process closes its pipe
        async for line in process.stdout:
            yield line.decode().rstrip()

    async def start_watchdog(self) -> asyncio.Task:
        """
        Start the background watchdog task that reaps expired bridges.

        Returns:
            asyncio.Task: The running watchdog asyncio task.
        """
        # 1. Schedule and return the watchdog background task
        self.logger.info(f"Starting bridge watchdog (TTL={self._bridge_ttl_hours}h)")
        return asyncio.create_task(self._watchdog_loop())
