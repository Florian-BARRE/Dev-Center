# ====== Code Summary ======
# FastAPI lifespan — bootstraps all services and starts the bridge watchdog.

# ====== Standard Library Imports ======
import asyncio
import unicodedata
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

# ====== Third-Party Library Imports ======
from pyfiglet import Figlet

# ====== Local Project Imports ======
from .context import CONTEXT

# Total startup steps — update when adding/removing steps.
TOTAL_STEPS = 3


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
        watchdog_task: asyncio.Task | None = None
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

            # 3. Confirm services are ready (they were injected synchronously in entrypoint.py)
            log_step(2, "Services wired")
            CONTEXT.logger.info(f"StateManager, OpenClawConfigWriter, GitManager, WebhookClient ready")
            CONTEXT.logger.info(f"BridgeManager, MemoryManager, CodexSummarizer ready")

            # 4. Start bridge watchdog background task
            log_step(3, "Bridge watchdog")
            watchdog_task = await CONTEXT.bridge_manager.start_watchdog()

            # Yield — app is now running
            yield

        finally:
            CONTEXT.logger.info(f"Shutting down...")
            if watchdog_task is not None:
                watchdog_task.cancel()
                try:
                    await watchdog_task
                except asyncio.CancelledError:
                    pass

    return _lifespan
