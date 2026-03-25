# ====== Code Summary ======
# AuthChecker detects Claude CLI credentials and manages the auth flow process.

from __future__ import annotations

import asyncio
import json
import pathlib
import time

from loggerplusplus import LoggerClass


class AuthChecker(LoggerClass):
    """
    Check for valid Claude CLI credentials and manage the login flow.

    Attributes:
        _claude_dir (pathlib.Path): Claude home directory (~/.claude).
        _auth_process (asyncio.subprocess.Process | None): Running `claude auth login` process.
    """

    def __init__(self, claude_dir: pathlib.Path) -> None:
        """
        Initialize the auth checker.

        Args:
            claude_dir (pathlib.Path): Path to Claude credentials directory.
        """
        LoggerClass.__init__(self)
        self._claude_dir = claude_dir
        self._auth_process: asyncio.subprocess.Process | None = None

    def _read_credentials(self) -> dict | None:
        """
        Read ~/.claude/.credentials.json if it exists and is valid JSON.

        Returns:
            dict | None: Parsed credentials payload, otherwise None.
        """
        creds_path = self._claude_dir / '.credentials.json'
        if not creds_path.exists():
            return None

        try:
            return json.loads(creds_path.read_text(encoding='utf-8'))
        except (json.JSONDecodeError, OSError):
            return None

    def is_authenticated(self) -> bool:
        """
        Return True when a non-expired Claude OAuth token is present.

        Returns:
            bool: True if authenticated, False otherwise.
        """
        # 1. Read credentials payload from the primary Claude file.
        credentials = self._read_credentials()
        if credentials is None:
            return False

        # 2. Validate token presence and expiry timestamp.
        oauth_payload = credentials.get('claudeAiOauth', {})
        token = oauth_payload.get('accessToken', '')
        expires_at_ms = oauth_payload.get('expiresAt', 0)
        return bool(token) and bool(expires_at_ms > time.time() * 1000)

    def get_email(self) -> str | None:
        """
        Return authenticated user email when available.

        Returns:
            str | None: Email address from credentials file, if present.
        """
        credentials = self._read_credentials()
        if credentials is None:
            return None

        return credentials.get('claudeAiOauth', {}).get('emailAddress')

    async def start_login(self) -> asyncio.subprocess.Process:
        """
        Spawn `claude auth login` and return the process handle.

        Returns:
            asyncio.subprocess.Process: Running auth subprocess.

        Raises:
            FileNotFoundError: If `claude` binary is not available in PATH.
        """
        self.logger.info(f'Starting claude auth login')
        process = await asyncio.create_subprocess_exec(
            'claude', 'auth', 'login',
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        self._auth_process = process
        return process

    def get_active_login_process(self) -> asyncio.subprocess.Process | None:
        """
        Return currently running login process, if any.

        Returns:
            asyncio.subprocess.Process | None: Active process or None.
        """
        if self._auth_process is None:
            return None

        if self._auth_process.returncode is None:
            return self._auth_process

        return None
