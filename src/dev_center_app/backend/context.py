# ====== Code Summary ======
# CONTEXT — typed service locator shared across all routes and services.

from __future__ import annotations
from typing import Any, Type, TYPE_CHECKING

from loggerplusplus import LoggerPlusPlus

if TYPE_CHECKING:
    from config import RUNTIME_CONFIG as _RC
    from libs.state.state_manager import StateManager
    from libs.event_bus.event_bus import EventBus
    from libs.session_manager.session_manager import SessionManager
    from libs.git_manager.git_manager import GitManager
    from libs.auth_checker.auth_checker import AuthChecker
    from libs.scheduler.scheduler import SchedulerService


class CONTEXT:
    """
    Shared application context — typed service locator.

    Type annotations only. All values are assigned at startup in entrypoint.py.
    Access via CONTEXT.attribute_name anywhere in the codebase.
    """

    # Logger
    logger: LoggerPlusPlus

    # Configuration
    RUNTIME_CONFIG: Type["_RC"]

    # Auth state (populated in lifespan)
    auth_ok: bool

    # Services
    state_manager: "StateManager"
    event_bus: "EventBus"
    session_manager: "SessionManager"
    git_manager: "GitManager"
    auth_checker: "AuthChecker"
    scheduler: "SchedulerService"

    # Background task handles (set in lifespan)
    watchdog_task: Any
    scheduler_task: Any
