# ====== Code Summary ======
# Lifespan — startup/shutdown orchestration for dev-center-app.

import asyncio
import unicodedata
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator
from pyfiglet import Figlet
from backend.context import CONTEXT

# Total number of startup steps — update this when adding/removing steps.
TOTAL_STEPS = 6


def log_step(step: int, msg: str) -> None:
    """
    Log a numbered startup step.

    Args:
        step (int): Current step number.
        msg (str): Step description.
    """
    CONTEXT.logger.info(f"\n[{step}/{TOTAL_STEPS}] {msg}...")


def lifespan() -> Any:
    """
    Return FastAPI lifespan context manager.

    Returns:
        Any: Async context manager for FastAPI's lifespan parameter.
    """

    @asynccontextmanager
    async def _lifespan(app: Any) -> AsyncIterator[None]:
        _ = app
        try:
            # 1. Print startup banner
            app_name = "".join(
                c for c in unicodedata.normalize("NFD", "Dev Center")
                if unicodedata.category(c) != "Mn"
            )
            banner = "\n" + Figlet(font="slant").renderText(app_name)
            CONTEXT.logger.info(banner)

            # 2. Log runtime configuration
            log_step(1, "Runtime configuration")
            CONTEXT.logger.info(CONTEXT.RUNTIME_CONFIG)

            # 3. Check Claude authentication
            log_step(2, "Claude auth check")
            CONTEXT.auth_ok = CONTEXT.auth_checker.is_authenticated()
            email = CONTEXT.auth_checker.get_email()
            if CONTEXT.auth_ok:
                CONTEXT.logger.info(f"Claude authenticated as {email}")
            else:
                CONTEXT.logger.warning(f"Claude credentials not found — auth required")

            # 4. Start session watchdog
            log_step(3, "Session watchdog")
            CONTEXT.watchdog_task = await CONTEXT.session_manager.start_watchdog(
                CONTEXT.RUNTIME_CONFIG.RENEW_THRESHOLD_MINUTES
            )

            # 5. Recover sessions that were active before restart
            log_step(4, "Session recovery")
            await CONTEXT.session_manager.recover_sessions()

            # 6. Start scheduler
            log_step(5, "Scheduler")
            CONTEXT.scheduler_task = await CONTEXT.scheduler.start()

            log_step(6, "Ready")
            yield

        finally:
            # Shutdown in reverse order — guard each step with hasattr
            CONTEXT.logger.info(f"Shutting down...")
            if hasattr(CONTEXT, "watchdog_task") and CONTEXT.watchdog_task:
                CONTEXT.watchdog_task.cancel()
            if hasattr(CONTEXT, "scheduler_task") and CONTEXT.scheduler_task:
                CONTEXT.scheduler_task.cancel()

    return _lifespan
