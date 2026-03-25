# ====== Code Summary ======
# SessionManager — lifecycle of claude remote-control subprocesses.
# Includes queue-based log buffering and session recovery on restart.

from __future__ import annotations
import asyncio
import datetime
import json
import os
import pathlib
import re
import signal
from collections import deque
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, Any

from loggerplusplus import LoggerClass
from libs.state.models import SessionState
from libs.state.state_manager import StateManager

if TYPE_CHECKING:
    from libs.event_bus.event_bus import EventBus


# Maximum log lines kept in the per-project ring buffer.
_LOG_BUFFER_MAXLEN = 500

# Regex that matches all ANSI/VT100 escape sequences.
# Covers:
#   - CSI sequences: ESC [ <params> <final>  (cursor movement, colors, erase…)
#   - OSC sequences: ESC ] <data> ST         (hyperlinks, window title…)
#   - Single-char sequences: ESC <char>      (RIS, IND, NEL…)
_ANSI_ESCAPE_RE = re.compile(
    r"\x1b"                   # ESC
    r"(?:"
    r"\[[0-?]*[ -/]*[@-~]"   # CSI  ESC [ ... final-byte
    r"|\][^\x1b]*(?:\x1b\\|\x07)"  # OSC  ESC ] ... ST-or-BEL
    r"|[@-Z\\-_]"             # Fe   ESC <single-char>
    r")"
)


class SessionManager(LoggerClass):
    """
    Manages claude remote-control subprocess lifecycle per project.

    Each project gets one subprocess at a time.  All start/stop/renew operations
    acquire a per-project asyncio.Lock to prevent races between the API, watchdog,
    and scheduler.

    Log lines from each subprocess stdout are continuously read by a per-project
    background task (_log_reader).  Lines are accumulated in a ring buffer and
    fanned out to every active WebSocket subscriber queue so:
      - Multiple simultaneous viewers see the same stream.
      - Late-connecting viewers receive the recent history immediately.
      - No lines are lost when no viewer is connected.

    Attributes:
        _state_manager (StateManager): Persisted project state.
        _workspaces_dir (pathlib.Path): Root directory for project workspaces.
        _claude_dir (pathlib.Path): ~/.claude directory path.
        _event_bus (EventBus): For publishing session lifecycle events.
        _default_ttl_hours (int): Session TTL in hours.
        _renew_threshold_minutes (int): Renew when TTL falls below this.
        _processes (dict[str, Any]): Live subprocess handles.
        _locks (dict[str, asyncio.Lock]): Per-project concurrency locks.
        _log_buffers (dict[str, deque[str]]): Per-project log line ring buffers.
        _log_subscribers (dict[str, list[asyncio.Queue]]): Per-project subscriber queues.
        _log_tasks (dict[str, asyncio.Task]): Per-project background log reader tasks.
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
        self._log_buffers: dict[str, deque[str]] = {}
        self._log_subscribers: dict[str, list[asyncio.Queue]] = {}
        self._log_tasks: dict[str, asyncio.Task] = {}

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

    def _is_claude_process(self, pid: int) -> bool:
        """
        Check whether a PID is a live claude remote-control process.

        Reads /proc/<pid>/cmdline to verify the process identity, preventing
        false positives from PID reuse after a container restart.

        Args:
            pid (int): Process ID to check.

        Returns:
            bool: True only if the PID exists and belongs to claude remote-control.
        """
        try:
            cmdline = pathlib.Path(f"/proc/{pid}/cmdline").read_text(errors="replace")
            cmdline = cmdline.replace("\0", " ")
            return "claude" in cmdline and "remote-control" in cmdline
        except (OSError, PermissionError):
            return False

    def _trust_workspace(self, workspace: pathlib.Path) -> None:
        """
        Pre-accept the Claude Code workspace trust dialog for a path.

        Claude Code stores per-project trust in ~/.claude.json under
        projects[<path>].hasTrustDialogAccepted.  Without this entry the
        ``claude remote-control`` command refuses to start and asks the user
        to run ``claude`` interactively first.

        This method writes the trust entry directly so sessions can start
        unattended inside the container.

        Args:
            workspace (pathlib.Path): Absolute path to the workspace directory.
        """
        # 1. Resolve path to ~/.claude.json
        claude_json_path = self._claude_dir.parent / ".claude.json"
        if not claude_json_path.exists():
            self.logger.warning(f"~/.claude.json not found at '{claude_json_path}' — cannot pre-trust workspace")
            return

        # 2. Read existing config
        try:
            with claude_json_path.open("r", encoding="utf-8") as fh:
                config: dict = json.load(fh)
        except (json.JSONDecodeError, OSError) as exc:
            self.logger.warning(f"Could not read '{claude_json_path}': {exc}")
            return

        # 3. Ensure projects dict exists and add trust entry if missing
        projects: dict = config.setdefault("projects", {})
        ws_key = str(workspace)
        if projects.get(ws_key, {}).get("hasTrustDialogAccepted"):
            self.logger.debug(f"Workspace '{ws_key}' already trusted")
            return

        projects[ws_key] = {**projects.get(ws_key, {}), "hasTrustDialogAccepted": True}
        self.logger.info(f"Pre-trusted workspace '{ws_key}' in ~/.claude.json")

        # 4. Write back directly (atomic rename not possible across bind-mount boundaries)
        try:
            with claude_json_path.open("w", encoding="utf-8") as fh:
                json.dump(config, fh, indent=2, ensure_ascii=False)
        except OSError as exc:
            self.logger.warning(f"Could not write '{claude_json_path}': {exc}")

    # ──────────────────────── Log buffer management ──────────────────

    def _get_log_buffer(self, project_id: str) -> deque[str]:
        """Get or create the log ring buffer for a project."""
        if project_id not in self._log_buffers:
            self._log_buffers[project_id] = deque(maxlen=_LOG_BUFFER_MAXLEN)
        return self._log_buffers[project_id]

    def _broadcast_log_line(self, project_id: str, line: str) -> None:
        """
        Append a log line to the buffer and fan out to all active subscribers.

        Deduplicates within a rolling window: the claude remote-control TUI
        redraws its status block every second by emitting the same lines
        repeatedly.  If a line already appears in the last 60 entries of the
        buffer it is silently dropped so the viewer is not spammed.

        Args:
            project_id (str): Project slug.
            line (str): Decoded, ANSI-stripped log line.
        """
        # 1. Dedup: skip if the line already appears in the recent buffer window
        buffer = self._get_log_buffer(project_id)
        recent = list(buffer)[-60:]
        if line in recent:
            return

        # 2. Append to ring buffer
        buffer.append(line)

        # 2. Put into every subscriber queue (non-blocking; drop if full)
        subscribers = self._log_subscribers.get(project_id, [])
        dead: list[asyncio.Queue] = []
        for q in subscribers:
            try:
                q.put_nowait(line)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            try:
                subscribers.remove(q)
            except ValueError:
                pass

    async def _log_reader_task(self, project_id: str, proc: Any) -> None:
        """
        Background task: drain subprocess stdout and fan out to subscribers.

        Runs until the process exits.  Sends a sentinel None to all subscriber
        queues when done so they can exit cleanly.

        Args:
            project_id (str): Project slug.
            proc: asyncio subprocess handle with a readable stdout pipe.
        """
        self.logger.debug(f"Log reader started for '{project_id}'")
        try:
            async for raw in proc.stdout:
                # Strip ANSI/VT100 escape sequences produced by the claude TUI
                # (cursor movement, clear-screen, OSC hyperlinks, etc.) so the
                # log viewer receives clean plain-text lines.
                line = _ANSI_ESCAPE_RE.sub("", raw.decode(errors="replace")).rstrip()
                if not line:
                    # Skip blank lines that result from stripping TUI redraw sequences.
                    continue
                self._broadcast_log_line(project_id, line)
        except Exception as exc:
            self.logger.warning(f"Log reader error for '{project_id}': {exc}")
        finally:
            # Signal all subscribers that the stream has ended
            for q in self._log_subscribers.get(project_id, []):
                try:
                    q.put_nowait(None)
                except asyncio.QueueFull:
                    pass
            self.logger.debug(f"Log reader finished for '{project_id}'")

    def _start_log_reader(self, project_id: str, proc: Any) -> None:
        """
        Start the background log reader task for a project.

        Args:
            project_id (str): Project slug.
            proc: asyncio subprocess with a readable stdout pipe.
        """
        task = asyncio.create_task(self._log_reader_task(project_id, proc))
        self._log_tasks[project_id] = task

    def _stop_log_reader(self, project_id: str) -> None:
        """
        Cancel the background log reader task for a project (if running).

        Args:
            project_id (str): Project slug.
        """
        task = self._log_tasks.pop(project_id, None)
        if task and not task.done():
            task.cancel()

    # ──────────────────────── Public API ─────────────────────────────

    async def recover_sessions(self) -> None:
        """
        Called once at startup to recover sessions from persisted state.

        For each project that had an active session:
        - If the PID is a live claude remote-control process (same-container
          restart), leave state intact but re-register the process so log
          streaming works again.
        - If the PID is dead (container restart or crash), clear the stale
          session state and restart the session automatically.
        """
        state = self._state_manager.load_projects()
        for project_id, project in state.projects.items():
            if project.session is None:
                continue

            pid = project.session.pid
            if self._is_claude_process(pid):
                # Same-container restart — process still alive but we can't
                # re-attach to its stdout pipe.  Clear state so the UI shows
                # it as stopped; user can manually restart.
                self.logger.info(
                    f"Session PID {pid} for '{project_id}' still alive after restart "
                    f"— cannot re-attach stdout, clearing state for clean restart"
                )
                project.session = None
                self._state_manager.upsert_project(project)
                self._kill(pid)

            else:
                self.logger.info(
                    f"Session PID {pid} for '{project_id}' is gone — restarting"
                )
                project.session = None
                self._state_manager.upsert_project(project)

            # Restart the session regardless
            try:
                await self.start_session(project_id)
            except Exception as exc:
                self.logger.warning(
                    f"Could not recover session for '{project_id}': {exc}"
                )

    async def start_session(self, project_id: str) -> None:
        """
        Launch a claude remote-control session for the project.

        No-ops if a session is already active.

        Args:
            project_id (str): Project slug.

        Raises:
            ValueError: If the project is not found in state.
            RuntimeError: If the workspace directory does not exist.
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

            # 3. Validate workspace directory exists
            workspace = pathlib.Path(project.workspace_path)
            if not workspace.exists():
                raise RuntimeError(
                    f"Workspace '{workspace}' does not exist — clone the repository first."
                )

            # 4. Pre-trust the workspace so the CLI does not block on the trust dialog
            self._trust_workspace(workspace)

            # 5. Launch subprocess
            # claude remote-control runs in cwd (no --workspace flag in current CLI).
            # --name: shown in the claude.ai/code session list.
            # --permission-mode acceptEdits: auto-accepts file edits without prompting;
            #   bypassPermissions is blocked when running as root inside the container.
            self.logger.info(f"Starting session for '{project_id}' in '{workspace}'")

            proc = await asyncio.create_subprocess_exec(
                "claude", "remote-control",
                "--name", project.name,
                "--permission-mode", "acceptEdits",
                cwd=str(workspace),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )

            # 6. Persist session state
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

            # 7. Start background log reader so stdout is consumed even when no viewer
            self._start_log_reader(project_id, proc)

            # 8. Publish event
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

            # 2. Cancel log reader task
            self._stop_log_reader(project_id)

            # 3. Clear session state
            project.session = None
            self._state_manager.upsert_project(project)
            self.logger.info(f"Session stopped for '{project_id}'")

            # 4. Publish event
            await self._event_bus.publish("session.stopped", {}, project_id=project_id)

    async def renew_session(self, project_id: str) -> None:
        """
        Stop and restart the session.

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
                self._stop_log_reader(project_id)
                project.session = None
                self._state_manager.upsert_project(project)

        # Restart without the lock (start_session acquires it)
        await self.start_session(project_id)
        await self._event_bus.publish("session.renewed", {}, project_id=project_id)

    async def tail_logs(self, project_id: str) -> AsyncIterator[str]:
        """
        Yield log lines for a project session via a subscriber queue.

        Sends the recent history buffer immediately, then delivers new lines
        as they arrive.  Multiple simultaneous callers each get their own queue
        and receive the same lines independently (fan-out).

        If no log reader task is running (session not started), yields a single
        sentinel message and exits.

        Args:
            project_id (str): Project slug.

        Yields:
            str: One decoded, stripped log line at a time.
        """
        # 1. Register subscriber queue and get history snapshot
        buffer = self._get_log_buffer(project_id)
        history = list(buffer)

        q: asyncio.Queue = asyncio.Queue(maxsize=_LOG_BUFFER_MAXLEN)
        subscribers = self._log_subscribers.setdefault(project_id, [])
        subscribers.append(q)

        try:
            # 2. Replay history for late-joining viewers
            for line in history:
                yield line

            # 3. If no log reader is running (session not started), exit
            if project_id not in self._log_tasks:
                yield f"(no active session for '{project_id}')"
                return

            # 4. Stream live lines from the queue
            while True:
                line = await q.get()
                if line is None:
                    # Sentinel: log reader finished (process exited)
                    break
                yield line

        finally:
            # 5. Always unregister the queue
            try:
                subscribers.remove(q)
            except ValueError:
                pass

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
