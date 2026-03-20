# ====== Code Summary ======
# CodexSummarizer — runs codex compress to generate project summaries.

# ====== Standard Library Imports ======
import asyncio
import os
import pathlib

# ====== Third-Party Library Imports ======
from loggerplusplus import LoggerClass


class CodexSummarizer(LoggerClass):
    """
    Generates project summaries by running the ``codex compress`` command.

    Invokes ``codex compress`` as a subprocess in the project workspace and
    captures stdout as the summary output.

    Attributes:
        _codex_dir (pathlib.Path): Codex CLI home directory.
    """

    def __init__(self, codex_dir: pathlib.Path) -> None:
        """
        Initialise the CodexSummarizer.

        Args:
            codex_dir (pathlib.Path): Path to the Codex home directory.
        """
        LoggerClass.__init__(self)
        self._codex_dir = codex_dir

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

        return stdout.decode().strip()
