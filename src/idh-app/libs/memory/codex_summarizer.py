# ====== Code Summary ======
# CodexSummarizer — runs codex compress to generate project summaries.

# ====== Standard Library Imports ======
from __future__ import annotations

import asyncio
import os
import pathlib
from typing import TYPE_CHECKING

# ====== Third-Party Library Imports ======
from loggerplusplus import LoggerClass

if TYPE_CHECKING:
    from libs.event_bus.event_bus import EventBus


class CodexSummarizer(LoggerClass):
    """
    Generates project summaries by running the ``codex compress`` command.

    Invokes ``codex compress`` as a subprocess in the project workspace and
    captures stdout as the summary output.

    Attributes:
        _codex_dir (pathlib.Path): Codex CLI home directory.
        _event_bus (EventBus | None): Optional event bus for publishing real-time events.
    """

    def __init__(
        self,
        codex_dir: pathlib.Path,
        event_bus: "EventBus | None" = None,
    ) -> None:
        """
        Initialise the CodexSummarizer.

        Args:
            codex_dir (pathlib.Path): Path to the Codex home directory.
            event_bus (EventBus | None): Optional event bus for real-time event emission.
        """
        LoggerClass.__init__(self)
        self._codex_dir = codex_dir
        self._event_bus: "EventBus | None" = event_bus

    # ──────────────────────────── Public API ────────────────────────────────

    async def summarize(self, workspace: pathlib.Path) -> str:
        """
        Run ``codex compress`` in the given workspace and return the output.

        Args:
            workspace (pathlib.Path): Project workspace directory to summarize.

        Returns:
            str: Decoded and stripped stdout from the ``codex compress`` command.

        Raises:
            RuntimeError: If ``codex compress`` exits with a non-zero code.
        """
        # 1. Launch the codex compress subprocess with stdout capture
        self.logger.info(f"Running codex compress in '{workspace}'")

        # 1b. Emit summarizer.started event
        if self._event_bus is not None:
            await self._event_bus.publish(
                "summarizer.started",
                {"workspace": str(workspace)},
            )
        proc = await asyncio.create_subprocess_exec(
            "codex",
            "compress",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(workspace),
            env=os.environ | {"CODEX_HOME": str(self._codex_dir)},
        )

        # 2. Wait for completion and capture output
        stdout, _ = await proc.communicate()

        # 3. Raise on failure, return stripped output on success
        if proc.returncode != 0:
            raise RuntimeError(f"codex compress failed (exit {proc.returncode})")

        result = stdout.decode().strip()
        # 3b. Emit summarizer.completed event
        if self._event_bus is not None:
            await self._event_bus.publish(
                "summarizer.completed",
                {"workspace": str(workspace), "output_length": len(result)},
            )
        return result
