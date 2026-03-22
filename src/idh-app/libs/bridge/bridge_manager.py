# ====== Code Summary ======
# BridgeManager — starts/stops claude remote-control bridges and runs the expiry watchdog.

# ====== Standard Library Imports ======
import asyncio
import datetime
import json
import os
import pathlib
import re
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
        # In-memory process map — subprocess handle per group_id
        self._processes: dict[str, asyncio.subprocess.Process] = {}
        # Per-group log history: ordered list of unique, ANSI-stripped lines.
        # Written by _pipe_reader; read by tail_logs for replay and live streaming.
        # Cleared when a bridge restarts so each session starts fresh.
        self._log_history: dict[str, list[str]] = {}
        # Per-group dedup set: O(1) membership test used by _pipe_reader to skip
        # repeated lines from the claude remote-control TUI refresh (~1 s cycle).
        self._log_seen: dict[str, set[str]] = {}

    # ANSI escape sequence pattern — matches CSI sequences like \x1b[7A, \x1b[J, \x1b[0m
    # and OSC sequences like \x1b]8;;url\x1b\\ used by claude remote-control's terminal UI.
    _ANSI_ESCAPE = re.compile(r"\x1b(?:\[[0-9;]*[A-Za-z]|\][^\x1b]*(?:\x1b\\|\x07))")

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

    def _trust_workspace(self, workspace: pathlib.Path) -> None:
        """
        Ensure the workspace path is trusted in ~/.claude.json before launching
        a bridge subprocess.

        Claude Code refuses to run ``remote-control`` in any directory that has
        not been explicitly trusted via the interactive trust dialog. Inside the
        container the workspace paths are Linux paths (e.g. /workspaces/Foo)
        which are never present in the host-side ~/.claude.json that was built
        from Windows paths. This method pre-accepts trust for the container
        path so the bridge starts without user interaction.

        The write is atomic: the JSON is written to a temp file first, then
        renamed over the real file so a crash mid-write never corrupts it.

        Args:
            workspace (pathlib.Path): Workspace directory to mark as trusted.
        """
        # ~/.claude.json lives one level above the ~/.claude/ directory
        claude_json = self._claude_dir.parent / ".claude.json"
        workspace_str = str(workspace)

        # 1. Load existing config — tolerate missing or malformed file
        config: dict = {}
        if claude_json.exists():
            try:
                config = json.loads(claude_json.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError) as exc:
                self.logger.warning(f"Could not parse {claude_json}: {exc} — starting fresh")

        # 2. Skip if already trusted (idempotent)
        projects: dict = config.setdefault("projects", {})
        entry: dict = projects.setdefault(workspace_str, {})
        if entry.get("hasTrustDialogAccepted") is True:
            self.logger.debug(f"Workspace '{workspace_str}' already trusted")
            return

        # 3. Inject the minimal trust entry Claude Code expects
        entry["hasTrustDialogAccepted"] = True
        entry.setdefault("allowedTools", [])
        entry.setdefault("mcpContextUris", [])
        entry.setdefault("mcpServers", {})
        entry.setdefault("enabledMcpjsonServers", [])
        entry.setdefault("disabledMcpjsonServers", [])

        # 4. Write back.
        #    Note: ~/.claude.json is a Docker bind-mount from the host, so a cross-device
        #    atomic rename (tmp → target) always fails with EBUSY/EXDEV. Write directly.
        try:
            claude_json.write_text(json.dumps(config, indent=2, ensure_ascii=False), encoding="utf-8")
            self.logger.info(f"Trusted workspace '{workspace_str}' in {claude_json}")
        except OSError as exc:
            self.logger.error(f"Failed to write trust entry to {claude_json}: {exc}")

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

    # ──────────────────────────── Log pipe reader ─────────────────────────────

    async def _pipe_reader(self, group_id: str, process: asyncio.subprocess.Process) -> None:
        """
        Background task that drains a bridge process's stdout pipe into history.

        Runs for the lifetime of the bridge process. Each unique, ANSI-stripped
        line is appended to ``_log_history[group_id]`` so that ``tail_logs`` can
        replay the full session history to any client that connects or reconnects.

        Args:
            group_id (str): Telegram group ID owning this bridge.
            process (asyncio.subprocess.Process): The bridge subprocess.
        """
        if process.stdout is None:
            return

        seen: set[str] = self._log_seen[group_id]
        history: list[str] = self._log_history[group_id]

        async for raw in process.stdout:
            # 1. Strip ANSI cursor-movement / colour codes from TUI output
            cleaned = self._ANSI_ESCAPE.sub("", raw.decode()).rstrip()

            # 2. Skip blank lines and lines already recorded (TUI refresh dedup)
            if not cleaned or cleaned in seen:
                continue

            # 3. Append to both the dedup set and the ordered history list
            seen.add(cleaned)
            history.append(cleaned)

        self.logger.debug(f"Pipe reader for group '{group_id}' finished (process exited)")

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

        # 2. Compute expiry
        expires = self._expires_at()

        # 3. Pre-accept workspace trust so claude remote-control starts non-interactively.
        #    The container uses Linux paths (/workspaces/Foo) which are never present in
        #    the host-side ~/.claude.json (built from Windows paths). Without this patch
        #    the bridge exits immediately with "Workspace not trusted".
        self._trust_workspace(workspace)

        # 4. Launch the claude remote-control subprocess with stdout piped for log streaming.
        #    --permission-mode bypassPermissions skips workspace trust and interactive
        #    permission prompts (safe here — idh-app runs in an isolated Docker container).
        #    NOTE: --dangerously-skip-permissions at the top-level breaks remote-control's
        #    option parser in claude ≥ 2.1 and must NOT be used for this subcommand.
        #    cwd sets the working directory so Claude Code operates on the project workspace.
        #    --name labels the session on claude.ai/code for easy identification.
        #    Use the workspace folder name (e.g. "Patrimonium") rather than the
        #    Telegram group ID so the session is human-readable in the Claude UI.
        session_name = workspace.name
        self.logger.info(f"Starting bridge for group '{group_id}' in '{workspace}'")
        proc = await asyncio.create_subprocess_exec(
            "claude",
            "remote-control",
            "--name", session_name,
            "--permission-mode", "bypassPermissions",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=str(workspace),
        )

        # 4. Persist the bridge state, init log storage, start pipe reader.
        #    Reset history and seen set so each bridge session starts fresh.
        bridge = BridgeState(pid=proc.pid, workspace=str(workspace), expires_at=expires)
        project = self._state_manager.get_project(group_id)
        if project is not None:
            project.bridge = bridge
            self._state_manager.upsert_project(group_id, project)
        self._processes[group_id] = proc
        self._log_history[group_id] = []
        self._log_seen[group_id] = set()
        # Start the background task that drains stdout into _log_history.
        asyncio.create_task(self._pipe_reader(group_id, proc))
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
        Async generator that streams bridge output to a WebSocket client.

        On every connection (including reconnects), replays the full history of
        lines accumulated since the bridge started, then polls for new lines
        every 100 ms until the bridge process exits.

        The pipe is consumed exclusively by ``_pipe_reader``, which deduplicates
        TUI refresh spam and writes unique lines into ``_log_history``.  This
        method only reads from that list — multiple concurrent clients are safe.

        Args:
            group_id (str): Telegram group ID.

        Yields:
            str: One log line at a time (history first, then live updates).
        """
        history: list[str] = self._log_history.get(group_id, [])

        # 1. If there's no history and no active process, emit a sentinel and exit.
        if not history and group_id not in self._processes:
            yield f"(no active bridge for group '{group_id}')"
            return

        # 2. Replay all lines accumulated so far — gives reconnecting clients the
        #    full session context immediately.
        pos = 0
        while pos < len(history):
            yield history[pos]
            pos += 1

        # 3. Poll for new lines written by the background _pipe_reader task.
        #    Exit when the process is no longer tracked (stopped or expired).
        while group_id in self._processes:
            if pos < len(history):
                yield history[pos]
                pos += 1
            else:
                # No new lines yet — yield control and check again shortly.
                await asyncio.sleep(0.1)

    async def start_watchdog(self) -> asyncio.Task:
        """
        Start the background watchdog task that reaps expired bridges.

        Returns:
            asyncio.Task: The running watchdog asyncio task.
        """
        # 1. Schedule and return the watchdog background task
        self.logger.info(f"Starting bridge watchdog (TTL={self._bridge_ttl_hours}h)")
        return asyncio.create_task(self._watchdog_loop())
