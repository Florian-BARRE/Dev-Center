# ====== Code Summary ======
# SessionManager — lifecycle of claude remote-control subprocesses.

from __future__ import annotations
import asyncio
import datetime
import os
import pathlib
import signal
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, Any

from loggerplusplus import LoggerClass
from libs.state.models import SessionState
from libs.state.state_manager import StateManager

if TYPE_CHECKING:
    from libs.event_bus.event_bus import EventBus


class SessionManager(LoggerClass):
    """
    Manages claude remote-control subprocess lifecycle per project.

    Each project gets one subprocess at a time. All start/stop/renew
    operations acquire a per-project asyncio.Lock to prevent races
    between the API, watchdog, and scheduler.

    Attributes:
        _state_manager (StateManager): Persisted project state.
        _workspaces_dir (pathlib.Path): Root directory for project workspaces.
        _claude_dir (pathlib.Path): ~/.claude directory path.
        _event_bus (EventBus): For publishing session lifecycle events.
        _default_ttl_hours (int): Session TTL in hours.
        _renew_threshold_minutes (int): Renew when TTL falls below this.
        _processes (dict[str, Any]): Live subprocess handles.
        _locks (dict[str, asyncio.Lock]): Per-project concurrency locks.
    """

    def __init__(
        self,
        state_manager: StateManager,
        workspaces_dir: pathlib.Path,
        claude_dir: pathlib.Path,
        event_bus: "EventBus",
        default_ttl_hours: int,
        renew_threshold_minutes: int,
    ) -> None:
        LoggerClass.__init__(self)
        self._state_manager = state_manager
        self._workspaces_dir = workspaces_dir
        self._claude_dir = claude_dir
        self._event_bus = event_bus
        self._default_ttl_hours = default_ttl_hours
        self._renew_threshold_minutes = renew_threshold_minutes
        self._processes: dict[str, Any] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    # ──────────────────────── Private helpers ────────────────────────

    def _get_lock(self, project_id: str) -> asyncio.Lock:
        """Get or create the per-project asyncio.Lock."""
        if project_id not in self._locks:
            self._locks[project_id] = asyncio.Lock()
        return self._locks[project_id]

    def _expires_at(self) -> str:
        """Compute ISO-8601 UTC expiry timestamp for a new session."""
        return (
            datetime.datetime.now(datetime.UTC)
            + datetime.timedelta(hours=self._default_ttl_hours)
        ).isoformat()

    def _started_at(self) -> str:
        """Return current ISO-8601 UTC timestamp."""
        return datetime.datetime.now(datetime.UTC).isoformat()

    def _kill(self, pid: int) -> None:
        """Send SIGTERM to a process, ignoring not-found and permission errors."""
        try:
            os.kill(pid, signal.SIGTERM)
            self.logger.info(f"Sent SIGTERM to PID {pid}")
        except ProcessLookupError:
            self.logger.warning(f"PID {pid} already gone")
        except PermissionError:
            self.logger.warning(f"No permission to signal PID {pid}")

    # ──────────────────────── Public API ─────────────────────────────

    async def start_session(self, project_id: str) -> None:
        """
        Launch a claude remote-control session for the project.

        Uses --continue to resume the last conversation in the workspace.
        No-ops if a session is already active.

        Args:
            project_id (str): Project slug.

        Raises:
            ValueError: If the project is not found in state.
            RuntimeError: If the subprocess fails to start.
        """
        async with self._get_lock(project_id):
            # 1. Check project exists
            project = self._state_manager.get_project(project_id)
            if project is None:
                raise ValueError(f"Project '{project_id}' not found")

            # 2. Skip if session already running
            if project.session is not None:
                self.logger.info(f"Session already active for '{project_id}' (PID {project.session.pid})")
                return

            # 3. Launch subprocess
            workspace = pathlib.Path(project.workspace_path)
            self.logger.info(f"Starting session for '{project_id}' in '{workspace}'")

            proc = await asyncio.create_subprocess_exec(
                "claude", "remote-control",
                "--workspace", str(workspace),
                "--claude-dir", str(self._claude_dir),
                "--continue",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )

            # 4. Persist session state
            session = SessionState(
                pid=proc.pid,
                workspace=str(workspace),
                started_at=self._started_at(),
                expires_at=self._expires_at(),
            )
            project.session = session
            self._state_manager.upsert_project(project)
            self._processes[project_id] = proc
            self.logger.info(f"Session PID {proc.pid} started for '{project_id}'")

            # 5. Publish event
            await self._event_bus.publish(
                "session.started",
                {"pid": proc.pid, "workspace": str(workspace), "expires_at": session.expires_at},
                project_id=project_id,
            )

    async def stop_session(self, project_id: str) -> None:
        """
        Stop the active session for a project.

        Args:
            project_id (str): Project slug.
        """
        async with self._get_lock(project_id):
            project = self._state_manager.get_project(project_id)
            if project is None or project.session is None:
                self.logger.debug(f"No active session for '{project_id}'")
                return

            # 1. Kill subprocess
            self._kill(project.session.pid)
            self._processes.pop(project_id, None)

            # 2. Clear session state
            project.session = None
            self._state_manager.upsert_project(project)
            self.logger.info(f"Session stopped for '{project_id}'")

            # 3. Publish event
            await self._event_bus.publish("session.stopped", {}, project_id=project_id)

    async def renew_session(self, project_id: str) -> None:
        """
        Stop and restart the session with --continue.

        Args:
            project_id (str): Project slug.
        """
        async with self._get_lock(project_id):
            project = self._state_manager.get_project(project_id)
            if project is None:
                return
            if project.session is not None:
                self._kill(project.session.pid)
                self._processes.pop(project_id, None)
                project.session = None
                self._state_manager.upsert_project(project)

        # Restart without the lock (start_session acquires it)
        await self.start_session(project_id)
        await self._event_bus.publish("session.renewed", {}, project_id=project_id)

    async def tail_logs(self, project_id: str) -> AsyncIterator[str]:
        """
        Yield stdout lines from the active session subprocess.

        If no process is running, yields a sentinel message and exits.

        Args:
            project_id (str): Project slug.

        Yields:
            str: One decoded, stripped line at a time.
        """
        proc = self._processes.get(project_id)
        if proc is None or proc.stdout is None:
            yield f"(no active session for '{project_id}')"
            return
        async for line in proc.stdout:
            yield line.decode().rstrip()

    def update_hash(self, project_id: str, hash_value: str) -> None:
        """
        Store a discovered claude_project_hash in session state.

        Args:
            project_id (str): Project slug.
            hash_value (str): Hash of the Claude project directory.
        """
        project = self._state_manager.get_project(project_id)
        if project is not None and project.session is not None:
            project.session.claude_project_hash = hash_value
            self._state_manager.upsert_project(project)

    # ──────────────────────── Watchdog ───────────────────────────────

    async def _check_expired(self, renew_threshold_minutes: int) -> None:
        """
        Check all sessions and renew or stop expired ones.

        Args:
            renew_threshold_minutes (int): Renew if TTL < this value.
        """
        state = self._state_manager.load_projects()
        now = datetime.datetime.now(datetime.UTC)
        threshold = datetime.timedelta(minutes=renew_threshold_minutes)

        for project_id, project in state.projects.items():
            if project.session is None:
                continue
            expires = datetime.datetime.fromisoformat(project.session.expires_at)
            time_left = expires - now

            if project.session.auto_renew and time_left <= threshold:
                self.logger.info(f"Auto-renewing session for '{project_id}' (TTL {time_left})")
                await self.renew_session(project_id)
            elif not project.session.auto_renew and expires <= now:
                self.logger.info(f"Session expired for '{project_id}', stopping")
                await self.stop_session(project_id)
                await self._event_bus.publish("session.expired", {}, project_id=project_id)

    async def _watchdog_loop(self, renew_threshold_minutes: int) -> None:
        """Run expiry check every 60 seconds indefinitely."""
        while True:
            await asyncio.sleep(60)
            await self._check_expired(renew_threshold_minutes)

    async def start_watchdog(self, renew_threshold_minutes: int) -> asyncio.Task:
        """
        Start the background watchdog task.

        Args:
            renew_threshold_minutes (int): Passed to _check_expired.

        Returns:
            asyncio.Task: The running watchdog task.
        """
        self.logger.info(f"Starting session watchdog (threshold={renew_threshold_minutes}min)")
        return asyncio.create_task(self._watchdog_loop(renew_threshold_minutes))
