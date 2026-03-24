# ====== Code Summary ======
# AuthChecker — detects Claude CLI credentials and spawns auth flow.

from __future__ import annotations
import asyncio
import json
import pathlib
import time
from loggerplusplus import LoggerClass


class AuthChecker(LoggerClass):
    """
    Checks for valid Claude CLI credentials and manages the auth flow.

    Looks for credentials in two locations (checked in order):
    1. ~/.claude/.credentials.json — OAuth token with expiry
    2. ~/.claude.json — legacy token file

    Attributes:
        _claude_dir (pathlib.Path): Claude home directory (~/.claude).
        _claude_json_path (pathlib.Path | None): Optional path to ~/.claude.json.
        _auth_process (asyncio.subprocess.Process | None): Running `claude auth login` process.
    """

    def __init__(
        self,
        claude_dir: pathlib.Path,
        claude_json_path: pathlib.Path | None = None,
    ) -> None:
        LoggerClass.__init__(self)
        self._claude_dir = claude_dir
        self._claude_json_path = claude_json_path
        self._auth_process: asyncio.subprocess.Process | None = None

    # ──────────────────────── Private helpers ────────────────────────

    def _read_credentials(self) -> dict | None:
        """Read ~/.claude/.credentials.json if it exists."""
        creds_path = self._claude_dir / ".credentials.json"
        if not creds_path.exists():
            return None
        try:
            return json.loads(creds_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None

    def _read_claude_json(self) -> dict | None:
        """Read ~/.claude.json if it exists."""
        path = self._claude_json_path
        if path is None:
            path = self._claude_dir.parent / ".claude.json"
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None

    # ──────────────────────── Public API ─────────────────────────────

    def is_authenticated(self) -> bool:
        """
        Return True if valid, non-expired Claude credentials are found.

        Returns:
            bool: True if authenticated.
        """
        # 1. Check .credentials.json (primary)
        creds = self._read_credentials()
        if creds is not None:
            oauth = creds.get("claudeAiOauth", {})
            token = oauth.get("accessToken", "")
            expires_at_ms = oauth.get("expiresAt", 0)
            # expiresAt is milliseconds since epoch
            if token and expires_at_ms > time.time() * 1000:
                return True

        # 2. Check .claude.json (legacy fallback)
        claude_json = self._read_claude_json()
        if claude_json is not None:
            if claude_json.get("oauthToken") or claude_json.get("accessToken"):
                return True

        return False

    def get_email(self) -> str | None:
        """
        Return the authenticated user's email address, if available.

        Returns:
            str | None: Email address or None.
        """
        creds = self._read_credentials()
        if creds is not None:
            return creds.get("claudeAiOauth", {}).get("emailAddress")
        return None

    async def start_login(self) -> asyncio.subprocess.Process:
        """
        Spawn `claude auth login` and return the process handle.

        Returns:
            asyncio.subprocess.Process: Running auth subprocess.

        Raises:
            FileNotFoundError: If the `claude` binary is not in PATH.
        """
        self.logger.info(f"Starting claude auth login")
        proc = await asyncio.create_subprocess_exec(
            "claude", "auth", "login",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        self._auth_process = proc
        return proc

    def get_active_login_process(self) -> asyncio.subprocess.Process | None:
        """
        Return the currently running login process, if any.

        Returns:
            asyncio.subprocess.Process | None: Active process or None.
        """
        if self._auth_process is not None and self._auth_process.returncode is None:
            return self._auth_process
        return None
