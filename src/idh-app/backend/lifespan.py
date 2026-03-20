# ====== Code Summary ======
# FastAPI lifespan — bootstraps services at startup, shuts them down on exit.

# ====== Standard Library Imports ======
import unicodedata
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

# ====== Third-Party Library Imports ======
from pyfiglet import Figlet

# ====== Local Project Imports ======
from .context import CONTEXT

# Total startup steps — update when adding/removing steps.
TOTAL_STEPS = 1


def lifespan() -> Any:
    """
    Return the FastAPI lifespan context manager factory.

    Returns:
        Any: Async context manager for FastAPI's lifespan parameter.
    """

    def log_step(step: int, message: str) -> None:
        """Log a numbered startup step."""
        CONTEXT.logger.info(f"\n[{step}/{TOTAL_STEPS}] {message}...")

    @asynccontextmanager
    async def _lifespan(app: Any) -> AsyncIterator[None]:
        _ = app
        try:
            # 1. Print startup banner
            banner = "\n" + Figlet(font="slant").renderText(
                "".join(
                    c
                    for c in unicodedata.normalize(
                        "NFD", CONTEXT.RUNTIME_CONFIG.FASTAPI_APP_NAME
                    )
                    if unicodedata.category(c) != "Mn"
                )
            )
            CONTEXT.logger.info(banner)

            # 2. Log runtime config
            log_step(1, "Runtime configuration")
            CONTEXT.logger.info(CONTEXT.RUNTIME_CONFIG)

            # Yield — app is now running
            yield

        finally:
            CONTEXT.logger.info(f"Shutting down IDH App...")

    return _lifespan
